import prisma from '../lib/prisma';
import ApiError from '../utils/ApiError';
import { recordAdminAuditEvent } from './adminAuditService';
import { revokeAllUserAccessTokens, type UserRole } from './authService';

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRoleResult {
  id: string;
  email: string;
  role: UserRole;
  previousRole: UserRole;
  reason?: string;
  reauthRequired: boolean;
}

const ALLOWED_ROLES = new Set<UserRole>(['USER', 'PARTNER', 'ADMIN']);

function toRole(value: unknown): UserRole {
  if (value === 'ADMIN' || value === 'PARTNER' || value === 'USER') {
    return value;
  }

  throw new ApiError(400, 'role chỉ chấp nhận USER, PARTNER hoặc ADMIN.');
}

async function getUserById(userId: string): Promise<{ id: string; email: string; role: UserRole } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; email: string; role: string }>>`
    SELECT id::text, email, role::text AS role
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    id: rows[0].id,
    email: rows[0].email,
    role: toRole(rows[0].role)
  };
}

async function countActiveAdmins(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE role = 'ADMIN'::"UserRole" AND is_active = true
  `;

  return rows[0]?.total ?? 0;
}

export async function listAdminUsers(filter?: { role?: string }): Promise<AdminUserListItem[]> {
  const requestedRole = typeof filter?.role === 'string' ? filter.role.trim().toUpperCase() : '';

  if (requestedRole && !ALLOWED_ROLES.has(requestedRole as UserRole)) {
    throw new ApiError(400, 'role chỉ chấp nhận USER, PARTNER hoặc ADMIN.');
  }

  const queryResult = requestedRole
    ? await prisma.$queryRaw<Array<{
        id: string;
        email: string;
        full_name: string | null;
        role: string;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT id::text, email, full_name, role::text AS role, is_active, created_at, updated_at
        FROM users
        WHERE role = ${requestedRole}::"UserRole"
        ORDER BY created_at DESC
        LIMIT 200
      `
    : await prisma.$queryRaw<Array<{
        id: string;
        email: string;
        full_name: string | null;
        role: string;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT id::text, email, full_name, role::text AS role, is_active, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 200
      `;

  return queryResult.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: toRole(row.role),
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));
}

export async function assignAdminUserRole(input: {
  actorId: string;
  targetUserId: string;
  nextRole: string;
  reason?: string;
}): Promise<UpdateUserRoleResult> {
  const actorId = input.actorId.trim();
  const targetUserId = input.targetUserId.trim();
  const nextRole = toRole(input.nextRole.trim().toUpperCase());
  const reason = typeof input.reason === 'string' ? input.reason.trim() || undefined : undefined;

  if (!actorId || !targetUserId) {
    throw new ApiError(400, 'Thiếu actorId hoặc targetUserId hợp lệ.');
  }

  const [actor, target] = await Promise.all([getUserById(actorId), getUserById(targetUserId)]);

  if (!actor) {
    throw new ApiError(403, 'Không tìm thấy actor admin hợp lệ.');
  }

  if (actor.role !== 'ADMIN') {
    throw new ApiError(403, 'Chỉ ADMIN mới có quyền cập nhật role.');
  }

  if (!target) {
    throw new ApiError(404, 'Không tìm thấy user cần cập nhật role.');
  }

  const previousRole = target.role;

  if (actorId === targetUserId && nextRole !== 'ADMIN') {
    const activeAdminCount = await countActiveAdmins();
    if (previousRole === 'ADMIN' && activeAdminCount <= 1) {
      throw new ApiError(409, 'Không thể hạ quyền ADMIN cuối cùng trong hệ thống.');
    }

    throw new ApiError(409, 'Không được tự hạ quyền của chính mình.');
  }

  if (previousRole === 'ADMIN' && nextRole !== 'ADMIN') {
    const activeAdminCount = await countActiveAdmins();
    if (activeAdminCount <= 1) {
      throw new ApiError(409, 'Không thể hạ quyền ADMIN cuối cùng trong hệ thống.');
    }
  }

  if (previousRole !== nextRole) {
    await prisma.$executeRaw`
      UPDATE users
      SET role = ${nextRole}::"UserRole", updated_at = NOW()
      WHERE id = ${targetUserId}
    `;

    await revokeAllUserAccessTokens(targetUserId);
  }

  await recordAdminAuditEvent({
    action: 'user.role.update',
    entity: 'user',
    entityId: targetUserId,
    actor: actorId,
    reason,
    source: 'api',
    metadata: {
      targetUserId,
      previousRole,
      newRole: nextRole,
      tokenRevoked: previousRole !== nextRole
    }
  });

  return {
    id: target.id,
    email: target.email,
    role: nextRole,
    previousRole,
    reason,
    reauthRequired: previousRole !== nextRole
  };
}

export async function revokeAdminUserRole(input: {
  actorId: string;
  targetUserId: string;
  reason?: string;
}): Promise<UpdateUserRoleResult> {
  return assignAdminUserRole({
    actorId: input.actorId,
    targetUserId: input.targetUserId,
    nextRole: 'USER',
    reason: input.reason
  });
}
