// ─── OTC Types ────────────────────────────────────────────────────────────────

export interface OTCStock {
  ticker: string
  name: string
  exchange: string
  lastKnownMarketPrice?: number
}

export interface OTCOffer {
  id: string
  stock: OTCStock
  amount: number
  pricePerStock: number
  settlementDate: string
  premium: number
  lastModified: string
  modifiedBy: string
  buyerId: string
  sellerId: string
  status: 'ACTIVE' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  // Backend Faza 2: računi za isplatu/prijem premije.
  buyerAccountId?: number
  sellerAccountId?: number | null
  // Backend-computed: true kada modified_by != callerID (nepročitana izmena)
  needsReview?: boolean
}

export interface PartyInfo {
  name: string
  bankName: string
}

export interface OTCContract {
  id: string
  offerId: string
  stock: OTCStock
  amount: number
  strikePrice: number
  premium: number
  settlementDate: string
  sellerInfo: PartyInfo
  buyerInfo: PartyInfo
  status: 'VALID' | 'EXPIRED' | 'EXERCISED'
}

// ─── Fund Types ───────────────────────────────────────────────────────────────

export interface FundSecurity {
  ticker: string
  name: string
  price: number
  change: number
  volume: number
  initialMarginCost: number
  acquisitionDate: string
}

export interface ClientFundPosition {
  id: string
  clientId: string
  clientName: string
  fundId: string
  totalInvestedAmount: number
  fundSharePercentage: number | null
  currentPositionValue: number | null
  lastModifiedDate: string
}

export interface InvestmentFund {
  id: string
  name: string
  description: string
  minimumContribution: number
  managerId: string
  managerName: string
  liquidAssets: number
  fundValueRsd: number | null
  profit: number | null
  accountId: string
  accountNumber: string
  securities: FundSecurity[]
  positions: ClientFundPosition[]
  createdAt: string
}

export interface ClientFundTransaction {
  id: string
  clientId: string
  fundId: string
  amount: number
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  timestamp: string
  isInflow: boolean
  sourceAccountId: string
  targetAccountId: string
}

export interface ActuaryPerformance {
  id: string
  name: string
  surname: string
  role: string
  profit: number
}

export interface FundPerformancePoint {
  period: string
  value: number
}

export type C4UserRole = 'CLIENT' | 'AGENT' | 'SUPERVISOR'
