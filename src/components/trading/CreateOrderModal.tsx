import { useEffect, useRef, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import Dialog from '@/components/common/Dialog'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { calculateOrder, createTradingOrder } from '@/services/tradingService'
import { getClientAccounts } from '@/services/bankaService'
import { useAuthStore } from '@/store/authStore'
import type {
  TradingOrderType,
  TradingDirection,
  TradingCalculateResponse,
  AccountListItem,
  ListingDetail,
} from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  listing: ListingDetail
}

export default function CreateOrderModal({ open, onClose, listing }: Props) {
  const { base, contractSize } = listing
  const user = useAuthStore((s) => s.user)
  const isClient = user?.userType === 'CLIENT'

  // ── Form state ──────────────────────────────────────────────────────────────
  const [direction, setDirection] = useState<TradingDirection>('BUY')
  const [orderType, setOrderType] = useState<TradingOrderType>('MARKET')
  const [quantity, setQuantity] = useState<string>('1')
  const [limitValue, setLimitValue] = useState<string>('')
  const [stopValue, setStopValue] = useState<string>('')
  const [allOrNone, setAllOrNone] = useState(false)
  const [margin, setMargin] = useState(false)

  // ── Account state (clients only) ────────────────────────────────────────────
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState('')

  // ── Calculation state ───────────────────────────────────────────────────────
  const [calcResult, setCalcResult] = useState<TradingCalculateResponse | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const calcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Submit state ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // ── Load accounts when modal opens (clients only) ───────────────────────────
  useEffect(() => {
    if (!open || !isClient) return
    let cancelled = false
    setLoadingAccounts(true)
    getClientAccounts()
      .then((acc) => {
        if (cancelled) return
        setAccounts(acc)
        setSelectedAccountId(acc[0]?.id ?? '')
      })
      .catch(() => { if (!cancelled) setAccounts([]) })
      .finally(() => { if (!cancelled) setLoadingAccounts(false) })
    return () => { cancelled = true }
  }, [open, isClient])

  // ── Reset form when modal opens ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setDirection('BUY')
    setOrderType('MARKET')
    setQuantity('1')
    setLimitValue('')
    setStopValue('')
    setAllOrNone(false)
    setMargin(false)
    setCalcResult(null)
    setSubmitError(null)
    setSubmitted(false)
  }, [open])

  // ── Debounced calculate ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) {
      setCalcResult(null)
      return
    }

    // LIMIT requires a limit price; STOP requires a stop price
    const needsLimit = orderType === 'LIMIT' || orderType === 'STOP_LIMIT'
    const needsStop = orderType === 'STOP' || orderType === 'STOP_LIMIT'
    if (needsLimit && !limitValue) return
    if (needsStop && !stopValue) return

    if (calcDebounceRef.current) clearTimeout(calcDebounceRef.current)

    calcDebounceRef.current = setTimeout(async () => {
      setCalcLoading(true)
      try {
        const res = await calculateOrder({
          orderType,
          direction,
          listingId: base.id,
          quantity: qty,
          contractSize,
          pricePerUnit: needsLimit ? limitValue : undefined,
          stopPrice: needsStop ? stopValue : undefined,
          margin,
          allOrNone,
        })
        setCalcResult(res)
      } catch {
        setCalcResult(null)
      } finally {
        setCalcLoading(false)
      }
    }, 500)

    return () => {
      if (calcDebounceRef.current) clearTimeout(calcDebounceRef.current)
    }
  }, [open, quantity, orderType, direction, limitValue, stopValue, margin, allOrNone])

  // ── Derived flags ───────────────────────────────────────────────────────────
  const showLimit = orderType === 'LIMIT' || orderType === 'STOP_LIMIT'
  const showStop = orderType === 'STOP' || orderType === 'STOP_LIMIT'

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) return
    if (isClient && !selectedAccountId) {
      setSubmitError('Izaberite račun za naplatu.')
      return
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      await createTradingOrder({
        accountId:    selectedAccountId || '0',
        listingId:    base.id,
        orderType,
        direction,
        quantity:     qty,
        contractSize,
        pricePerUnit: showLimit ? limitValue || undefined : undefined,
        stopPrice:    showStop ? stopValue || undefined : undefined,
        afterHours:   false,
        allOrNone,
        margin,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Nalog nije mogao biti kreiran.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    !submitting &&
    parseInt(quantity, 10) > 0 &&
    (!showLimit || !!limitValue) &&
    (!showStop || !!stopValue) &&
    (!isClient || (!loadingAccounts && accounts.length > 0 && !!selectedAccountId))

  return (
    <Dialog open={open} onClose={onClose} title="Kreiraj nalog" maxWidth="md">
      {submitted ? (
        // ── Success state ──────────────────────────────────────────────────────
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Nalog je kreiran</h3>
            <p className="text-sm text-gray-500 mt-1">
              {direction === 'BUY' ? 'Nalog za kupovinu' : 'Nalog za prodaju'}{' '}
              <span className="font-semibold">{base.ticker}</span> je uspešno kreiran.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Zatvori
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false)
                setSubmitError(null)
                setQuantity('1')
                setLimitValue('')
                setStopValue('')
                setCalcResult(null)
              }}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 transition-colors"
            >
              Novi nalog
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ticker info */}
          <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
            <span className="font-semibold text-gray-800">{base.ticker}</span>
            <span className="font-bold text-gray-900">${base.price.toFixed(4)}</span>
          </div>

          {/* BUY / SELL */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Smer
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  direction === 'BUY'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Kupi
              </button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`flex-1 py-2.5 text-sm font-semibold border-l border-gray-200 transition-colors ${
                  direction === 'SELL'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Prodaj
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Količina
              {contractSize > 1 && (
                <span className="ml-1 font-normal normal-case">
                  (veličina kontr.: {contractSize})
                </span>
              )}
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Tip naloga
            </label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as TradingOrderType)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              <option value="MARKET">Market — po tržišnoj ceni</option>
              <option value="LIMIT">Limit — po zadatoj ceni</option>
              <option value="STOP">Stop — aktivira se na ceni</option>
              <option value="STOP_LIMIT">Stop-Limit — stop + limit cena</option>
            </select>
          </div>

          {/* Limit Value (LIMIT, STOP_LIMIT) */}
          {showLimit && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Limit cena ($)
              </label>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                required
                placeholder={base.price.toFixed(4)}
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}

          {/* Stop Value (STOP, STOP_LIMIT) */}
          {showStop && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Stop cena ($)
              </label>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                required
                placeholder={base.price.toFixed(4)}
                value={stopValue}
                onChange={(e) => setStopValue(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allOrNone}
                onChange={(e) => setAllOrNone(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-300"
              />
              <span className="text-sm text-gray-700">All or None</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={margin}
                onChange={(e) => setMargin(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-300"
              />
              <span className="text-sm text-gray-700">Margin</span>
            </label>
          </div>

          {/* Calculate result */}
          {(calcLoading || calcResult) && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Procena
              </p>
              {calcLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <LoadingSpinner size="sm" />
                  Računam...
                </div>
              ) : calcResult ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Približna cena</span>
                    <span className="font-semibold text-gray-900">
                      ${parseFloat(calcResult.approximatePrice).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Provizija</span>
                    <span className="font-semibold text-gray-900">
                      ${parseFloat(calcResult.commission).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {calcResult.initialMarginCost && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Inicijalna marža</span>
                      <span className="font-semibold text-amber-700">
                        ${parseFloat(calcResult.initialMarginCost).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Account selector (clients only) */}
          {isClient && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Račun za naplatu
              </label>
              {loadingAccounts ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <LoadingSpinner size="sm" />
                  Učitavanje računa…
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Nemate aktivnih računa. Otvorite račun u banci da biste trgovali.
                </p>
              ) : (
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.broj_racuna} · {a.naziv_racuna} — {a.raspolozivo_stanje.toLocaleString('sr-RS', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {a.valuta_oznaka}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Error */}
          {submitError && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3"
            >
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              direction === 'BUY'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner color="light" size="sm" />
                Kreiranje...
              </span>
            ) : (
              `${direction === 'BUY' ? 'Kupi' : 'Prodaj'} ${parseInt(quantity, 10) > 0 ? parseInt(quantity, 10) : ''} ${base.ticker}`
            )}
          </button>
        </form>
      )}
    </Dialog>
  )
}
