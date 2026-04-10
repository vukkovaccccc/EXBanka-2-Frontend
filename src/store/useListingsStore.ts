import { create } from 'zustand'
import type { Listing, ListingDetail, ListingHistoryItem, ListingsFilter } from '@/types'
import { getListings, getListingById, getListingHistory } from '@/services/listingsService'

interface ListingsState {
  listings: Listing[]
  total: number
  selectedListing: ListingDetail | null
  priceHistory: ListingHistoryItem[]
  /** Greška samo za /history (ne briše detalj stranice) */
  historyError: string | null
  filters: ListingsFilter
  loading: boolean
  loadingDetail: boolean
  loadingHistory: boolean
  error: string | null

  fetchListings: () => Promise<void>
  fetchListingById: (id: string) => Promise<void>
  fetchListingHistory: (id: string, fromDate?: string, toDate?: string) => Promise<void>
  setFilters: (filters: Partial<ListingsFilter>) => void
  clearSelected: () => void
}

export const useListingsStore = create<ListingsState>((set, get) => ({
  listings: [],
  total: 0,
  selectedListing: null,
  priceHistory: [],
  historyError: null,
  filters: {
    listingType: '',
    sortBy: 'ticker',
    sortOrder: 'ASC',
    page: 1,
    pageSize: 50,
  },
  loading: false,
  loadingDetail: false,
  loadingHistory: false,
  error: null,

  fetchListings: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      const res = await getListings(filters)
      set({ listings: res.listings ?? [], total: res.total ?? 0 })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Greška pri učitavanju hartija' })
    } finally {
      set({ loading: false })
    }
  },

  fetchListingById: async (id: string) => {
    set({ loadingDetail: true, error: null })
    try {
      const detail = await getListingById(id)
      set({ selectedListing: detail })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Greška pri učitavanju detalja' })
    } finally {
      set({ loadingDetail: false })
    }
  },

  fetchListingHistory: async (id: string, fromDate?: string, toDate?: string) => {
    set({ loadingHistory: true, historyError: null })
    try {
      const history = await getListingHistory(id, fromDate, toDate)
      set({ priceHistory: history, historyError: null })
    } catch (err: unknown) {
      set({
        priceHistory: [],
        historyError: err instanceof Error ? err.message : 'Greška pri učitavanju istorije cena',
      })
    } finally {
      set({ loadingHistory: false })
    }
  },

  setFilters: (partial: Partial<ListingsFilter>) => {
    // Resetuj na stranicu 1 samo ako se mijenja filter koji nije sama stranica
    const resetPage = !Object.prototype.hasOwnProperty.call(partial, 'page')
    set((state) => ({
      filters: { ...state.filters, ...partial, ...(resetPage ? { page: 1 } : {}) },
    }))
  },

  clearSelected: () => set({ selectedListing: null, priceHistory: [], historyError: null }),
}))
