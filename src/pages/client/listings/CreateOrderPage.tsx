import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react'
import { useListingsStore } from '@/store/useListingsStore'
import { useAuthStore } from '@/store/authStore'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import Dialog from '@/components/common/Dialog'
import Button from '@/components/common/Button'
import { hartijeListPath, hartijeDetailPath } from '@/router/helpers'
import { getClientAccounts } from '@/services/bankaService'
import { calculateOrder, createTradingOrder } from '@/services/tradingService'
import { getAllExchanges } from '@/services/exchangeService'
import { getMyPortfolio } from '@/services/portfolioService'
import { useActuaryAccess } from '@/context/ActuaryAccessContext'
import type { TradingOrderType, TradingDirection, TradingCalculateResponse } from '@/types'
import type { AccountListItem } from '@/types'
import type { MarketStatus } from '@/services/exchangeService'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderSide = TradingDirection

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: string | number | undefined, prefix = '$') {
  if (!n) return '—'
  return `${prefix}${parseFloat(String(n)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`
}

// ─── Order type labels ────────────────────────────────────────────────────────

const ORDER_TYPE_LABELS: Record<TradingOrderType, string> = {
  MARKET:     'Market — po tržišnoj ceni',
  LIMIT:      'Limit — po zadatoj ceni',
  STOP:       'Stop (Stop-Loss) — aktivira se na ceni',
  STOP_LIMIT: 'Stop-Limit — Stop + Limit kombinacija',
}

// ─── Field visibility per order type ─────────────────────────────────────────

function needsLimitPrice(ot: TradingOrderType) { return ot === 'LIMIT' || ot === 'STOP_LIMIT' }
function needsStopPrice(ot: TradingOrderType)  { return ot === 'STOP'  || ot === 'STOP_LIMIT' }

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const isClient = user?.userType === 'CLIENT'
  const { canAccessTradingPortals } = useActuaryAccess()
  const isActuaryTrader =
    user?.userType === 'ADMIN' || (user?.userType === 'EMPLOYEE' && canAccessTradingPortals)

  const { selectedListing, loadingDetail, error, fetchListingById, clearSelected } =
    useListingsStore()

  // ── Form state ──────────────────────────────────────────────────────────────
  const initialSide: OrderSide = searchParams.get('direction') === 'SELL' ? 'SELL' : 'BUY'
  const [side,        setSide]        = useState<OrderSide>(initialSide)
  const [orderType,   setOrderType]   = useState<TradingOrderType>('MARKET')
  const [quantity,    setQuantity]    = useState('1')
  const [limitPrice,  setLimitPrice]  = useState('')
  const [stopPrice,   setStopPrice]   = useState('')
  const [allOrNone,   setAllOrNone]   = useState(false)
  const [margin,      setMargin]      = useState(false)

  // Account (client only)
  const [accounts,        setAccounts]        = useState<AccountListItem[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [accountId,       setAccountId]       = useState('')

  // ── Calculation state ───────────────────────────────────────────────────────
  const [calc,        setCalc]        = useState<TradingCalculateResponse | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError,   setCalcError]   = useState<string | null>(null)
  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Market status (for closed/after-hours warning) ─────────────────────────
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)

  // ── Owned quantity (for sell direction hint) ────────────────────────────────
  const [ownedQty, setOwnedQty] = useState<number | null>(null)

  // ── Submission state ────────────────────────────────────────────────────────
  const [submitted,    setSubmitted]    = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)
  const [confirmOpen,  setConfirmOpen]  = useState(false)

  // ── Load listing ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) fetchListingById(id)
    return () => clearSelected()
  }, [id])

  // ── Load accounts (clients AND actuaries) ──────────────────────────────────
  // searchParams may carry a pre-selected accountId from the portfolio sell button
  const preselectedAccountId = searchParams.get('accountId') ?? ''

  useEffect(() => {
    if (!isClient && !isActuaryTrader) {
      setLoadingAccounts(false)
      return
    }
    // Aktuari/admin: kupovina sa bankinog trezora — backend rešava račun kada je accountId=0.
    if (!isClient && isActuaryTrader) {
      setAccountId('0')
      setAccounts([])
      setLoadingAccounts(false)
      return
    }
    let cancelled = false
    getClientAccounts()
      .then((acc) => {
        if (cancelled) return
        setAccounts(acc)
        if (preselectedAccountId && acc.some((a) => a.id === preselectedAccountId)) {
          setAccountId(preselectedAccountId)
        } else if (acc.length > 0) {
          setAccountId(acc[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) setAccounts([])
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false)
      })
    return () => {
      cancelled = true
    }
  }, [isClient, isActuaryTrader, preselectedAccountId])

  // ── Fetch exchange market status when listing loads ─────────────────────────
  useEffect(() => {
    const exchangeId = selectedListing?.base?.exchangeId
    if (!exchangeId) return
    let cancelled = false
    getAllExchanges()
      .then(({ exchanges }) => {
        if (cancelled) return
        const ex = exchanges.find((e) => String(e.id) === String(exchangeId))
        if (ex && ex.marketStatus) setMarketStatus(ex.marketStatus as MarketStatus)
      })
      .catch(() => {}) // non-critical — warn silently
    return () => { cancelled = true }
  }, [selectedListing])

  // ── Fetch owned quantity when SELL direction is chosen (skip for forex) ───────
  useEffect(() => {
    if (side !== 'SELL' || !id || selectedListing?.base?.listingType === 'FOREX') {
      setOwnedQty(null)
      return
    }
    let cancelled = false
    getMyPortfolio()
      .then((portfolio) => {
        if (cancelled) return
        const holding = portfolio.holdings.find((h) => h.listingId === id)
        setOwnedQty(holding ? holding.availableQuantity : 0)
      })
      .catch(() => { if (!cancelled) setOwnedQty(null) })
    return () => { cancelled = true }
  }, [side, id, selectedListing])

  // ── Live calculation (debounced 600ms) ──────────────────────────────────────
  const runCalculate = useCallback(async () => {
    if (!id || !selectedListing) return
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) { setCalc(null); return }
    if (needsLimitPrice(orderType) && !limitPrice) { setCalc(null); return }
    if (needsStopPrice(orderType)  && !stopPrice)  { setCalc(null); return }

    setCalcLoading(true)
    setCalcError(null)
    try {
      const res = await calculateOrder({
        orderType,
        direction:    side,
        listingId:    id,
        quantity:     qty,
        contractSize: selectedListing.contractSize,
        pricePerUnit: needsLimitPrice(orderType) ? limitPrice : undefined,
        stopPrice:    needsStopPrice(orderType)  ? stopPrice  : undefined,
        margin,
        allOrNone,
      })
      setCalc(res)
    } catch (e: unknown) {
      setCalcError(e instanceof Error ? e.message : 'Greška pri kalkulaciji.')
      setCalc(null)
    } finally {
      setCalcLoading(false)
    }
  }, [id, selectedListing, orderType, side, quantity, limitPrice, stopPrice, margin, allOrNone])

  useEffect(() => {
    if (calcTimer.current) clearTimeout(calcTimer.current)
    calcTimer.current = setTimeout(runCalculate, 600)
    return () => { if (calcTimer.current) clearTimeout(calcTimer.current) }
  }, [runCalculate])

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (user && !isClient && !isActuaryTrader) {
    return <Navigate to={hartijeListPath()} replace />
  }

  if (loadingDetail) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>
  }

  if (error || !selectedListing) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Hartija nije pronađena.</p>
        <button onClick={() => navigate(hartijeListPath())}
          className="mt-4 text-primary-600 hover:underline text-sm">
          Nazad na listu
        </button>
      </div>
    )
  }

  if (isClient && !canAccessTradingPortals) {
    const t = selectedListing.base.ticker
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-gray-900">Trgovanje nije omogućeno</p>
          <p className="text-sm text-gray-600">
            Za kupovinu i prodaju hartija ({t}) potrebna je dozvola za trgovanje. Obratite se banci.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(hartijeDetailPath(id!))}
              className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Detalji hartije
            </button>
            <button
              type="button"
              onClick={() => navigate(hartijeListPath())}
              className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700"
            >
              Nazad na listu
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { base } = selectedListing
  const isForex = base.listingType === 'FOREX'
  const isOption = base.listingType === 'OPTION'
  const isPositive = base.changePercent >= 0

  // Parse forex currency pair from detailsJson
  let forexBase = ''
  let forexQuote = ''
  if (isForex && selectedListing.detailsJson) {
    try {
      const d = JSON.parse(selectedListing.detailsJson)
      forexBase = d.base_currency ?? ''
      forexQuote = d.quote_currency ?? ''
    } catch {}
  }

  // Parse option underlying from OCC ticker: {UNDERLYING}{YYMMDD}{C|P}{STRIKE8}
  const optionUnderlying = isOption && base.ticker.length > 15
    ? base.ticker.slice(0, base.ticker.length - 15)
    : ''
  const optionContractSize = selectedListing.contractSize ?? 100

  if (isClient && isForex) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <p className="text-lg font-semibold text-gray-900">Forex nije dostupan klijentima</p>
          <p className="text-sm text-gray-600">
            Forex parovi su dostupni samo aktuarima banke.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button type="button" onClick={() => navigate(hartijeListPath())}
              className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700">
              Nazad na listu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Submit handler — validates and opens confirm dialog ─────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0 || !id) return
    setSubmitError(null)

    if (isClient && !accountId) {
      setSubmitError('Izaberite račun sa kog se skida novac.')
      return
    }
    if (needsLimitPrice(orderType) && !limitPrice) {
      setSubmitError('Unesite limit cenu.')
      return
    }
    if (needsStopPrice(orderType) && !stopPrice) {
      setSubmitError('Unesite stop cenu.')
      return
    }

    setConfirmOpen(true)
  }

  // ── Confirmed submit — actual API call after user approves dialog ─────────
  const handleConfirmedSubmit = async () => {
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0 || !id) return
    setConfirmOpen(false)
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createTradingOrder({
        accountId: isClient ? accountId : '0',
        listingId:    id,
        orderType,
        direction:    side,
        quantity:     qty,
        contractSize: selectedListing.contractSize,
        pricePerUnit: needsLimitPrice(orderType) ? limitPrice : undefined,
        stopPrice:    needsStopPrice(orderType)  ? stopPrice  : undefined,
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

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <ShoppingCart className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Nalog je kreiran</h2>
        <p className="text-gray-500 text-sm">
          {side === 'BUY' ? 'Nalog za kupovinu' : 'Nalog za prodaju'}{' '}
          <span className="font-semibold">{parseFloat(quantity)} × {base.ticker}</span> je uspešno kreiran.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => navigate(hartijeListPath())}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Nazad na listu
          </button>
          <button
            onClick={() => {
              setSubmitted(false); setSubmitError(null)
              setQuantity('1'); setLimitPrice(''); setStopPrice('')
              setAllOrNone(false); setMargin(false); setCalc(null)
            }}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 transition-colors">
            Novi nalog
          </button>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Back nav */}
      <button onClick={() => navigate(id ? hartijeDetailPath(id) : hartijeListPath())}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Nazad na detalje
      </button>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kreiraj nalog</h1>
        <p className="text-sm text-gray-500 mt-1">{base.ticker} — {base.name}</p>
      </div>

      {/* Current price card */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Trenutna cena</p>
          <p className="text-2xl font-bold text-gray-900">${base.price.toFixed(4)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Bid: ${base.bid?.toFixed(4) ?? '—'} &nbsp;·&nbsp; Ask: ${base.ask?.toFixed(4) ?? '—'}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPositive ? '+' : ''}{base.changePercent.toFixed(2)}%
        </div>
      </div>

      {/* Market status warning */}
      {marketStatus === 'CLOSED' && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Berza je trenutno zatvorena. Nalog će biti kreiran, ali će se izvršiti tek kada se berza otvori.
        </div>
      )}
      {marketStatus === 'AFTER_HOURS' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Berza je u after-hours periodu. Nalog će se izvršavati sporije nego u redovnom vremenu.
        </div>
      )}

      <div className="rounded-lg bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 text-sm flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
        <span>
          <strong>Tip naloga:</strong> za trgovanje po trenutnoj ponudi birajte <strong>Market</strong>. Limit i Stop zahtevaju unos cena;
          prazna polja uz te tipove nisu validna — sistem validira unos pre slanja (druga potvrda u dijalogu).
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">

        {/* BUY / SELL */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Smer naloga
          </label>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {(['BUY', 'SELL'] as OrderSide[]).map((s) => (
              <button key={s} type="button" onClick={() => setSide(s)}
                className={[
                  'flex-1 py-2.5 text-sm font-semibold transition-colors',
                  s === 'SELL' ? 'border-l border-gray-200' : '',
                  side === s
                    ? s === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50',
                ].join(' ')}>
                {s === 'BUY' ? 'Kupi' : 'Prodaj'}
              </button>
            ))}
          </div>
        </div>

        {/* Order type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Tip naloga
          </label>
          <select value={orderType} onChange={(e) => { setOrderType(e.target.value as TradingOrderType); setCalc(null) }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
            {(Object.keys(ORDER_TYPE_LABELS) as TradingOrderType[]).map((ot) => (
              <option key={ot} value={ot}>{ORDER_TYPE_LABELS[ot]}</option>
            ))}
          </select>
          {/* Activation condition help text */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 text-blue-800 px-3 py-2 text-xs flex gap-2 mt-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
            <span>
              {orderType === 'MARKET' && side === 'BUY' && 'Kupovina po trenutnom ask kursu. Izvršava se odmah čim engine preuzme nalog.'}
              {orderType === 'MARKET' && side === 'SELL' && 'Prodaja po trenutnom bid kursu. Izvršava se odmah čim engine preuzme nalog.'}
              {orderType === 'LIMIT' && side === 'BUY' && 'Izvršava se kada ask kurs padne na ili ispod zadate limit cene.'}
              {orderType === 'LIMIT' && side === 'SELL' && 'Izvršava se kada bid kurs poraste na ili iznad zadate limit cene.'}
              {orderType === 'STOP' && side === 'BUY' && 'Aktivira se kada tržišna cena dostigne stop cenu; zatim se kupuje po tržišnom kursu.'}
              {orderType === 'STOP' && side === 'SELL' && 'Aktivira se kada tržišna cena padne na stop cenu; zatim se prodaje po tržišnom kursu.'}
              {orderType === 'STOP_LIMIT' && side === 'BUY' && 'Aktivira se na stop ceni, a zatim čeka da ask bude ≤ limit ceni pre kupovine.'}
              {orderType === 'STOP_LIMIT' && side === 'SELL' && 'Aktivira se na stop ceni, a zatim čeka da bid bude ≥ limit ceni pre prodaje.'}
            </span>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Količina {selectedListing.contractSize > 1 && `(veličina kontr.: ${selectedListing.contractSize})`}
          </label>
          <input type="number" min="1" step="1" required
            max={side === 'SELL' && ownedQty !== null ? ownedQty : undefined}
            value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          {/* Available quantity hint for SELL orders */}
          {side === 'SELL' && ownedQty !== null && (
            <p className={`text-xs mt-1.5 ${ownedQty === 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {ownedQty === 0
                ? 'Ne posedujete ovu hartiju — prodaja nije moguća.'
                : isOption
                  ? `Raspoloživo za prodaju: ${ownedQty} ugovor${ownedQty === 1 ? '' : 'a'}`
                  : `Raspoloživo za prodaju: ${ownedQty} komad${ownedQty === 1 ? '' : 'a'}`}
            </p>
          )}
          {/* Option BUY info: 1 ugovor = N akcija UNDERLYING */}
          {isOption && side === 'BUY' && (
            <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 px-3 py-2 text-xs flex gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-500" />
              <span>1 ugovor = {optionContractSize} akcija{optionUnderlying ? ` ${optionUnderlying}` : ''}</span>
            </div>
          )}
        </div>

        {/* Limit price (LIMIT, STOP_LIMIT) */}
        {needsLimitPrice(orderType) && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Limit cena ($)
            </label>
            <input type="number" min="0.0001" step="0.0001" required
              placeholder={base.price.toFixed(4)}
              value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        )}

        {/* Stop price (STOP, STOP_LIMIT) */}
        {needsStopPrice(orderType) && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Stop cena ($)
            </label>
            <input type="number" min="0.0001" step="0.0001" required
              placeholder={base.price.toFixed(4)}
              value={stopPrice} onChange={(e) => setStopPrice(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        )}

        {/* AON + Margin checkboxes */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={allOrNone} onChange={(e) => setAllOrNone(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-gray-700">
              All or None (AON) — izvršiti samo ako je moguće u celosti
            </span>
          </label>
          {(isActuaryTrader || isClient) && !isForex && side === 'BUY' && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={margin} onChange={(e) => setMargin(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">
                {isClient
                  ? 'Margin — trgovanje kreditom (zahteva odobren kredit)'
                  : 'Margin — trgovanje kreditom (zahteva ulogu aktuara)'}
              </span>
            </label>
          )}
        </div>

        {/* Live price estimate */}
        <div className={`rounded-lg border p-4 space-y-1.5 transition-opacity ${calcLoading ? 'opacity-60' : 'opacity-100'} ${calc ? 'bg-gray-50 border-gray-100' : 'bg-gray-50 border-dashed border-gray-200'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
              {isForex ? 'Procena razmene' : 'Procena cene'}
            </p>
            {calcLoading && <LoadingSpinner size="sm" />}
          </div>
          {calcError ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {calcError}
            </div>
          ) : calc ? (
            isForex ? (() => {
              const qty = parseFloat(quantity) || 0
              const nominalBase = selectedListing.contractSize * qty
              const rate = parseFloat(String(calc.pricePerUnit)) || 0
              const nominalQuote = nominalBase * rate
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kurs ({forexBase}/{forexQuote}):</span>
                    <span className="font-mono font-medium">{rate.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Nominalna vrednost:</span>
                    <span className="font-mono">{nominalBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexBase}</span>
                  </div>
                  {side === 'BUY' ? (
                    <>
                      <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Skida se ({forexQuote}):</span>
                        <span className="font-mono font-bold text-red-600">{nominalQuote.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexQuote}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Uplaćuje se ({forexBase}):</span>
                        <span className="font-mono font-bold text-green-600">{nominalBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexBase}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Skida se ({forexBase}):</span>
                        <span className="font-mono font-bold text-red-600">{nominalBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexBase}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Uplaćuje se ({forexQuote}):</span>
                        <span className="font-mono font-bold text-green-600">{nominalQuote.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexQuote}</span>
                      </div>
                    </>
                  )}
                </>
              )
            })() : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cena / jed.:</span>
                  <span className="font-mono font-medium">{fmt(calc.pricePerUnit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ukupno (aproks.):</span>
                  <span className="font-mono font-bold text-gray-900">{fmt(calc.approximatePrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Provizija:</span>
                  <span className="font-mono">{fmt(calc.commission)}</span>
                </div>
                {calc.initialMarginCost && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Initial Margin Cost:</span>
                    <span className="font-mono text-amber-700">{fmt(calc.initialMarginCost)}</span>
                  </div>
                )}
              </>
            )
          ) : (
            <p className="text-xs text-gray-400">
              {isForex ? 'Popunite polja da vidite procenu razmene.' : 'Popunite polja da vidite procenu.'}
            </p>
          )}
        </div>

        {/* Account selector (clients and actuaries) */}
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
                Nemate aktivnih računa. Otvorite račun da biste trgovali.
              </p>
            ) : (
              <select required value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.broj_racuna} · {a.naziv_racuna} — {a.raspolozivo_stanje.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {a.valuta_oznaka}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {isActuaryTrader && !isClient && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <span className="font-medium text-slate-800">{isForex ? 'Razmena:' : 'Naplata:'}</span>{' '}
            {isForex
              ? `trezor ${forexBase} / trezor ${forexQuote} — automatski odabir trezor računa banke pri izvršenju.`
              : 'bankovni trezor (USD) — automatski odabir računa banke pri izvršenju naloga.'}
          </div>
        )}

        {submitError && (
          <div role="alert"
            className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
            {submitError}
          </div>
        )}

        <button type="submit"
          disabled={
            submitting ||
            !parseFloat(quantity) || parseFloat(quantity) <= 0 ||
            (isClient && (loadingAccounts || accounts.length === 0 || !accountId)) ||
            (!isForex && side === 'SELL' && ownedQty !== null && ownedQty === 0)
          }
          className={[
            'w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
            side === 'BUY'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white',
          ].join(' ')}>
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Kreiranje...
            </span>
          ) : (
            `${side === 'BUY' ? 'Kupi' : 'Prodaj'} ${parseFloat(quantity) > 0 ? parseFloat(quantity) : ''} ${base.ticker}`
          )}
        </button>
      </form>

      {/* ── Confirmation dialog ──────────────────────────────────────────────── */}
      {selectedListing && (
        <Dialog
          open={confirmOpen}
          onClose={() => !submitting && setConfirmOpen(false)}
          title="Potvrda naloga"
          maxWidth="sm"
        >
          <div className="space-y-4">
            {/* Order summary */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Hartija</span>
                <span className="font-semibold text-gray-900">{base.ticker} — {base.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Smer</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${side === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                  {side === 'BUY' ? 'Kupovina' : 'Prodaja'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tip naloga</span>
                <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5">{orderType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Količina</span>
                <span className="font-medium">
                  {parseFloat(quantity)}
                  {selectedListing.contractSize > 1 && (
                    <span className="text-gray-400 text-xs ml-1">× {selectedListing.contractSize} (kontr.)</span>
                  )}
                </span>
              </div>
              {calc && (
                isForex ? (() => {
                  const qty = parseFloat(quantity) || 0
                  const nominalBase = selectedListing.contractSize * qty
                  const rate = parseFloat(String(calc.pricePerUnit)) || 0
                  const nominalQuote = nominalBase * rate
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Kurs ({forexBase}/{forexQuote})</span>
                        <span className="font-mono">{rate.toFixed(6)}</span>
                      </div>
                      {side === 'BUY' ? (
                        <>
                          <div className="border-t border-gray-200 pt-2 flex justify-between">
                            <span className="text-gray-500">Skida se ({forexQuote})</span>
                            <span className="font-mono font-bold text-red-600">{nominalQuote.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexQuote}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Uplaćuje se ({forexBase})</span>
                            <span className="font-mono font-bold text-green-600">{nominalBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexBase}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="border-t border-gray-200 pt-2 flex justify-between">
                            <span className="text-gray-500">Skida se ({forexBase})</span>
                            <span className="font-mono font-bold text-red-600">{nominalBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexBase}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Uplaćuje se ({forexQuote})</span>
                            <span className="font-mono font-bold text-green-600">{nominalQuote.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {forexQuote}</span>
                          </div>
                        </>
                      )}
                    </>
                  )
                })() : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cena / jed.</span>
                      <span className="font-mono">${parseFloat(String(calc.pricePerUnit)).toFixed(4)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 flex justify-between">
                      <span className="text-gray-500">Ukupno (aproks.)</span>
                      <span className="font-mono font-bold text-gray-900">${parseFloat(String(calc.approximatePrice)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provizija</span>
                      <span className="font-mono text-amber-700">${parseFloat(String(calc.commission)).toFixed(4)}</span>
                    </div>
                  </>
                )
              )}
            </div>

            {/* Account charge info */}
            {isClient && accountId && accounts.length > 0 && (() => {
              const acc = accounts.find((a) => a.id === accountId)
              return acc ? (
                <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm">
                  <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide mb-1">
                    {side === 'BUY' ? 'Tereti se račun' : 'Odobrava se račun'}
                  </p>
                  <p className="font-semibold text-primary-900">{acc.naziv_racuna}</p>
                  <p className="text-primary-700 font-mono text-xs">{acc.broj_racuna}</p>
                  <p className="text-primary-600 text-xs mt-0.5">
                    Raspoloživo: {acc.raspolozivo_stanje.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {acc.valuta_oznaka}
                  </p>
                </div>
              ) : null
            })()}
            {isActuaryTrader && !isClient && (
              <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">
                {isForex
                  ? <>Zamena ide sa <strong>trezor {forexBase}</strong> / <strong>trezor {forexQuote}</strong> računa banke.</>
                  : <>Naplata ide sa <strong>bankovnog trezor računa</strong> (USD), kako definiše backend.</>
                }
              </div>
            )}

            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Odustani
              </Button>
              <Button
                variant={side === 'BUY' ? 'primary' : 'danger'}
                size="sm"
                loading={submitting}
                onClick={handleConfirmedSubmit}
              >
                {side === 'BUY' ? 'Potvrdi kupovinu' : 'Potvrdi prodaju'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
