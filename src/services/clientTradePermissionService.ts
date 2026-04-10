/**
 * TRADE_STOCKS za klijenta — user-service HTTP (samo zaposleni).
 * GET/PATCH /client/{id}/trade-permission
 */
import { apiGet, apiPatch } from './grpcClient'

export async function getClientTradePermission(clientId: string): Promise<boolean> {
  const res = await apiGet<{ has_trade_permission: boolean }>(
    `/client/${clientId}/trade-permission`
  )
  return Boolean(res.has_trade_permission)
}

export async function setClientTradePermission(
  clientId: string,
  grant: boolean
): Promise<boolean> {
  const res = await apiPatch<{ grant: boolean }, { has_trade_permission: boolean }>(
    `/client/${clientId}/trade-permission`,
    { grant }
  )
  return Boolean(res.has_trade_permission)
}
