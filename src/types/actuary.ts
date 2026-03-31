// ─── Actuary Types ────────────────────────────────────────────────────────────
// Mirrors actuary.v1 proto messages.
// NOTE: limit and used_limit are proto `double` but the Go backend JSON-serialises
// them as string to avoid float precision loss — kept as string here accordingly.

export type ActuaryType = 'ACTUARY_TYPE_UNSPECIFIED' | 'ACTUARY_TYPE_SUPERVISOR' | 'ACTUARY_TYPE_AGENT'

// ─── Core domain ─────────────────────────────────────────────────────────────

/** Mirrors proto ActuaryInfo. Supervisors have limit="0", used_limit="0", need_approval=false. */
export interface ActuaryInfo {
  id: string            // int64 as string (proto JSON)
  employee_id: string   // int64 as string
  actuary_type: ActuaryType
  limit: string         // daily spending limit (RSD); serialised as string by backend
  used_limit: string    // amount consumed today; serialised as string by backend
  need_approval: boolean
}

/** Per-row projection for the supervisor portal (ActuaryInfo + user fields). */
export interface AgentListItem {
  id: string            // actuary_info id (int64 as string)
  employee_id: string   // int64 as string
  email: string
  first_name: string
  last_name: string
  position: string
  limit: string         // serialised as string by backend
  used_limit: string    // serialised as string by backend
  need_approval: boolean
}

// ─── Request / Response contracts ────────────────────────────────────────────

// GetMyActuaryInfo
export interface GetMyActuaryInfoResponse {
  actuary: ActuaryInfo
}

// GetActuaryByEmployeeID
export interface GetActuaryByEmployeeIDRequest {
  employee_id: string | number
}

export interface GetActuaryByEmployeeIDResponse {
  actuary: ActuaryInfo
}

// GetAgents (all filter fields optional; omit or pass "" to skip)
export interface GetAgentsRequest {
  email?: string
  first_name?: string
  last_name?: string
  position?: string
}

export interface GetAgentsResponse {
  agents: AgentListItem[]
}

// SetAgentLimit
export interface SetAgentLimitRequest {
  employee_id: string | number
  limit: string | number  // new limit value (>= 0)
}

// ResetAgentUsedLimit
export interface ResetAgentUsedLimitRequest {
  employee_id: string | number
}

// SetAgentNeedApproval
export interface SetAgentNeedApprovalRequest {
  employee_id: string | number
  need_approval: boolean
}

// CreateActuary (supervisor assigns an employee as an agent)
export interface CreateActuaryRequest {
  employee_id: string | number
  limit: string | number
}
