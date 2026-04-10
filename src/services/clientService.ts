import { apiGet, apiPatch, apiPost } from './grpcClient'
import type { Client, ClientDetail, CreateClientRequest, ListClientsParams, ListClientsResponse, UpdateClientRequest } from '@/types'

// ── Trade permission helpers ───────────────────────────────────────────────────

export async function getClientTradePermission(id: string): Promise<boolean> {
  const res = await apiGet<{ has_trade_permission: boolean }>(`/client/${id}/trade-permission`)
  return res.has_trade_permission
}

export async function setClientTradePermission(id: string, grant: boolean): Promise<void> {
  await apiPatch<{ grant: boolean }, unknown>(`/client/${id}/trade-permission`, { grant })
}

// ── Backend shapes (gRPC-Gateway returns camelCase) ───────────────────────────

interface BackendClient {
  id: number | string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
}

interface BackendClientDetail extends BackendClient {
  address: string
  dateOfBirth: number | string  // gRPC-Gateway serialises int64 as string
  gender: string                // proto enum name e.g. "GENDER_FEMALE"
}

interface BackendListClientsResponse {
  clients: BackendClient[] | null
  hasMore: boolean
}

interface BackendGetClientResponse {
  client: BackendClientDetail
}

function mapClient(c: BackendClient): Client {
  return {
    id: String(c.id),
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone_number: c.phoneNumber,
  }
}

export async function getClientById(id: string): Promise<ClientDetail> {
  const res = await apiGet<BackendGetClientResponse>(`/client/${id}`)
  const c = res.client
  return {
    id:           String(c.id),
    first_name:   c.firstName,
    last_name:    c.lastName,
    email:        c.email,
    phone_number: c.phoneNumber,
    address:      c.address,
    date_of_birth: Number(c.dateOfBirth),
    gender:       c.gender.replace('GENDER_', ''),
  }
}

export async function updateClient(id: string, req: UpdateClientRequest): Promise<void> {
  await apiPatch<UpdateClientRequest, unknown>(`/client/${id}`, req)
}

export async function getClients(params: ListClientsParams = {}): Promise<ListClientsResponse> {
  const query: Record<string, string | number | undefined> = {
    limit:  params.limit  ?? 20,
    offset: params.offset ?? 0,
  }
  if (params.name?.trim())  query['name']  = params.name.trim()
  if (params.email?.trim()) query['email'] = params.email.trim()

  const res = await apiGet<BackendListClientsResponse>('/client', query)
  return {
    clients:  (res.clients ?? []).map(mapClient),
    has_more: res.hasMore,
  }
}

function genderToProtoNum(g: string): number {
  switch (g) {
    case 'MALE':   return 1
    case 'FEMALE': return 2
    default:       return 0
  }
}

function dateToUnixMs(dateStr: string): number {
  if (!dateStr) return 0
  return new Date(dateStr).getTime()
}

export async function createClient(
  request: CreateClientRequest
): Promise<{ id: string; email: string }> {
  const body = {
    email:        request.email,
    first_name:   request.first_name,
    last_name:    request.last_name,
    birth_date:   dateToUnixMs(request.date_of_birth),
    gender:       genderToProtoNum(request.gender),
    phone_number: request.phone,
    address:      request.address,
  }
  const res = await apiPost<typeof body, { id: string | number; email: string }>('/client', body)
  return { id: String(res.id), email: res.email }
}
