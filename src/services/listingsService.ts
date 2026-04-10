import { apiGet } from './grpcClient'
import type { Listing, ListingDetail, ListingHistoryItem, ListingsFilter } from '@/types'

interface GetListingsResponse {
  listings: Listing[]
  total: number
}

interface GetListingHistoryResponse {
  history: ListingHistoryItem[]
}

export async function getListings(
  params?: ListingsFilter
): Promise<GetListingsResponse> {
  return apiGet<GetListingsResponse>(
    '/bank/listings',
    params as Record<string, string | number | boolean | undefined>
  )
}

export async function getListingById(id: string): Promise<ListingDetail> {
  return apiGet<ListingDetail>(`/bank/listings/${id}`)
}

function normalizeHistoryRow(raw: Record<string, unknown>): ListingHistoryItem {
  const vol = raw.volume
  const dateVal = raw.date ?? raw.Date
  return {
    date: dateVal == null ? '' : String(dateVal),
    price: Number(raw.price ?? 0),
    askHigh: Number(raw.askHigh ?? raw.ask_high ?? 0),
    bidLow: Number(raw.bidLow ?? raw.bid_low ?? 0),
    priceChange: Number(raw.priceChange ?? raw.price_change ?? 0),
    volume: vol == null ? '' : String(vol),
  }
}

export async function getListingHistory(
  id: string,
  fromDate?: string,
  toDate?: string
): Promise<ListingHistoryItem[]> {
  const res = await apiGet<GetListingHistoryResponse>(
    `/bank/listings/${id}/history`,
    {
      // Ime polja kao u proto (from_date / to_date) — gRPC-Gateway query
      from_date: fromDate,
      to_date: toDate,
    } as Record<string, string | undefined>
  )
  const rows = res.history ?? []
  return rows.map((h) => normalizeHistoryRow(h as unknown as Record<string, unknown>))
}
