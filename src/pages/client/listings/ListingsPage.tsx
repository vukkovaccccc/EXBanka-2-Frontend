import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react'
import { useListingsStore } from '@/store/useListingsStore'
import { useAuthStore } from '@/store/authStore'
import type { ListingType } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import ErrorMessage from '@/components/common/ErrorMessage'
import { hartijeDetailPath, hartijeKupovinaPath } from '@/router/helpers'
import { useActuaryAccess } from '@/context/ActuaryAccessContext'

const ALL_TYPE_TABS: { label: string; value: ListingType | '' }[] = [
  { label: 'Sve', value: '' },
  { label: 'Akcije', value: 'STOCK' },
  { label: 'Forex', value: 'FOREX' },
  { label: 'Fjučersi', value: 'FUTURE' },
  { label: 'Opcije', value: 'OPTION' },
]

/** Klijenti ne vide Forex — sve ostale hartije (STOCK, FUTURE, OPTION) su dostupne. */
const CLIENT_ALLOWED_TYPES = new Set<ListingType | ''>(['', 'STOCK', 'FUTURE', 'OPTION'])

/**
 * Za OPTION listing, OCC ticker kodira datum isteka: {UNDERLYING}{YYMMDD}{C|P}{STRIKE8}.
 * Vraća true ako je opcija istekla (datum u prošlosti).
 */
function isOptionExpiredByTicker(ticker: string): boolean {
  if (ticker.length < 15) return false
  const fixed = ticker.slice(-15)
  const yy = parseInt(fixed.slice(0, 2), 10)
  const mm = parseInt(fixed.slice(2, 4), 10)
  const dd = parseInt(fixed.slice(4, 6), 10)
  if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return false
  const expiry = new Date(2000 + yy, mm - 1, dd)
  expiry.setHours(23, 59, 59, 999)
  return expiry < new Date()
}

const SORT_OPTIONS = [
  { label: 'Ticker (A-Z)', value: 'ticker', order: 'ASC' },
  { label: 'Ticker (Z-A)', value: 'ticker', order: 'DESC' },
  { label: 'Cena ↑', value: 'price', order: 'ASC' },
  { label: 'Cena ↓', value: 'price', order: 'DESC' },
  { label: 'Volumen ↓', value: 'volume', order: 'DESC' },
]

export default function ListingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { canAccessTradingPortals } = useActuaryAccess()
  const isClient = user?.userType === 'CLIENT'
  const showBuyButton =
    user?.userType === 'ADMIN' ||
    (user?.userType === 'EMPLOYEE' && canAccessTradingPortals) ||
    (user?.userType === 'CLIENT' && canAccessTradingPortals)

  const {
    listings,
    total,
    loading,
    error,
    filters,
    setFilters,
    fetchListings,
  } = useListingsStore()

  const typeTabs = useMemo(() => {
    // Klijenti ne vide FOREX; sve ostalo (STOCK, FUTURE, OPTION) dostupno svima.
    if (isClient) {
      return ALL_TYPE_TABS.filter((t) => CLIENT_ALLOWED_TYPES.has(t.value))
    }
    return ALL_TYPE_TABS
  }, [isClient])

  // Ako je klijent ostao na Forex/Opcije iz prethodne sesije, vrati na Sve
  useEffect(() => {
    if (isClient && filters.listingType && !CLIENT_ALLOWED_TYPES.has(filters.listingType)) {
      setFilters({ listingType: '' })
    }
  }, [isClient, filters.listingType, setFilters])

  // Osvežavaj listu kada se menjaju filteri
  useEffect(() => {
    fetchListings()
  }, [filters])

  // Automatsko osvežavanje svakih 60 sekundi (Scenario 17)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchListings()
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split('|')
    setFilters({ sortBy: sortBy as 'price' | 'volume' | 'change' | 'ticker', sortOrder: sortOrder as 'ASC' | 'DESC' })
  }

  const currentSortValue = `${filters.sortBy ?? 'ticker'}|${filters.sortOrder ?? 'ASC'}`

  return (
    <div className="space-y-6">
      {/* Naslov */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Hartije od vrednosti</h1>
        <button
          onClick={() => fetchListings()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Osveži
        </button>
      </div>

      {/* Filteri */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        {/* Tab bar — tip hartije */}
        <div className="flex gap-1 flex-wrap">
          {typeTabs.map(({ label, value }) => (
            <button
              key={value}
              onClick={() =>
                setFilters({
                  listingType: value,
                  // Resetuj sve range/date filtere pri promeni tipa —
                  // svaki tip ima drugačije relevantne opsege (npr. opcije nemaju volumen).
                  // Pretraga i sortiranje se zadržavaju.
                  minPrice: undefined,
                  maxPrice: undefined,
                  minVolume: undefined,
                  maxVolume: undefined,
                  settlementFrom: undefined,
                  settlementTo: undefined,
                })
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.listingType === value
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pretraga i sortiranje */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Pretraži po Ticker-u ili Nazivu..."
            value={filters.search ?? ''}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select
            value={currentSortValue}
            onChange={handleSortChange}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.value}|${opt.order}`} value={`${opt.value}|${opt.order}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Opsezi cena i volumena */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-500 whitespace-nowrap">Cena od</span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={filters.minPrice ?? ''}
              onChange={(e) =>
                setFilters({ minPrice: e.target.value ? Number(e.target.value) : undefined })
              }
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">do</span>
            <input
              type="number"
              min={0}
              placeholder="∞"
              value={filters.maxPrice ?? ''}
              onChange={(e) =>
                setFilters({ maxPrice: e.target.value ? Number(e.target.value) : undefined })
              }
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-500 whitespace-nowrap">Vol. min</span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={filters.minVolume ?? ''}
              onChange={(e) =>
                setFilters({ minVolume: e.target.value ? Number(e.target.value) : undefined })
              }
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">max</span>
            <input
              type="number"
              min={0}
              placeholder="∞"
              value={filters.maxVolume ?? ''}
              onChange={(e) =>
                setFilters({ maxVolume: e.target.value ? Number(e.target.value) : undefined })
              }
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>

        {/* Datum dospeća — fjučersi i opcije (i „Sve“) */}
        {(filters.listingType === '' ||
          filters.listingType === 'FUTURE' ||
          filters.listingType === 'OPTION') && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 sm:self-center sm:min-w-[140px]">
              Datum isteka (settlement)
            </p>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <span className="text-xs text-gray-500">Od</span>
              <input
                type="date"
                value={filters.settlementFrom ?? ''}
                onChange={(e) =>
                  setFilters({ settlementFrom: e.target.value || undefined })
                }
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <span className="text-xs text-gray-500">Do</span>
              <input
                type="date"
                value={filters.settlementTo ?? ''}
                onChange={(e) =>
                  setFilters({ settlementTo: e.target.value || undefined })
                }
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorMessage message={error} />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Nema hartija koje odgovaraju filterima.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ticker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">
                      Naziv
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Cena
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Promena %
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Volumen
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Init. Margin
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listings.map((listing) => {
                    const isPositive = listing.changePercent >= 0
                    const isExpiredOption = listing.listingType === 'OPTION' && isOptionExpiredByTicker(listing.ticker)

                    return (
                      <tr
                        key={listing.id}
                        onClick={() => navigate(hartijeDetailPath(listing.id))}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors${isExpiredOption ? ' opacity-60' : ''}`}
                      >
                        {/* Ticker + tip */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">
                              {listing.ticker}
                            </span>
                            <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 uppercase">
                              {listing.listingType}
                            </span>
                          </div>
                        </td>

                        {/* Naziv */}
                        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell max-w-xs truncate">
                          {listing.name}
                        </td>

                        {/* Cena */}
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-900">
                          ${listing.price.toFixed(4)}
                        </td>

                        {/* Promena % */}
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`flex items-center justify-end gap-1 text-sm font-medium ${
                              isPositive ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            {isPositive ? '+' : ''}
                            {listing.changePercent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Volumen */}
                        <td className="px-4 py-3 text-right text-sm text-gray-600 font-mono">
                          {parseInt(listing.volume, 10).toLocaleString()}
                        </td>

                        {/* Initial Margin Cost */}
                        <td className="px-4 py-3 text-right text-sm text-gray-600 font-mono">
                          ${listing.initialMarginCost.toFixed(2)}
                        </td>

                        {/* Akcije */}
                        <td
                          className="px-4 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {showBuyButton ? (
                            isExpiredOption ? (
                              <span
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-400 text-xs font-medium cursor-not-allowed"
                                title="Opcija je istekla"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Isteklo
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(hartijeKupovinaPath(listing.id))
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Kupi
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer sa paginacijom */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Prikazano {((filters.page ?? 1) - 1) * (filters.pageSize ?? 50) + 1}–
                {Math.min((filters.page ?? 1) * (filters.pageSize ?? 50), total)} od {total} hartija
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters({ page: Math.max(1, (filters.page ?? 1) - 1) })}
                  disabled={(filters.page ?? 1) <= 1 || loading}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prethodno
                </button>
                <span className="text-xs text-gray-500">
                  Str. {filters.page ?? 1} / {Math.max(1, Math.ceil(total / (filters.pageSize ?? 50)))}
                </span>
                <button
                  onClick={() => setFilters({ page: (filters.page ?? 1) + 1 })}
                  disabled={(filters.page ?? 1) >= Math.ceil(total / (filters.pageSize ?? 50)) || loading}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Sledeće ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
