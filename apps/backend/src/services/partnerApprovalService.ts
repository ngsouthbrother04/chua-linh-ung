import crypto from 'crypto';
import prisma from '../lib/prisma';
import ApiError from '../utils/ApiError';
import {
  createAdminPoi,
  createAdminTour,
  deleteAdminPoi,
  deleteAdminTour,
  getAdminPoiById,
  getAdminTourById,
  updateAdminPoi,
  updateAdminTour
} from './poiAdminService';
import { recordAdminAuditEvent } from './adminAuditService';
import { enqueuePoiTtsGeneration } from './ttsService';

export type ApprovalEntityType = 'POI' | 'TOUR';
export type ApprovalActionType = 'CREATE' | 'UPDATE' | 'DELETE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateApprovalRequestInput {
  entityType: string;
  actionType: string;
  targetId?: string;
  payload?: unknown;
  reason?: string;
  requestedBy: string;
}

export interface ApprovalRequestItem {
  id: string;
  entityType: ApprovalEntityType;
  actionType: ApprovalActionType;
  targetId: string | null;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  reason: string | null;
  decisionNote: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  resultSnapshot: Record<string, unknown> | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalRequestRow {
  id: string;
  entity_type: string;
  action_type: string;
  target_id: string | null;
  payload: unknown;
  status: string;
  reason: string | null;
  decision_note: string | null;
  requested_by: string;
  reviewed_by: string | null;
  result_snapshot: unknown;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const APPROVAL_REQUEST_SELECT = `
  SELECT
    id,
    entity_type,
    action_type,
    target_id,
    payload,
    status,
    reason,
    decision_note,
    requested_by,
    reviewed_by,
    result_snapshot,
    reviewed_at,
    created_at,
    updated_at
  FROM partner_approval_requests
`;

function toEntityType(raw: string): ApprovalEntityType {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'POI' || normalized === 'TOUR') {
    return normalized;
  }

  throw new ApiError(400, 'entityType phải là POI hoặc TOUR.');
}

function toActionType(raw: string): ApprovalActionType {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'CREATE' || normalized === 'UPDATE' || normalized === 'DELETE') {
    return normalized;
  }

  throw new ApiError(400, 'actionType phải là CREATE, UPDATE hoặc DELETE.');
}

function toStatus(raw: string): ApprovalStatus {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'PENDING' || normalized === 'APPROVED' || normalized === 'REJECTED') {
    return normalized;
  }

  throw new ApiError(400, 'status phải là PENDING, APPROVED hoặc REJECTED.');
}

function toPayloadObject(payload: unknown): Record<string, unknown> {
  if (payload === undefined || payload === null) {
    return {};
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(400, 'payload phải là object JSON hợp lệ.');
  }

  return payload as Record<string, unknown>;
}

function toTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function mapRowToItem(row: ApprovalRequestRow): ApprovalRequestItem {
  return {
    id: row.id,
    entityType: toEntityType(row.entity_type),
    actionType: toActionType(row.action_type),
    targetId: row.target_id,
    payload: (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>,
    status: toStatus(row.status),
    reason: row.reason,
    decisionNote: row.decision_note,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    resultSnapshot:
      row.result_snapshot && typeof row.result_snapshot === 'object'
        ? (row.result_snapshot as Record<string, unknown>)
        : null,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

async function assertPartnerCanRequestChange(
  requestedBy: string,
  entityType: ApprovalEntityType,
  actionType: ApprovalActionType,
  targetId?: string
): Promise<void> {
  if (actionType === 'CREATE') {
    return;
  }

  const normalizedTargetId = toTrimmed(targetId);
  if (!normalizedTargetId) {
    throw new ApiError(400, 'targetId là bắt buộc cho action UPDATE/DELETE.');
  }

  const authContext = { actorId: requestedBy, role: 'PARTNER' };
  if (entityType === 'POI') {
    await getAdminPoiById(normalizedTargetId, authContext);
    return;
  }

  await getAdminTourById(normalizedTargetId, authContext);
}

export async function createPartnerApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequestItem> {
  const requestedBy = toTrimmed(input.requestedBy);
  if (!requestedBy) {
    throw new ApiError(400, 'Thiếu requestedBy hợp lệ.');
  }

  const entityType = toEntityType(input.entityType);
  const actionType = toActionType(input.actionType);
  const targetId = toTrimmed(input.targetId);
  const payload = toPayloadObject(input.payload);
  const reason = toTrimmed(input.reason);

  await assertPartnerCanRequestChange(requestedBy, entityType, actionType, targetId);

  const createdId = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO partner_approval_requests (
      id,
      entity_type,
      action_type,
      target_id,
      payload,
      status,
      reason,
      requested_by
    ) VALUES (
      ${createdId},
      ${entityType}::"ApprovalEntityType",
      ${actionType}::"ApprovalActionType",
      ${targetId ?? null},
      ${payload}::jsonb,
      'PENDING'::"ApprovalStatus",
      ${reason ?? null},
      ${requestedBy}
    )
  `;

  await recordAdminAuditEvent({
    action: 'approval_request.create',
    entity: entityType === 'POI' ? 'poi' : 'tour',
    entityId: targetId,
    actor: requestedBy,
    reason,
    source: 'api',
    metadata: {
      requestId: createdId,
      entityType,
      actionType
    }
  });

  const rows = await prisma.$queryRaw<Array<ApprovalRequestRow>>`
    SELECT
      id,
      entity_type,
      action_type,
      target_id,
      payload,
      status,
      reason,
      decision_note,
      requested_by,
      reviewed_by,
      result_snapshot,
      reviewed_at,
      created_at,
      updated_at
    FROM partner_approval_requests
    WHERE id = ${createdId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new ApiError(500, 'Không thể tạo approval request.');
  }

  return mapRowToItem(rows[0]);
}

export async function listApprovalRequests(filters?: {
  status?: string;
  entityType?: string;
  actionType?: string;
  requestedBy?: string;
}): Promise<ApprovalRequestItem[]> {
  const conditions: string[] = [];
  const values: Array<string> = [];

  if (toTrimmed(filters?.status)) {
    values.push(toStatus(filters?.status as string));
    conditions.push(`status = $${values.length}::"ApprovalStatus"`);
  }

  if (toTrimmed(filters?.entityType)) {
    values.push(toEntityType(filters?.entityType as string));
    conditions.push(`entity_type = $${values.length}::"ApprovalEntityType"`);
  }

  if (toTrimmed(filters?.actionType)) {
    values.push(toActionType(filters?.actionType as string));
    conditions.push(`action_type = $${values.length}::"ApprovalActionType"`);
  }

  if (toTrimmed(filters?.requestedBy)) {
    values.push((filters?.requestedBy as string).trim());
    conditions.push(`requested_by = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT
      id,
      entity_type,
      action_type,
      target_id,
      payload,
      status,
      reason,
      decision_note,
      requested_by,
      reviewed_by,
      result_snapshot,
      reviewed_at,
      created_at,
      updated_at
    FROM partner_approval_requests
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 500
  `;

  const rows = await prisma.$queryRawUnsafe<Array<ApprovalRequestRow>>(query, ...values);
  return rows.map(mapRowToItem);
}

export async function getApprovalRequestById(requestId: string): Promise<ApprovalRequestItem> {
  const normalizedRequestId = toTrimmed(requestId);
  if (!normalizedRequestId) {
    throw new ApiError(400, 'Thiếu requestId hợp lệ.');
  }

  const rows = await prisma.$queryRawUnsafe<Array<ApprovalRequestRow>>(
    `${APPROVAL_REQUEST_SELECT} WHERE id = $1 LIMIT 1`,
    normalizedRequestId
  );

  if (!rows[0]) {
    throw new ApiError(404, 'Không tìm thấy approval request.');
  }

  return mapRowToItem(rows[0]);
}

export async function listApprovalRequestsByRequester(input: {
  requestedBy: string;
  status?: string;
  entityType?: string;
  actionType?: string;
}): Promise<ApprovalRequestItem[]> {
  const requestedBy = toTrimmed(input.requestedBy);
  if (!requestedBy) {
    throw new ApiError(400, 'Thiếu requestedBy hợp lệ.');
  }

  return listApprovalRequests({
    status: input.status,
    entityType: input.entityType,
    actionType: input.actionType,
    requestedBy
  });
}

export async function getApprovalRequestByIdForRequester(input: {
  requestId: string;
  requestedBy: string;
}): Promise<ApprovalRequestItem> {
  const requestedBy = toTrimmed(input.requestedBy);
  if (!requestedBy) {
    throw new ApiError(400, 'Thiếu requestedBy hợp lệ.');
  }

  const item = await getApprovalRequestById(input.requestId);
  if (item.requestedBy !== requestedBy) {
    throw new ApiError(404, 'Không tìm thấy approval request.');
  }

  return item;
}

async function executeApprovedAction(
  item: ApprovalRequestItem,
  reviewerId: string,
  decisionNote: string | undefined,
  tx: any
): Promise<Record<string, unknown>> {
  const actionContext = {
    actor: reviewerId,
    reason: decisionNote ?? `approved request ${item.id}`,
    source: 'approval-workflow'
  };

  if (item.entityType === 'POI') {
    if (item.actionType === 'CREATE') {
      const createPoiPayload = {
        ...(item.payload as Record<string, unknown>),
        creatorId: item.requestedBy
      } as any;

      return (await createAdminPoi(
        createPoiPayload,
        actionContext,
        tx
      )) as unknown as Record<string, unknown>;
    }

    if (!item.targetId) {
      throw new ApiError(400, 'Request thiếu targetId cho thao tác POI.');
    }

    if (item.actionType === 'UPDATE') {
      return (await updateAdminPoi(
        item.targetId,
        item.payload,
        { actorId: item.requestedBy, role: 'PARTNER' },
        actionContext,
        tx
      )) as unknown as Record<string, unknown>;
    }

    return (await deleteAdminPoi(
      item.targetId,
      { actorId: item.requestedBy, role: 'PARTNER' },
      actionContext,
      tx
    )) as unknown as Record<string, unknown>;
  }

  if (item.actionType === 'CREATE') {
    const createTourPayload = {
      ...(item.payload as Record<string, unknown>),
      creatorId: item.requestedBy
    } as any;

    return (await createAdminTour(
      createTourPayload,
      actionContext,
      tx
    )) as unknown as Record<string, unknown>;
  }

  if (!item.targetId) {
    throw new ApiError(400, 'Request thiếu targetId cho thao tác TOUR.');
  }

  if (item.actionType === 'UPDATE') {
    return (await updateAdminTour(
      item.targetId,
      item.payload,
      { actorId: item.requestedBy, role: 'PARTNER' },
      actionContext,
      tx
    )) as unknown as Record<string, unknown>;
  }

  return (await deleteAdminTour(
    item.targetId,
    { actorId: item.requestedBy, role: 'PARTNER' },
    actionContext,
    tx
  )) as unknown as Record<string, unknown>;
}

async function lockApprovalRequestForReview(tx: any, requestId: string): Promise<ApprovalRequestItem> {
  const rows = (await tx.$queryRawUnsafe(
    `${APPROVAL_REQUEST_SELECT} WHERE id = $1 FOR UPDATE`,
    requestId
  )) as Array<ApprovalRequestRow>;

  if (!rows[0]) {
    throw new ApiError(404, 'Không tìm thấy approval request.');
  }

  return mapRowToItem(rows[0]);
}

export async function approvePartnerRequest(input: {
  requestId: string;
  reviewerId: string;
  decisionNote?: string;
}): Promise<ApprovalRequestItem> {
  const requestId = toTrimmed(input.requestId);
  const reviewerId = toTrimmed(input.reviewerId);
  const decisionNote = toTrimmed(input.decisionNote);

  if (!requestId || !reviewerId) {
    throw new ApiError(400, 'Thiếu requestId hoặc reviewerId hợp lệ.');
  }

  return prisma.$transaction(async (tx) => {
    const current = await lockApprovalRequestForReview(tx, requestId);
    if (current.status !== 'PENDING') {
      throw new ApiError(409, 'Request đã được xử lý trước đó.');
    }

    const resultSnapshot = await executeApprovedAction(current, reviewerId, decisionNote, tx);

    await tx.$executeRaw`
      UPDATE partner_approval_requests
      SET
        status = 'APPROVED',
        reviewed_by = ${reviewerId},
        reviewed_at = NOW(),
        decision_note = ${decisionNote ?? null},
        result_snapshot = ${resultSnapshot}::jsonb,
        updated_at = NOW()
      WHERE id = ${requestId}
    `;

    await recordAdminAuditEvent({
      action: 'approval_request.approve',
      entity: current.entityType === 'POI' ? 'poi' : 'tour',
      entityId: current.targetId ?? undefined,
      actor: reviewerId,
      reason: decisionNote,
      source: 'api',
      metadata: {
        requestId: current.id,
        requestedBy: current.requestedBy,
        actionType: current.actionType
      }
    });

    const refreshedRows = (await tx.$queryRawUnsafe(
      `${APPROVAL_REQUEST_SELECT} WHERE id = $1 LIMIT 1`,
      requestId
    )) as Array<ApprovalRequestRow>;

    if (!refreshedRows[0]) {
      throw new ApiError(404, 'Không tìm thấy approval request.');
    }

    const approvedItem = mapRowToItem(refreshedRows[0]);

    if (approvedItem.entityType === 'POI' && approvedItem.actionType !== 'DELETE') {
      const approvedPoiId =
        approvedItem.actionType === 'CREATE'
          ? (approvedItem.resultSnapshot?.id as string | undefined)
          : approvedItem.targetId ?? undefined;

      if (approvedPoiId) {
        enqueuePoiTtsGeneration(approvedPoiId).catch((error) => {
          console.warn('[Approval] Failed to enqueue TTS after approval', {
            requestId: approvedItem.id,
            approvedPoiId,
            error
          });
        });
      }
    }

    return approvedItem;
  });
}

export async function rejectPartnerRequest(input: {
  requestId: string;
  reviewerId: string;
  decisionNote?: string;
}): Promise<ApprovalRequestItem> {
  const requestId = toTrimmed(input.requestId);
  const reviewerId = toTrimmed(input.reviewerId);
  const decisionNote = toTrimmed(input.decisionNote);

  if (!requestId || !reviewerId) {
    throw new ApiError(400, 'Thiếu requestId hoặc reviewerId hợp lệ.');
  }

  return prisma.$transaction(async (tx) => {
    const current = await lockApprovalRequestForReview(tx, requestId);
    if (current.status !== 'PENDING') {
      throw new ApiError(409, 'Request đã được xử lý trước đó.');
    }

    await tx.$executeRaw`
      UPDATE partner_approval_requests
      SET
        status = 'REJECTED',
        reviewed_by = ${reviewerId},
        reviewed_at = NOW(),
        decision_note = ${decisionNote ?? null},
        updated_at = NOW()
      WHERE id = ${requestId}
    `;

    await recordAdminAuditEvent({
      action: 'approval_request.reject',
      entity: current.entityType === 'POI' ? 'poi' : 'tour',
      entityId: current.targetId ?? undefined,
      actor: reviewerId,
      reason: decisionNote,
      source: 'api',
      metadata: {
        requestId: current.id,
        requestedBy: current.requestedBy,
        actionType: current.actionType
      }
    });

    const refreshedRows = (await tx.$queryRawUnsafe(
      `${APPROVAL_REQUEST_SELECT} WHERE id = $1 LIMIT 1`,
      requestId
    )) as Array<ApprovalRequestRow>;

    if (!refreshedRows[0]) {
      throw new ApiError(404, 'Không tìm thấy approval request.');
    }

    return mapRowToItem(refreshedRows[0]);
  });
}
