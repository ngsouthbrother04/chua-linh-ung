export interface AdminAuditEvent {
  action: string;
  entity: 'poi' | 'tour' | 'system' | 'user';
  entityId?: string;
  actor?: string;
  reason?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function recordAdminAuditEvent(input: AdminAuditEvent): Promise<void> {
  const payload = {
    action: input.action,
    entity: input.entity,
    entityId: toSafeString(input.entityId),
    actor: toSafeString(input.actor) ?? 'unknown',
    reason: toSafeString(input.reason),
    source: toSafeString(input.source) ?? 'api',
    metadata: input.metadata ?? {},
    timestamp: new Date().toISOString()
  };

  // Audit trail baseline: structured logs are persisted by platform logging pipeline.
  console.info('[ADMIN_AUDIT]', JSON.stringify(payload));
}
