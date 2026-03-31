import { apiGet, apiPost } from '@/services/grpcClient'

// gRPC-Gateway serijalizuje proto polja u camelCase JSON:
// name, acronym, mic_code→micCode, polity, currency_id→currencyId, timezone
export interface Exchange {
  id: number | string
  name: string
  acronym: string
  micCode: string
  polity: string
  currencyId: number | string
  timezone: string
}

export interface ListExchangesParams extends Record<string, string | number | boolean | undefined> {
  polity?: string   // filter po državi; "" = sve
  search?: string   // parcijalni match na name ili acronym; "" = sve
}

// GET /bank/exchanges → ListExchangesResponse { exchanges: Exchange[] }
export async function getAllExchanges(
  params?: ListExchangesParams
): Promise<{ exchanges: Exchange[] }> {
  return apiGet<{ exchanges: Exchange[] }>('/bank/exchanges', params)
}

// POST /bank/admin/exchanges/test-mode → Empty (vraća 200 bez tela)
// enabled=true uključuje bypass radnog vremena, false isključuje.
export async function toggleMarketTestMode(enabled: boolean): Promise<void> {
  await apiPost<{ enabled: boolean }, unknown>(
    '/bank/admin/exchanges/test-mode',
    { enabled }
  )
}
