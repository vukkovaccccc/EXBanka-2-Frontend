import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { useListingsStore } from '@/store/useListingsStore'
import { useAuthStore } from '@/store/authStore'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import ErrorMessage from '@/components/common/ErrorMessage'
import OptionsMatrix from './OptionsMatrix'
import OptionsExpiryApproach2 from './OptionsExpiryApproach2'
import { hartijeListPath, hartijeKupovinaPath } from '@/router/helpers'
import { useActuaryAccess } from '@/context/ActuaryAccessContext'

function extractOptionUnderlying(ticker: string): string {
  let end = 0
  while (end < ticker.length && /[A-Za-z]/.test(ticker[end])) end++
  return ticker.slice(0, end)
}

const PERIOD_BUTTONS: { label: string; days: number }[] = [
  { label: '1D', days: 1 },
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 1825 },
]

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

/** Parsira vrednost sa ose / API-ja; Recharts često prosleđuje broj (ms) ili Date, ne samo string. */
function toValidDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const parsed = Date.parse(s)
  if (!Number.isNaN(parsed)) return new Date(parsed)
  return null
}

function formatChartDate(value: unknown, activePeriod: number): string {
  const d = toValidDate(value)
  if (!d) {
    return typeof value === 'string' && value.trim() ? value : '—'
  }
  if (activePeriod <= 1) {
    return d.toLocaleString('sr-RS', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  if (activePeriod <= 7) {
    return d.toLocaleString('sr-RS', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  if (activePeriod <= 30) {
    return d.toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' })
  }
  if (activePeriod <= 365) {
    return d.toLocaleDateString('sr-RS', { month: 'short', year: '2-digit' })
  }
  return d.toLocaleDateString('sr-RS', { month: 'short', year: 'numeric' })
}

function getXAxisInterval(activePeriod: number, dataLen: number): number | 'preserveStartEnd' {
  if (dataLen <= 10) return 0
  if (activePeriod <= 7) return 0
  if (activePeriod <= 30) return Math.max(1, Math.floor(dataLen / 6))
  if (activePeriod <= 365) return Math.max(1, Math.floor(dataLen / 12))
  return Math.max(1, Math.floor(dataLen / 10))
}

function getYDomain(prices: number[]): [number, number] | ['auto', 'auto'] {
  if (prices.length === 0) return ['auto', 'auto']
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min
  const pad = range > 0 ? range * 0.05 : max * 0.02
  return [
    Math.max(0, parseFloat((min - pad).toFixed(6))),
    parseFloat((max + pad).toFixed(6)),
  ]
}

export default function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { canAccessTradingPortals } = useActuaryAccess()
  const showOptionsMatrix =
    user?.userType !== 'CLIENT' &&
    (user?.userType === 'ADMIN' || (user?.userType === 'EMPLOYEE' && canAccessTradingPortals))
  const showBuyButton =
    user?.userType === 'ADMIN' ||
    (user?.userType === 'EMPLOYEE' && canAccessTradingPortals) ||
    (user?.userType === 'CLIENT' && canAccessTradingPortals)
  const [activePeriod, setActivePeriod] = useState(30)

  const {
    selectedListing,
    priceHistory,
    loadingDetail,
    loadingHistory,
    historyError,
    error,
    fetchListingById,
    fetchListingHistory,
    clearSelected,
  } = useListingsStore()

  useEffect(() => {
    if (id) {
      fetchListingById(id)
    }
    return () => clearSelected()
  }, [id])

  useEffect(() => {
    if (!id) return
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(Date.now() - activePeriod * 86_400_000)
      .toISOString()
      .split('T')[0]
    void fetchListingHistory(id, fromDate, toDate)
  }, [id, activePeriod]) // eslint-disable-line react-hooks/exhaustive-deps -- fetchListingHistory iz store-a

  if (loadingDetail) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (!selectedListing) return null

  const { base } = selectedListing
  const isPositive = base.changePercent >= 0

  return (
    <div className="space-y-6">
      {/* Navigacija nazad */}
      <button
        onClick={() => navigate(hartijeListPath())}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Nazad na listu
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">{base.ticker}</h1>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary-100 text-primary-700 uppercase">
                {base.listingType}
              </span>
            </div>
            <p className="mt-1 text-gray-500">{base.name}</p>
          </div>

          <div className="text-right flex flex-col items-end gap-2">
            <p className="text-3xl font-bold text-gray-900">${base.price.toFixed(4)}</p>
            <div
              className={`flex items-center justify-end gap-1 mt-1 ${
                isPositive ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">
                {isPositive ? '+' : ''}
                {base.changePercent.toFixed(2)}%
              </span>
            </div>
            {base.lastRefresh && (
              <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>
                  Poslednje ažuriranje:{' '}
                  {new Date(base.lastRefresh).toLocaleString('sr-RS', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            {id && showBuyButton && (
              <button
                type="button"
                onClick={() => navigate(hartijeKupovinaPath(id))}
                className="mt-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Kupi
              </button>
            )}
          </div>
        </div>

        {/* Statistike */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Bid</p>
            <p className="text-base font-semibold text-gray-800">${base.bid.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Ask</p>
            <p className="text-base font-semibold text-gray-800">${base.ask.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Dollar Volume</p>
            <p className="text-base font-semibold text-gray-800">
              {formatMoney(base.dollarVolume)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Nominal Value</p>
            <p className="text-base font-semibold text-gray-800">
              {formatMoney(selectedListing.nominalValue)}
            </p>
          </div>
        </div>

        {/* Detalji margine */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Contract Size</p>
            <p className="text-base font-semibold text-gray-800">
              {selectedListing.contractSize.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Maintenance Margin</p>
            <p className="text-base font-semibold text-gray-800">
              ${selectedListing.maintenanceMargin.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Initial Margin Cost</p>
            <p className="text-base font-semibold text-gray-800">
              ${base.initialMarginCost.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Graf istorije cena */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Istorija cene</h2>
          <div className="flex gap-1">
            {PERIOD_BUTTONS.map(({ label, days }) => (
              <button
                key={label}
                onClick={() => setActivePeriod(days)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activePeriod === days
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {historyError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {historyError}
          </p>
        )}

        {loadingHistory ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : priceHistory.length === 0 && !historyError ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            Nema istorijskih podataka za izabrani period.
          </p>
        ) : priceHistory.length === 0 ? null : (() => {
          const prices = priceHistory.map((d) => d.price)
          const yDomain = getYDomain(prices)
          const xInterval = getXAxisInterval(activePeriod, priceHistory.length)
          const chartRows = priceHistory.map((d) => ({
            date: d.date,
            price: d.price,
          }))
          const tableRows = [...priceHistory].reverse()
          return (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartRows} margin={{ top: 10, right: 24, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  type="category"
                  dataKey="date"
                  tickFormatter={(v) => formatChartDate(v, activePeriod)}
                  interval={xInterval}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  width={72}
                  allowDataOverflow={false}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cena']}
                  labelFormatter={(label) => formatChartDate(label, activePeriod)}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{
                    fontSize: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6 overflow-x-auto border border-gray-100 rounded-lg max-h-72 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Vreme / datum</th>
                      <th className="px-3 py-2 font-medium text-right">Cena (close)</th>
                      <th className="px-3 py-2 font-medium text-right">Volumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.slice(0, 250).map((row, idx) => (
                      <tr key={`${row.date}-${idx}`} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-800 whitespace-nowrap">
                          {formatChartDate(row.date, activePeriod)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          ${row.price.toFixed(4)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">
                          {row.volume ? Number(row.volume).toLocaleString('sr-RS') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        })()}
      </div>

      {/* Pristup 2: opcije po datumu isteka */}
      {base.listingType === 'OPTION' && (
        <OptionsExpiryApproach2
          underlying={extractOptionUnderlying(base.ticker)}
          currentListingId={base.id}
        />
      )}

      {/* Matrica opcija — aktuari/admin, samo akcije (Pristup 1) */}
      {base.listingType === 'STOCK' && showOptionsMatrix && (
        <OptionsMatrix listing={selectedListing} />
      )}
    </div>
  )
}
