import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe,
  Share2,
  Zap,
  Receipt,
  PieChart,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/common/Button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import Dialog from '@/components/common/Dialog'
import { hartijeKupovinaPath } from '@/router/helpers'
import {
  getMyPortfolio,
  publishShares,
  exerciseOption,
  getFunds,
  investInFund,
  withdrawFromFund,
  type HoldingItem,
  type ClientFund,
  type ManagedFund,
} from '@/services/portfolioService'
import { getClientAccounts } from '@/services/bankaService'
import type { AccountListItem } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRSD(n: number) {
  return n.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RSD'
}

function formatUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={['whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500', right ? 'text-right' : 'text-left'].join(' ')}>
      {children}
    </th>
  )
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={['px-4 py-3 text-sm text-gray-800', right ? 'text-right' : '', mono ? 'font-mono text-xs' : ''].join(' ')}>
      {children}
    </td>
  )
}

function ListingTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    STOCK: 'bg-blue-100 text-blue-800',
    FOREX: 'bg-green-100 text-green-800',
    FUTURE: 'bg-orange-100 text-orange-800',
    OPTION: 'bg-purple-100 text-purple-800',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type] ?? 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  )
}

// ─── Parse option details ─────────────────────────────────────────────────────

interface OptionDetails {
  settlement_date?: string
  strike_price?: number
  option_type?: string // CALL | PUT
}

function parseOptionDetails(detailsJson: string): OptionDetails {
  try { return JSON.parse(detailsJson) } catch { return {} }
}

function isOptionInTheMoney(holding: HoldingItem): boolean {
  if (holding.listingType !== 'OPTION') return false
  const d = parseOptionDetails(holding.detailsJson)
  if (!d.settlement_date || !d.strike_price || !d.option_type) return false
  if (new Date() >= new Date(d.settlement_date)) return false
  if (d.option_type.toUpperCase() === 'CALL') return holding.currentPrice > d.strike_price
  if (d.option_type.toUpperCase() === 'PUT') return holding.currentPrice < d.strike_price
  return false
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = 'holdings' | 'funds'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MojPortfolioPage() {
  const { user, hasPermission } = useAuthStore()
  const navigate = useNavigate()
  const isActuary = user?.userType === 'EMPLOYEE'
  const isSupervisor = hasPermission('SUPERVISOR')

  const [tab, setTab] = useState<Tab>('holdings')
  const [loading, setLoading] = useState(true)
  const [holdings, setHoldings] = useState<HoldingItem[]>([])
  const [totalProfit, setTotalProfit] = useState(0)
  const [taxPaid, setTaxPaid] = useState(0)
  const [taxUnpaid, setTaxUnpaid] = useState(0)
  const [accounts, setAccounts] = useState<AccountListItem[]>([])

  // Funds state
  const [fundsLoading, setFundsLoading] = useState(false)
  const [clientFunds, setClientFunds] = useState<ClientFund[]>([])
  const [managedFunds, setManagedFunds] = useState<ManagedFund[]>([])

  // Dialogs
  const [publishDialog, setPublishDialog] = useState<{ holding: HoldingItem } | null>(null)
  const [publishQty, setPublishQty] = useState('1')
  const [publishLoading, setPublishLoading] = useState(false)

  const [exerciseDialog, setExerciseDialog] = useState<{ holding: HoldingItem } | null>(null)
  const [exerciseLoading, setExerciseLoading] = useState(false)

  const [investDialog, setInvestDialog] = useState<{ fund: ClientFund | ManagedFund } | null>(null)
  const [investAmount, setInvestAmount] = useState('')
  const [investAccountId, setInvestAccountId] = useState('')
  const [investLoading, setInvestLoading] = useState(false)

  const [withdrawDialog, setWithdrawDialog] = useState<{ fund: ClientFund } | null>(null)
  const [withdrawAll, setWithdrawAll] = useState(true)
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [withdrawAccountId, setWithdrawAccountId] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  // Load portfolio on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getMyPortfolio(),
      user?.userType === 'CLIENT' ? getClientAccounts() : Promise.resolve([]),
    ])
      .then(([portfolio, accs]) => {
        if (cancelled) return
        setHoldings(portfolio.holdings)
        setTotalProfit(portfolio.totalProfit)
        setTaxPaid(portfolio.taxPaidRsd)
        setTaxUnpaid(portfolio.taxUnpaid)
        setAccounts(accs)
        if (accs.length > 0) {
          setInvestAccountId(accs[0].id)
          setWithdrawAccountId(accs[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Greška pri učitavanju portfolia.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.userType])

  // Load funds when tab switches
  useEffect(() => {
    if (tab !== 'funds') return
    let cancelled = false
    setFundsLoading(true)
    getFunds()
      .then((data) => {
        if (cancelled) return
        setClientFunds(data.clientFunds ?? [])
        setManagedFunds(data.managedFunds ?? [])
      })
      .catch(() => { if (!cancelled) toast.error('Greška pri učitavanju fondova.') })
      .finally(() => { if (!cancelled) setFundsLoading(false) })
    return () => { cancelled = true }
  }, [tab])

  // ── Publish shares ─────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!publishDialog) return
    const qty = parseInt(publishQty, 10)
    if (isNaN(qty) || qty <= 0) { toast.error('Unesite ispravnu količinu.'); return }
    setPublishLoading(true)
    try {
      await publishShares(publishDialog.holding.listingId, qty)
      toast.success(`${qty} akcija ${publishDialog.holding.ticker} objavljeno za OTC.`)
      setPublishDialog(null)
      const p = await getMyPortfolio()
      setHoldings(p.holdings)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Greška pri objavljivanju akcija.')
    } finally {
      setPublishLoading(false)
    }
  }

  // ── Exercise option ────────────────────────────────────────────────────────
  const handleExercise = async () => {
    if (!exerciseDialog) return
    setExerciseLoading(true)
    try {
      const result = await exerciseOption(exerciseDialog.holding.listingId)
      toast.success(`Opcija iskorišćena. Neto dobitak: ${formatUSD(result.netProfit)}`)
      setExerciseDialog(null)
      const p = await getMyPortfolio()
      setHoldings(p.holdings)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Greška pri iskorišćavanju opcije.')
    } finally {
      setExerciseLoading(false)
    }
  }

  // ── Invest in fund ─────────────────────────────────────────────────────────
  const handleInvest = async () => {
    if (!investDialog) return
    const amt = parseFloat(investAmount)
    if (isNaN(amt) || amt <= 0) { toast.error('Unesite ispravan iznos.'); return }
    if (!investAccountId) { toast.error('Izaberite račun.'); return }
    setInvestLoading(true)
    try {
      await investInFund(investDialog.fund.id, investAccountId, amt)
      toast.success('Investicija uspešno obavljena.')
      setInvestDialog(null)
      setInvestAmount('')
      const data = await getFunds()
      setClientFunds(data.clientFunds ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Greška pri investiranju.')
    } finally {
      setInvestLoading(false)
    }
  }

  // ── Withdraw from fund ─────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!withdrawDialog) return
    const amt = withdrawAll ? 0 : parseFloat(withdrawAmt)
    if (!withdrawAll && (isNaN(amt) || amt <= 0)) { toast.error('Unesite ispravan iznos.'); return }
    if (!withdrawAccountId) { toast.error('Izaberite račun.'); return }
    setWithdrawLoading(true)
    try {
      await withdrawFromFund(withdrawDialog.fund.id, withdrawAccountId, amt, withdrawAll)
      toast.success('Povlačenje uspešno obavljeno.')
      setWithdrawDialog(null)
      setWithdrawAmt('')
      const data = await getFunds()
      setClientFunds(data.clientFunds ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Greška pri povlačenju.')
    } finally {
      setWithdrawLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Moj Portfolio</h1>
        <p className="text-sm text-gray-500 mt-1">Pregled hartija od vrednosti i investicionih fondova</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['holdings', 'Hartije od vrednosti'], ['funds', 'Moji fondovi']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Holdings ── */}
      {tab === 'holdings' && (
        <div className="space-y-6">

          {/* 1. Securities table */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-700">Hartije od vrednosti</h2>
            </div>
            {holdings.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">Nemate hartija od vrednosti u portfoliu.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <Th>Tip</Th>
                      <Th>Ticker</Th>
                      <Th right>Količina</Th>
                      <Th right>Tren. cena</Th>
                      <Th right>Pros. kupovna</Th>
                      <Th right>Profit</Th>
                      <Th>Poslednja izmena</Th>
                      <Th>Akcije</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {holdings.map((h) => {
                      const profitPos = h.profit >= 0
                      const details = parseOptionDetails(h.detailsJson)
                      const canExercise = isActuary && h.listingType === 'OPTION' && isOptionInTheMoney(h)
                      const maxPublic = h.listingType === 'STOCK' ? h.quantity - h.publicShares : 0
                      return (
                        <tr key={h.listingId} className="hover:bg-gray-50 transition-colors">
                          <Td><ListingTypeBadge type={h.listingType} /></Td>
                          <Td><span className="font-semibold text-gray-900">{h.ticker}</span><div className="text-xs text-gray-400">{h.name}</div></Td>
                          <Td right mono>{h.quantity.toLocaleString()}</Td>
                          <Td right mono>{formatUSD(h.currentPrice)}</Td>
                          <Td right mono>{formatUSD(h.avgBuyPrice)}</Td>
                          <Td right>
                            <span className={`font-semibold ${profitPos ? 'text-green-600' : 'text-red-500'}`}>
                              {profitPos ? '+' : ''}{formatUSD(h.profit)}
                            </span>
                          </Td>
                          <Td><span className="text-xs text-gray-500">{new Date(h.lastModified).toLocaleDateString('sr-RS')}</span></Td>
                          <Td>
                            <div className="flex flex-wrap gap-1.5">
                              {/* Sell button */}
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => navigate(`${hartijeKupovinaPath(h.listingId)}?direction=SELL${h.accountId ? `&accountId=${h.accountId}` : ''}`)}
                              >
                                Prodaj
                              </Button>

                              {/* Publish stocks for OTC */}
                              {h.listingType === 'STOCK' && maxPublic > 0 && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  leftIcon={<Share2 className="h-3.5 w-3.5" />}
                                  onClick={() => {
                                    setPublishQty('1')
                                    setPublishDialog({ holding: h })
                                  }}
                                >
                                  OTC ({h.publicShares} javno)
                                </Button>
                              )}

                              {/* Exercise option (actuaries only) */}
                              {h.listingType === 'OPTION' && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  leftIcon={<Zap className="h-3.5 w-3.5" />}
                                  onClick={() => setExerciseDialog({ holding: h })}
                                  disabled={!canExercise}
                                  title={
                                    !isActuary ? 'Samo aktuari mogu da iskoriste opcije'
                                    : !isOptionInTheMoney(h) ? 'Opcija nije in the money ili je istekla'
                                    : details.option_type === 'PUT'
                                      ? `PUT: tren. ${formatUSD(h.currentPrice)} < strike ${formatUSD(details.strike_price ?? 0)}`
                                      : `CALL: tren. ${formatUSD(h.currentPrice)} > strike ${formatUSD(details.strike_price ?? 0)}`
                                  }
                                >
                                  Iskoristi
                                </Button>
                              )}
                            </div>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Profit section (stocks only) */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {totalProfit >= 0
                  ? <TrendingUp className="h-6 w-6 text-green-600" />
                  : <TrendingDown className="h-6 w-6 text-red-500" />}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Ukupan profit (akcije)</p>
                <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {totalProfit >= 0 ? '+' : ''}{formatUSD(totalProfit)}
                </p>
              </div>
            </div>

            {/* 3. Tax section */}
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-gray-700">Porez (tekuća godina)</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Plaćen porez (god.):</span>
                  <span className="font-semibold text-gray-800">{formatRSD(taxPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Neplaćen (mes.):</span>
                  <span className={`font-semibold ${taxUnpaid > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {formatRSD(taxUnpaid)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Funds ── */}
      {tab === 'funds' && (
        <div className="space-y-4">
          {fundsLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : isSupervisor ? (
            // Supervisor: show managed funds
            <>
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary-600" />
                <h2 className="text-sm font-semibold text-gray-700">Fondovi kojima upravljate</h2>
              </div>
              {managedFunds.length === 0 ? (
                <div className="bg-white rounded-xl shadow text-center py-16 text-gray-400 text-sm">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p>Nemate fondova kojima upravljate.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {managedFunds.map((f) => (
                    <div key={f.id} className="bg-white rounded-xl shadow p-5 space-y-3">
                      <h3 className="font-semibold text-gray-900">{f.name}</h3>
                      {f.description && <p className="text-sm text-gray-500">{f.description}</p>}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Vrednost fonda:</span>
                          <span className="font-medium">{formatRSD(f.fundValueRsd)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Likvidnost:</span>
                          <span className="font-medium text-green-700">{formatRSD(f.liquidityRsd)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Client / Agent: show their fund positions + invest option
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary-600" />
                  <h2 className="text-sm font-semibold text-gray-700">Moje pozicije u fondovima</h2>
                </div>
              </div>
              {clientFunds.length === 0 ? (
                <div className="bg-white rounded-xl shadow text-center py-16 text-gray-400 text-sm">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p>Nemate pozicija u investicionim fondovima.</p>
                  <p className="mt-1 text-xs">Kontaktirajte vašeg savetnika za investicione mogućnosti.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clientFunds.map((f) => {
                    const profitPos = f.profit >= 0
                    return (
                      <div key={f.id} className="bg-white rounded-xl shadow p-5 space-y-3">
                        <h3 className="font-semibold text-gray-900">{f.name}</h3>
                        {f.description && <p className="text-sm text-gray-500">{f.description}</p>}
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Vrednost fonda:</span>
                            <span className="font-medium">{formatRSD(f.fundValueRsd)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Vaš udeo:</span>
                            <span className="font-medium">{f.sharePercent.toFixed(2)}% ({formatRSD(f.shareRsd)})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Investirano:</span>
                            <span className="font-medium">{formatRSD(f.investedRsd)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Profit:</span>
                            <span className={`font-semibold ${profitPos ? 'text-green-600' : 'text-red-500'}`}>
                              {profitPos ? '+' : ''}{formatRSD(f.profit)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="primary"
                            className="flex-1"
                            onClick={() => {
                              setInvestAmount('')
                              setInvestDialog({ fund: f })
                            }}
                          >
                            Investiraj
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => {
                              setWithdrawAll(true)
                              setWithdrawAmt('')
                              setWithdrawDialog({ fund: f })
                            }}
                          >
                            Povuci
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Publish shares dialog */}
      <Dialog
        open={!!publishDialog}
        onClose={() => !publishLoading && setPublishDialog(null)}
        title={`Objavi akcije ${publishDialog?.holding.ticker ?? ''} za OTC`}
        maxWidth="sm"
      >
        {publishDialog && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ukupno posedujete: <strong>{publishDialog.holding.quantity}</strong> akcija.<br />
              Već javno: <strong>{publishDialog.holding.publicShares}</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Broj akcija za objavu (max {publishDialog.holding.quantity - publishDialog.holding.publicShares})
              </label>
              <input
                type="number"
                min={1}
                max={publishDialog.holding.quantity - publishDialog.holding.publicShares}
                value={publishQty}
                onChange={(e) => setPublishQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setPublishDialog(null)} disabled={publishLoading}>Odustani</Button>
              <Button variant="primary" size="sm" onClick={handlePublish} disabled={publishLoading}>
                {publishLoading ? 'Objavljivanje…' : 'Objavi'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Exercise option dialog */}
      <Dialog
        open={!!exerciseDialog}
        onClose={() => !exerciseLoading && setExerciseDialog(null)}
        title="Iskoristi opciju"
        maxWidth="sm"
      >
        {exerciseDialog && (() => {
          const d = parseOptionDetails(exerciseDialog.holding.detailsJson)
          const sharesPerOpt = 100
          const totalShares = exerciseDialog.holding.quantity * sharesPerOpt
          const profit = d.option_type?.toUpperCase() === 'PUT'
            ? ((d.strike_price ?? 0) - exerciseDialog.holding.currentPrice) * totalShares
            : (exerciseDialog.holding.currentPrice - (d.strike_price ?? 0)) * totalShares
          return (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 space-y-1">
                <div>Tip opcije: <strong>{d.option_type}</strong></div>
                <div>Strike cena: <strong>{formatUSD(d.strike_price ?? 0)}</strong></div>
                <div>Tržišna cena: <strong>{formatUSD(exerciseDialog.holding.currentPrice)}</strong></div>
                <div>Broj akcija (×100): <strong>{totalShares}</strong></div>
                <div>Procenjen profit: <strong className={profit >= 0 ? 'text-green-700' : 'text-red-600'}>{formatUSD(profit)}</strong></div>
              </div>
              {profit < 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Opcija je in the money, ali profit je negativan zbog premije. Svejedno nastaviti?
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setExerciseDialog(null)} disabled={exerciseLoading}>Odustani</Button>
                <Button variant="primary" size="sm" onClick={handleExercise} disabled={exerciseLoading}>
                  {exerciseLoading ? 'Obrada…' : 'Iskoristi opciju'}
                </Button>
              </div>
            </div>
          )
        })()}
      </Dialog>

      {/* Invest dialog */}
      <Dialog
        open={!!investDialog}
        onClose={() => !investLoading && setInvestDialog(null)}
        title={`Investiraj u fond: ${investDialog?.fund.name ?? ''}`}
        maxWidth="sm"
      >
        {investDialog && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Iznos</label>
              <input
                type="number" min="0.01" step="0.01" placeholder="0.00"
                value={investAmount} onChange={(e) => setInvestAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            {accounts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Račun</label>
                <select
                  value={investAccountId} onChange={(e) => setInvestAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.broj_racuna} — {a.raspolozivo_stanje.toFixed(2)} {a.valuta_oznaka}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setInvestDialog(null)} disabled={investLoading}>Odustani</Button>
              <Button variant="primary" size="sm" onClick={handleInvest} disabled={investLoading}>
                {investLoading ? 'Obrada…' : 'Investiraj'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Withdraw dialog */}
      <Dialog
        open={!!withdrawDialog}
        onClose={() => !withdrawLoading && setWithdrawDialog(null)}
        title={`Povuci iz fonda: ${withdrawDialog?.fund.name ?? ''}`}
        maxWidth="sm"
      >
        {withdrawDialog && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={withdrawAll} onChange={(e) => setWithdrawAll(e.target.checked)}
                  className="rounded" />
                Povuci sve ({formatRSD(withdrawDialog.fund.investedRsd)})
              </label>
            </div>
            {!withdrawAll && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Iznos (RSD)</label>
                <input
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            )}
            {accounts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Uplati na račun</label>
                <select
                  value={withdrawAccountId} onChange={(e) => setWithdrawAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.broj_racuna} — {a.raspolozivo_stanje.toFixed(2)} {a.valuta_oznaka}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setWithdrawDialog(null)} disabled={withdrawLoading}>Odustani</Button>
              <Button variant="primary" size="sm" onClick={handleWithdraw} disabled={withdrawLoading}>
                {withdrawLoading ? 'Obrada…' : 'Povuci'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
