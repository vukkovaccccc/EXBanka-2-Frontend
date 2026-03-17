import { apiPost } from './grpcClient'
import type { CreateClientRequest } from '@/types'

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
