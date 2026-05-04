import { create } from 'zustand'
import { useAuthStore } from '@/store/authStore'
import type {
  OTCOffer,
  OTCContract,
  InvestmentFund,
  ClientFundPosition,
  ActuaryPerformance,
  FundPerformancePoint,
} from '@/types/celina4'

// ─── Adapter: backend OTC offer DTO → frontend OTCOffer shape ────────────────
// Backend vraća flat polja (ticker, stockName, exchange, status PENDING/...) i
// numeričke ID-jeve. Frontend tipovi koriste nested { stock: {...} } i statuse
// ACTIVE/ACCEPTED/REJECTED/EXPIRED — ovaj helper preslikava bez razbijanja
// postojećih komponenti.
interface BackendOfferDTO {
  id: number
  listingId: number
  ticker?: string
  stockName?: string
  exchange?: string
  sellerId: number | string
  buyerId: number | string
  buyerAccountId: number
  sellerAccountId?: number | null
  amount: number
  pricePerStock: number
  premium: number
  settlementDate: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'DEACTIVATED'
  lastModified: string
  modifiedBy: number | string
  marketPriceUsd?: number
  needsReview?: boolean
}

function adaptOffer(b: BackendOfferDTO): OTCOffer & {
  buyerAccountId?: number
  sellerAccountId?: number | null
} {
  const statusMap: Record<BackendOfferDTO['status'], OTCOffer['status']> = {
    PENDING: 'ACTIVE',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    DEACTIVATED: 'EXPIRED',
  }
  return {
    id: String(b.id),
    stock: {
      ticker: b.ticker ?? '',
      name: b.stockName ?? b.ticker ?? '',
      exchange: b.exchange ?? '',
      lastKnownMarketPrice: b.marketPriceUsd,
    },
    amount: b.amount,
    pricePerStock: b.pricePerStock,
    premium: b.premium,
    settlementDate: b.settlementDate,
    lastModified: b.lastModified,
    modifiedBy: String(b.modifiedBy),
    buyerId: String(b.buyerId),
    sellerId: String(b.sellerId),
    status: statusMap[b.status] ?? 'EXPIRED',
    buyerAccountId: b.buyerAccountId,
    sellerAccountId: b.sellerAccountId ?? null,
    needsReview: b.needsReview ?? false,
  }
}

// ─── Adapter: backend OTC contract DTO → frontend OTCContract shape ──────────
// Backend vraća flat polja (ticker, stockName, exchange, currentPrice, sellerInfo
// kao string). Frontend tipovi koriste nested { stock: {...}, sellerInfo: {...} }.
interface BackendContractDTO {
  id: number
  offerId: number
  listingId: number
  ticker: string
  stockName: string
  exchange?: string
  sellerId: number
  buyerId: number
  buyerAccountId: number
  sellerAccountId: number
  amount: number
  strikePrice: number
  premium: number
  settlementDate: string
  status: string
  createdAt: string
  exercisedAt?: string | null
  currentPrice: number
  profit: number
  sellerInfo: string
  sellerName: string
  sellerBankName: string
}

function adaptContract(b: BackendContractDTO): OTCContract {
  return {
    id: String(b.id),
    offerId: String(b.offerId),
    stock: {
      ticker: b.ticker ?? '',
      name: b.stockName ?? '',
      exchange: b.exchange ?? '',
      lastKnownMarketPrice: b.currentPrice,
    },
    amount: b.amount,
    strikePrice: b.strikePrice,
    premium: b.premium,
    settlementDate: b.settlementDate,
    sellerInfo: {
      name: b.sellerName ?? '',
      bankName: b.sellerBankName ?? '',
    },
    buyerInfo: { name: '', bankName: '' },
    status: b.status as OTCContract['status'],
  }
}

export type SagaStatus = 'idle' | 'pending' | 'success' | 'failure'

// API_BASE: dev koristi vite proxy koji hvata /api/*, prod-nginx isto.
// Path-evi u ovom store-u već uključuju "/api/" — ako je VITE_API_BASE_URL
// postavljen na "/api", "${API_BASE}/api/..." bi se poklapao u "/api/api/..."
// (što vraća 404 jer pada na catch-all proxy ka user-service-u). Zato koristimo
// API_BASE samo kad je eksplicitno postavljen na nešto što NE završava sa "/api".
const RAW_BASE = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? ''
const API_BASE = RAW_BASE.replace(/\/api\/?$/, '')

function authHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState()
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
  if (!res.ok && res.status !== 202) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.message ?? res.statusText) as Error & { response: { data: unknown; status: number } }
    err.response = { data: body, status: res.status }
    throw err
  }
  const data = await res.json().catch(() => ({} as T))
  return { data, status: res.status }
}

interface Celina4State {
  // OTC – Offers
  offers: OTCOffer[]
  offersLoading: boolean
  offersError: string | null
  activeOffer: OTCOffer | null
  activeOfferLoading: boolean
  // OTC – Contracts
  contracts: OTCContract[]
  contractsLoading: boolean
  activeContract: OTCContract | null
  unreadCount: number
  // Funds
  funds: InvestmentFund[]
  fundsLoading: boolean
  fundsError: string | null
  activeFund: InvestmentFund | null
  activeFundLoading: boolean
  myFundPositions: ClientFundPosition[]
  myPositionsLoading: boolean
  performanceData: FundPerformancePoint[]
  performanceLoading: boolean
  bankFundPositions: ClientFundPosition[]
  bankPositionsLoading: boolean
  actuaryPerformances: ActuaryPerformance[]
  actuaryLoading: boolean
  // Saga-status (replaces Redux-Saga SAGAStatus action)
  sagaStatus: SagaStatus
  sagaStatusMessage: string | null

  // OTC Actions
  fetchOffers: () => Promise<void>
  fetchOfferDetail: (id: string) => Promise<void>
  counterOffer: (id: string, data: Partial<Pick<OTCOffer, 'amount' | 'pricePerStock' | 'premium' | 'settlementDate'>> & { sellerAccountId?: number }) => Promise<void>
  acceptOffer: (id: string, sellerAccountId?: number) => Promise<void>
  rejectOffer: (id: string) => Promise<void>
  markOfferRead: (id: string) => Promise<void>
  fetchContracts: () => Promise<void>
  fetchContractDetail: (id: string) => Promise<void>
  executeContract: (id: string) => Promise<void>
  // Fund Actions
  fetchFunds: (params?: { name?: string; sortBy?: string }) => Promise<void>
  fetchFundDetail: (id: string) => Promise<void>
  createFund: (data: Pick<InvestmentFund, 'name' | 'description' | 'minimumContribution'>) => Promise<void>
  investInFund: (id: string, amount: number, accountId: string) => Promise<void>
  redeemFromFund: (id: string, amount: number, accountId: string) => Promise<{ liquidation: boolean }>
  sellFundSecurity: (fundId: string, ticker: string) => Promise<void>
  fetchMyPositions: () => Promise<void>
  fetchFundPerformance: (id: string, period: 'monthly' | 'quarterly' | 'yearly') => Promise<void>
  fetchActuaryPerformance: () => Promise<void>
  fetchBankFundPositions: () => Promise<void>
  setSagaStatus: (status: SagaStatus, message?: string) => void
  setUnreadCount: (count: number) => void
}

export const useCelina4Store = create<Celina4State>((set, get) => ({
  // Initial State
  offers: [],
  offersLoading: false,
  offersError: null,
  activeOffer: null,
  activeOfferLoading: false,
  contracts: [],
  contractsLoading: false,
  activeContract: null,
  unreadCount: 0,
  funds: [],
  fundsLoading: false,
  fundsError: null,
  activeFund: null,
  activeFundLoading: false,
  myFundPositions: [],
  myPositionsLoading: false,
  performanceData: [],
  performanceLoading: false,
  bankFundPositions: [],
  bankPositionsLoading: false,
  actuaryPerformances: [],
  actuaryLoading: false,
  sagaStatus: 'idle',
  sagaStatusMessage: null,

  // ── OTC Offers ────────────────────────────────────────────────────────────

  fetchOffers: async () => {
    set({ offersLoading: true, offersError: null })
    try {
      const { data: raw } = await apiFetch<BackendOfferDTO[]>('/api/otc/offers')
      const offers = (raw ?? []).map(adaptOffer)
      const unreadCount = offers.filter(o => o.needsReview && o.status === 'ACTIVE').length
      set({ offers, offersLoading: false, unreadCount })
    } catch (e: unknown) {
      set({ offersLoading: false, offersError: String(e) })
    }
  },

  fetchOfferDetail: async (id) => {
    set({ activeOfferLoading: true })
    try {
      const { data } = await apiFetch<BackendOfferDTO>(`/api/otc/offers/${id}`)
      set({ activeOffer: adaptOffer(data), activeOfferLoading: false })
    } catch {
      set({ activeOfferLoading: false })
    }
  },

  counterOffer: async (id, data) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      // Backend očekuje YYYY-MM-DD za settlementDate.
      const body = {
        amount: data.amount,
        pricePerStock: data.pricePerStock,
        premium: data.premium,
        settlementDate: (data.settlementDate ?? '').slice(0, 10),
        ...(data as { sellerAccountId?: number }).sellerAccountId !== undefined
          ? { sellerAccountId: (data as { sellerAccountId?: number }).sellerAccountId }
          : {},
      }
      await apiFetch(`/api/otc/offers/${id}/counter`, { method: 'PATCH', body: JSON.stringify(body) })
      set({ sagaStatus: 'success', sagaStatusMessage: 'Kontraponuda je poslata.' })
      await get().fetchOffers()
      await get().fetchOfferDetail(id)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
    }
  },

  acceptOffer: async (id, sellerAccountId) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      const body = sellerAccountId !== undefined && sellerAccountId !== null
        ? JSON.stringify({ sellerAccountId })
        : undefined
      await apiFetch(`/api/otc/offers/${id}/accept`, {
        method: 'PATCH',
        ...(body ? { body } : {}),
      })
      set({ sagaStatus: 'success', sagaStatusMessage: 'Ponuda je prihvaćena. Ugovor je kreiran i premija je isplaćena.' })
      await get().fetchOffers()
      await get().fetchContracts()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
    }
  },

  rejectOffer: async (id) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      // Backend: PATCH /decline pokriva i odbijanje (REJECTED) i povlačenje
      // (DEACTIVATED) — odluka se donosi po modified_by vs caller.
      await apiFetch(`/api/otc/offers/${id}/decline`, { method: 'PATCH' })
      set({ sagaStatus: 'success', sagaStatusMessage: 'Ponuda je odbijena/povučena.' })
      await get().fetchOffers()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
    }
  },

  markOfferRead: async () => {
    // needsReview se računa na backendu (modifiedBy !== callerID); refresh vraća
    // ažuriranu vrednost bez potrebe za lokalnim timestamp-om.
    await get().fetchOffers()
  },

  // ── OTC Contracts ─────────────────────────────────────────────────────────

  fetchContracts: async () => {
    set({ contractsLoading: true })
    try {
      const { data } = await apiFetch<BackendContractDTO[]>('/api/otc/contracts')
      set({ contracts: (data ?? []).map(adaptContract), contractsLoading: false })
    } catch {
      set({ contractsLoading: false })
    }
  },

  fetchContractDetail: async (id) => {
    try {
      const { data } = await apiFetch<BackendContractDTO>(`/api/otc/contracts/${id}`)
      set({ activeContract: adaptContract(data) })
    } catch {
      // handled in component
    }
  },

  executeContract: async (id) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      await apiFetch(`/api/otc/contracts/${id}/execute`, { method: 'POST' })
      set({ sagaStatus: 'success', sagaStatusMessage: 'Ugovor je uspešno iskorišćen.' })
      const { data } = await apiFetch<BackendContractDTO[]>('/api/otc/contracts')
      set({ contracts: (data ?? []).map(adaptContract) })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
    }
  },

  // ── Funds ─────────────────────────────────────────────────────────────────

  fetchFunds: async (params) => {
    set({ fundsLoading: true, fundsError: null })
    try {
      const qs = new URLSearchParams()
      if (params?.name) qs.set('search', params.name)
      if (params?.sortBy) qs.set('sortBy', params.sortBy)
      const { data } = await apiFetch<{ funds: InvestmentFund[] }>(`/api/bank/investment-funds${qs.toString() ? `?${qs}` : ''}`)
      set({ funds: data.funds ?? [], fundsLoading: false })
    } catch (e: unknown) {
      set({ fundsLoading: false, fundsError: String(e) })
    }
  },

  fetchFundDetail: async (id) => {
    set({ activeFundLoading: true })
    try {
      const { data } = await apiFetch<InvestmentFund>(`/api/bank/investment-funds/${id}`)
      set({ activeFund: data, activeFundLoading: false })
    } catch {
      set({ activeFundLoading: false })
    }
  },

  createFund: async (data) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      const { data: created } = await apiFetch<InvestmentFund>('/api/bank/investment-funds', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      set(s => ({ funds: [...s.funds, created], sagaStatus: 'success', sagaStatusMessage: 'Fond je uspešno kreiran.' }))
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
      throw e
    }
  },

  investInFund: async (id, amount, accountId) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      await apiFetch(`/api/bank/funds/${id}/invest`, {
        method: 'POST',
        body: JSON.stringify({ amount, accountId }),
      })
      set({ sagaStatus: 'success', sagaStatusMessage: 'Uplata je uspešno izvršena.' })
      await get().fetchFundDetail(id)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
    }
  },

  redeemFromFund: async (id, amount, accountId) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    const { accessToken } = useAuthStore.getState()
    try {
      const res = await fetch(`${API_BASE}/api/bank/funds/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ amount, accountId }),
      })
      if (res.status === 202) {
        set({
          sagaStatus: 'success',
          sagaStatusMessage:
            'Vaš zahtev je primljen. Potrebna likvidacija hartija je pokrenuta. Isplata će biti obavljena u kratkom vremenskom roku.',
        })
        return { liquidation: true }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        set({ sagaStatus: 'failure', sagaStatusMessage: body.message ?? 'Greška pri isplati.' })
        throw new Error(body.message)
      }
      set({ sagaStatus: 'success', sagaStatusMessage: 'Isplata je uspešno izvršena.' })
      await get().fetchFundDetail(id)
      return { liquidation: false }
    } catch (e: unknown) {
      if (get().sagaStatus !== 'failure') {
        set({ sagaStatus: 'failure', sagaStatusMessage: String(e) })
      }
      return { liquidation: false }
    }
  },

  sellFundSecurity: async (fundId, ticker) => {
    set({ sagaStatus: 'pending', sagaStatusMessage: null })
    try {
      await apiFetch(`/api/bank/funds/${fundId}/sell/${ticker}`, { method: 'POST' })
      set({ sagaStatus: 'success', sagaStatusMessage: `Hartija ${ticker} je prodata.` })
      await get().fetchFundDetail(fundId)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e)
      set({ sagaStatus: 'failure', sagaStatusMessage: msg })
    }
  },

  fetchMyPositions: async () => {
    set({ myPositionsLoading: true })
    try {
      const { data } = await apiFetch<ClientFundPosition[]>('/api/bank/funds/my-positions')
      set({ myFundPositions: data, myPositionsLoading: false })
    } catch {
      set({ myPositionsLoading: false })
    }
  },

  fetchFundPerformance: async (id, period) => {
    set({ performanceLoading: true })
    try {
      const { data } = await apiFetch<FundPerformancePoint[]>(`/api/bank/funds/${id}/performance?period=${period}`)
      set({ performanceData: data, performanceLoading: false })
    } catch {
      set({ performanceLoading: false })
    }
  },

  fetchActuaryPerformance: async () => {
    set({ actuaryLoading: true })
    try {
      const { data } = await apiFetch<ActuaryPerformance[]>('/api/bank/actuary-performance')
      set({ actuaryPerformances: data, actuaryLoading: false })
    } catch {
      set({ actuaryLoading: false })
    }
  },

  fetchBankFundPositions: async () => {
    set({ bankPositionsLoading: true })
    try {
      const { data } = await apiFetch<ClientFundPosition[]>('/api/bank/fund-positions')
      set({ bankFundPositions: data, bankPositionsLoading: false })
    } catch {
      set({ bankPositionsLoading: false })
    }
  },

  setSagaStatus: (status, message) => set({ sagaStatus: status, sagaStatusMessage: message ?? null }),
  setUnreadCount: (count) => set({ unreadCount: count }),
}))
