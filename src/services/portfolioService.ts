/**
 * Portfolio API service — Moj Portfolio portal.
 * Endpoints: /bank/portfolio/*, /bank/tax/*, /bank/funds/*
 */

import { apiGet, apiPost } from './grpcClient'

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface HoldingItem {
  listingId: string
  ticker: string
  name: string
  listingType: 'STOCK' | 'FOREX' | 'FUTURE' | 'OPTION'
  quantity: number
  currentPrice: number
  avgBuyPrice: number
  profit: number
  lastModified: string
  accountId: string
  publicShares: number
  detailsJson: string
}

export interface PortfolioResponse {
  holdings: HoldingItem[]
  totalProfit: number
  taxPaidRsd: number
  taxUnpaid: number
}

export async function getMyPortfolio(): Promise<PortfolioResponse> {
  const res = await apiGet<PortfolioResponse>('/bank/portfolio/my')
  return {
    holdings:     res.holdings ?? [],
    totalProfit:  res.totalProfit ?? 0,
    taxPaidRsd:   res.taxPaidRsd ?? 0,
    taxUnpaid:    res.taxUnpaid ?? 0,
  }
}

export async function publishShares(listingId: string, quantity: number): Promise<void> {
  await apiPost('/bank/portfolio/publish', { listingId, quantity })
}

export interface ExerciseResult {
  message: string
  netProfit: number
  totalShares: number
  strikePrice: number
  marketPrice: number
  optionType: string
}

export async function exerciseOption(listingId: string): Promise<ExerciseResult> {
  return apiPost<{ listingId: string }, ExerciseResult>(
    '/bank/portfolio/exercise',
    { listingId }
  )
}

// ─── Tax (supervisor) ─────────────────────────────────────────────────────────

export interface TaxUserRecord {
  userId: string
  userType: 'CLIENT' | 'ACTUARY'
  taxDebt: number
}

export interface TaxUsersResponse {
  users: TaxUserRecord[]
}

export async function getTaxUsers(): Promise<TaxUsersResponse> {
  const res = await apiGet<TaxUsersResponse>('/bank/tax/users')
  return { users: res.users ?? [] }
}

export interface TaxCalculateResponse {
  processedUsers: number
  totalCollectedRsd: number
  message: string
}

export async function calculateAndCollectTax(): Promise<TaxCalculateResponse> {
  return apiPost<Record<string, never>, TaxCalculateResponse>(
    '/bank/tax/calculate',
    {}
  )
}

// ─── Funds ────────────────────────────────────────────────────────────────────

export interface ClientFund {
  id: string
  name: string
  description: string
  fundValueRsd: number
  sharePercent: number
  shareRsd: number
  profit: number
  investedRsd: number
}

export interface ManagedFund {
  id: string
  name: string
  description: string
  fundValueRsd: number
  liquidityRsd: number
}

export interface FundsResponse {
  clientFunds?: ClientFund[]
  managedFunds?: ManagedFund[]
}

export async function getFunds(): Promise<FundsResponse> {
  const res = await apiGet<FundsResponse>('/bank/funds')
  return {
    clientFunds:  res.clientFunds  ?? [],
    managedFunds: res.managedFunds ?? [],
  }
}

export async function investInFund(
  fundId: string,
  accountId: string,
  amount: number
): Promise<void> {
  await apiPost(`/bank/funds/${fundId}/invest`, { accountId, amount })
}

export async function withdrawFromFund(
  fundId: string,
  accountId: string,
  amountRsd: number,
  withdrawAll: boolean
): Promise<void> {
  await apiPost(`/bank/funds/${fundId}/withdraw`, { accountId, amountRsd, withdrawAll })
}
