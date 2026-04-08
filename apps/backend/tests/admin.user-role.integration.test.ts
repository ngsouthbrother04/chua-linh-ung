import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../src/lib/prisma';
import adminRouter from '../src/routes/api/admin';
import { createAuthToken } from '../src/services/authService';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

async function ensureRoleInfrastructure(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
        CREATE TYPE "UserRole" AS ENUM ('USER', 'PARTNER', 'ADMIN');
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role "UserRole" NOT NULL DEFAULT 'USER';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_invalid_before TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_users_token_invalid_before ON users(token_invalid_before);
  `);
}

async function setUserRole(userId: string, role: 'USER' | 'PARTNER' | 'ADMIN'): Promise<void> {
  await prisma.$executeRaw`
    UPDATE users
    SET role = ${role}::"UserRole", updated_at = NOW()
    WHERE id = ${userId}
  `;
}

async function createUser(email: string): Promise<{ id: string; email: string }> {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'integration-password-hash'
    },
    select: {
      id: true,
      email: true
    }
  });

  return user;
}

describeIfDb('ADMIN user role management integration', () => {
  const app = createApp();
  const prefix = `role-int-${Date.now()}`;
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    await prisma.$connect();
    await ensureRoleInfrastructure();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`
      DELETE FROM users
      WHERE email LIKE ${`${prefix}%`}
    `;
    createdUserIds.clear();
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM users
      WHERE email LIKE ${`${prefix}%`}
    `;
    await prisma.$disconnect();
  });

  it('ADMIN đổi USER -> PARTNER thành công', async () => {
    const admin = await createUser(`${prefix}-admin-1@example.com`);
    const target = await createUser(`${prefix}-target-1@example.com`);
    createdUserIds.add(admin.id);
    createdUserIds.add(target.id);

    await setUserRole(admin.id, 'ADMIN');

    const { token } = createAuthToken(admin.id, undefined, 'ADMIN');

    const response = await request(app)
      .post(`/api/v1/admin/users/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-admin-actor', 'integration-test')
      .send({ role: 'PARTNER', reason: 'promote partner integration' });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('PARTNER');
    expect(response.body.previousRole).toBe('USER');
    expect(response.body.reauthRequired).toBe(true);

    const roleRow = await prisma.$queryRaw<Array<{ role: string }>>`
      SELECT role::text AS role
      FROM users
      WHERE id = ${target.id}
      LIMIT 1
    `;

    expect(roleRow[0]?.role).toBe('PARTNER');
  });

  it('PARTNER gọi role API bị 403', async () => {
    const admin = await createUser(`${prefix}-admin-2@example.com`);
    const partner = await createUser(`${prefix}-partner-1@example.com`);
    const target = await createUser(`${prefix}-target-2@example.com`);
    createdUserIds.add(admin.id);
    createdUserIds.add(partner.id);
    createdUserIds.add(target.id);

    await setUserRole(admin.id, 'ADMIN');
    await setUserRole(partner.id, 'PARTNER');

    const { token } = createAuthToken(partner.id, undefined, 'PARTNER');

    const response = await request(app)
      .post(`/api/v1/admin/users/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'PARTNER' });

    expect(response.status).toBe(403);
  });

  it('không thể hạ quyền ADMIN cuối cùng', async () => {
    const admin = await createUser(`${prefix}-admin-last@example.com`);
    createdUserIds.add(admin.id);
    await setUserRole(admin.id, 'ADMIN');

    const { token } = createAuthToken(admin.id, undefined, 'ADMIN');

    const existingAdmins = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
      SELECT id::text, role::text AS role
      FROM users
      WHERE role = 'ADMIN'::"UserRole"
    `;

    const otherAdmins = existingAdmins.filter((item) => item.id !== admin.id);

    for (const otherAdmin of otherAdmins) {
      await prisma.$executeRaw`
        UPDATE users
        SET role = 'USER'::"UserRole", updated_at = NOW()
        WHERE id = ${otherAdmin.id}
      `;
    }

    try {
      const response = await request(app)
        .post(`/api/v1/admin/users/${admin.id}/role/revoke`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'attempt revoke last admin' });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('ADMIN cuối cùng');
    } finally {
      for (const otherAdmin of otherAdmins) {
        await prisma.$executeRaw`
          UPDATE users
          SET role = ${otherAdmin.role}::"UserRole", updated_at = NOW()
          WHERE id = ${otherAdmin.id}
        `;
      }
    }
  });

  it('sau khi đổi role, token cũ không còn truy cập route ADMIN', async () => {
    const adminActor = await createUser(`${prefix}-admin-actor@example.com`);
    const targetAdmin = await createUser(`${prefix}-admin-target@example.com`);
    createdUserIds.add(adminActor.id);
    createdUserIds.add(targetAdmin.id);

    await setUserRole(adminActor.id, 'ADMIN');
    await setUserRole(targetAdmin.id, 'ADMIN');

    const { token: actorToken } = createAuthToken(adminActor.id, undefined, 'ADMIN');
    const { token: targetOldAdminToken } = createAuthToken(targetAdmin.id, undefined, 'ADMIN');

    const downgradeResponse = await request(app)
      .post(`/api/v1/admin/users/${targetAdmin.id}/role/revoke`)
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ reason: 'downgrade stale token test' });

    expect(downgradeResponse.status).toBe(200);
    expect(downgradeResponse.body.role).toBe('USER');

    const oldTokenAccessResponse = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${targetOldAdminToken}`);

    expect(oldTokenAccessResponse.status).toBe(403);
  });
});
