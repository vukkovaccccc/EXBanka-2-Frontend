import { apiGet, apiPost, apiPatch } from './grpcClient'
import type {
  ActuaryInfo,
  ActuaryType,
  AgentListItem,
  GetMyActuaryInfoResponse,
  GetActuaryByEmployeeIDRequest,
  GetActuaryByEmployeeIDResponse,
  GetAgentsRequest,
  GetAgentsResponse,
  SetAgentLimitRequest,
  ResetAgentUsedLimitRequest,
  SetAgentNeedApprovalRequest,
  CreateActuaryRequest,
} from '@/types/actuary'

// ─── Backend shapes (gRPC-Gateway camelCase JSON) ─────────────────────────────

interface BackendActuaryInfo {
  id: string
  employeeId: string
  actuaryType: string   // e.g. "ACTUARY_TYPE_SUPERVISOR"
  limit: string
  usedLimit: string
  needApproval: boolean
}

interface BackendAgentListItem {
  id: string
  employeeId: string
  email: string
  firstName: string
  lastName: string
  position: string
  limit: string
  usedLimit: string
  needApproval: boolean
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapActuaryType(raw: string): ActuaryType {
  if (raw === 'ACTUARY_TYPE_SUPERVISOR') return 'ACTUARY_TYPE_SUPERVISOR'
  if (raw === 'ACTUARY_TYPE_AGENT') return 'ACTUARY_TYPE_AGENT'
  return 'ACTUARY_TYPE_UNSPECIFIED'
}

function mapActuaryInfo(b: BackendActuaryInfo): ActuaryInfo {
  return {
    id: String(b.id),
    employee_id: String(b.employeeId),
    actuary_type: mapActuaryType(b.actuaryType),
    limit: b.limit ?? '0',
    used_limit: b.usedLimit ?? '0',
    need_approval: b.needApproval,
  }
}

function mapAgentListItem(b: BackendAgentListItem): AgentListItem {
  return {
    id: String(b.id),
    employee_id: String(b.employeeId),
    email: b.email,
    first_name: b.firstName,
    last_name: b.lastName,
    position: b.position,
    limit: b.limit ?? '0',
    used_limit: b.usedLimit ?? '0',
    need_approval: b.needApproval,
  }
}

// ─── Service functions ─────────────────────────────────────────────────────────

/** Returns the ActuaryInfo for the currently authenticated actuary (from JWT). */
export async function getMyActuaryInfo(): Promise<GetMyActuaryInfoResponse> {
  const res = await apiGet<{ actuary: BackendActuaryInfo }>('/actuary/me')
  return { actuary: mapActuaryInfo(res.actuary) }
}

/** Returns ActuaryInfo for the specified employee (supervisor / internal use). */
export async function getActuaryByEmployeeId(
  request: GetActuaryByEmployeeIDRequest
): Promise<GetActuaryByEmployeeIDResponse> {
  const res = await apiGet<{ actuary: BackendActuaryInfo }>(
    `/actuary/employee/${request.employee_id}`
  )
  return { actuary: mapActuaryInfo(res.actuary) }
}

/**
 * Supervisor only. Returns the filtered list of agents for the actuary portal.
 * All filter fields are optional; omit or pass "" to skip.
 */
export async function getAgents(
  request: GetAgentsRequest = {}
): Promise<GetAgentsResponse> {
  const params: Record<string, string | undefined> = {
    email: request.email || undefined,
    first_name: request.first_name || undefined,
    last_name: request.last_name || undefined,
    position: request.position || undefined,
  }

  const res = await apiGet<{ agents: BackendAgentListItem[] | null }>(
    '/actuary/agents',
    params
  )
  return { agents: (res.agents ?? []).map(mapAgentListItem) }
}

/** Supervisor only. Updates the daily spending limit for the specified agent. */
export async function setAgentLimit(request: SetAgentLimitRequest): Promise<void> {
  await apiPatch<{ limit: string | number }, unknown>(
    `/actuary/agents/${request.employee_id}/limit`,
    { limit: request.limit }
  )
}

/** Supervisor only. Resets the agent's used_limit to 0. */
export async function resetAgentUsedLimit(
  request: ResetAgentUsedLimitRequest
): Promise<void> {
  await apiPost<Record<string, never>, unknown>(
    `/actuary/agents/${request.employee_id}/reset-limit`,
    {}
  )
}

/** Supervisor only. Sets or clears the need_approval flag for the specified agent. */
export async function setAgentNeedApproval(
  request: SetAgentNeedApprovalRequest
): Promise<void> {
  await apiPatch<{ need_approval: boolean }, unknown>(
    `/actuary/agents/${request.employee_id}/need-approval`,
    { need_approval: request.need_approval }
  )
}

/** Supervisor only. Registers an existing employee as an actuary agent. */
export async function createActuary(request: CreateActuaryRequest): Promise<void> {
  await apiPost<{ employee_id: string | number; limit: string | number }, unknown>(
    '/actuary/agents',
    { employee_id: request.employee_id, limit: request.limit }
  )
}
