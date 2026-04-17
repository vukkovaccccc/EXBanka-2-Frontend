import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { getListings } from '@/services/listingsService'
import type { Listing } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner'

// ─── Tipovi ───────────────────────────────────────────────────────────────────

interface ParsedOption {
  listing: Listing
  expiry: string   // YYYY-MM-DD
  isCall: boolean
  strike: number
}

interface ExpiryGroup {
  expiry: string
  daysUntilExpiry: number
  calls: ParsedOption[]
  puts: ParsedOption[]
  strikes: number[]
}

interface Props {
  /** Ticker underlying akcije, npr. "AAPL" */
  underlying: string
  /** Trenutna cena underlying akcije — koristi se za ITM/OTM bojenje */
  stockPrice: number
}

// ─── Parsiranje OCC tickera ───────────────────────────────────────────────────

/** Vraća broj slova (početni deo tickera = underlying simbol). */
function underlyingPrefixLength(ticker: string): number {
  let i = 0
  while (i < ticker.length && /[A-Za-z]/.test(ticker[i])) i++
  return i
}

/**
 * Parsira OCC opcijski ticker u komponente.
 * Format: {UNDERLYING}{YYMMDD}{C|P}{8-digit-strike×1000}
 * Primer: "AAPL260419C00200000" → expiry="2026-04-19", isCall=true, strike=200.00
 */
function parseOCCTicker(ticker: string): { expiry: string; isCall: boolean; strike: number } | null {
  const n = underlyingPrefixLength(ticker)
  if (n === 0) return null
  const rest = ticker.slice(n)
  const m = rest.match(/^(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/)
  if (!m) return null
  const year = 2000 + parseInt(m[1], 10)
  const expiry = `${year}-${m[2]}-${m[3]}`
  const isCall = m[4] === 'C'
  const strike = parseInt(m[5], 10) / 1000
  return { expiry, isCall, strike }
}

// ─── Datumski pomoćnici ───────────────────────────────────────────────────────

/** Broj dana od danas do datuma isteka (negativan ako je prošao). */
function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Formatiranje ─────────────────────────────────────────────────────────────

function fmt2(n: number): string {
  return n.toFixed(2)
}

// ─── Prikaz jedne ćelije opcije u lancu ──────────────────────────────────────

function OptionCells({ opt, cls }: { opt: ParsedOption | undefined; cls: string }) {
  if (!opt) {
    return (
      <>
        <td className={`px-2 py-1.5 text-right font-mono ${cls}`}>—</td>
        <td className={`px-2 py-1.5 text-right font-mono ${cls}`}>—</td>
        <td className={`px-2 py-1.5 text-right font-mono ${cls}`}>—</td>
        <td className={`px-2 py-1.5 text-right font-mono ${cls}`}>—</td>
        <td className={`px-2 py-1.5 text-right font-mono ${cls}`}>—</td>
      </>
    )
  }
  const vol = parseInt(opt.listing.volume, 10)
  const chgPct = opt.listing.changePercent
  // Apsolutna promena: izvedena iz % promene (changePercent = change/prev_close*100)
  const absChange =
    chgPct !== 0
      ? opt.listing.price * (chgPct / 100) / (1 + chgPct / 100)
      : 0
  return (
    <>
      <td className={`px-2 py-1.5 text-right font-mono text-xs ${cls}`}>
        {fmt2(opt.listing.price)}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-xs ${cls}`}>
        {fmt2(absChange)}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-xs ${cls}`}>
        {chgPct !== 0 ? `${chgPct.toFixed(2)}%` : '—'}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-xs ${cls}`}>
        {isNaN(vol) ? '0' : vol.toLocaleString()}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-xs ${cls}`}>
        0
      </td>
    </>
  )
}

// ─── Tabela opcijskog lanca za odabrani datum ─────────────────────────────────

function OptionsChainTable({
  group,
  stockPrice,
}: {
  group: ExpiryGroup
  stockPrice: number
}) {
  const [showItm, setShowItm] = useState(false)

  const visibleStrikes = useMemo(
    () =>
      showItm
        ? group.strikes.filter((s) => s < stockPrice || s > stockPrice)
        : group.strikes,
    [group.strikes, stockPrice, showItm]
  )

  return (
    <div className="mt-3 space-y-2">
      {/* Kontrole */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Cena akcije:{' '}
          <span className="font-semibold text-gray-800">${fmt2(stockPrice)}</span>
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showItm}
              onChange={(e) => setShowItm(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-300"
            />
            <span>Samo In The Money</span>
          </label>
        </div>
      </div>

      {/* Legenda */}
      <p className="text-[10px] text-gray-400 flex flex-wrap gap-3">
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded bg-green-100 border border-green-200 align-middle mr-1" />
          ITM (in-the-money)
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded bg-red-50 border border-red-100 align-middle mr-1" />
          OTM (out-of-the-money)
        </span>
        <span>CALL ITM: strike &lt; {fmt2(stockPrice)} · PUT ITM: strike &gt; {fmt2(stockPrice)}</span>
      </p>

      {/* Tabela */}
      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        <table className="w-full text-xs border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                colSpan={5}
                className="text-center py-2 bg-green-50 text-green-700 font-semibold text-[10px] uppercase tracking-wide"
              >
                CALLS
              </th>
              <th className="text-center py-2 bg-gray-100 text-gray-700 font-semibold px-4 text-[10px] uppercase tracking-wide">
                Strike ▲
              </th>
              <th
                colSpan={5}
                className="text-center py-2 bg-red-50 text-red-700 font-semibold text-[10px] uppercase tracking-wide"
              >
                PUTS
              </th>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-2 py-2 text-right">Last Price</th>
              <th className="px-2 py-2 text-right">Change</th>
              <th className="px-2 py-2 text-right">% Change</th>
              <th className="px-2 py-2 text-right">Volume</th>
              <th className="px-2 py-2 text-right">Open Int.</th>
              <th className="px-4 py-2 text-center bg-gray-100 text-gray-700 font-semibold">
                Cena
              </th>
              <th className="px-2 py-2 text-right">Last Price</th>
              <th className="px-2 py-2 text-right">Change</th>
              <th className="px-2 py-2 text-right">% Change</th>
              <th className="px-2 py-2 text-right">Volume</th>
              <th className="px-2 py-2 text-right">Open Int.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleStrikes.map((strike) => {
              const call = group.calls.find((o) => o.strike === strike)
              const put = group.puts.find((o) => o.strike === strike)
              const callItm = strike < stockPrice
              const putItm = strike > stockPrice
              const callCls = callItm
                ? 'bg-green-50 text-green-900'
                : 'bg-red-50 text-red-900'
              const putCls = putItm
                ? 'bg-green-50 text-green-900'
                : 'bg-red-50 text-red-900'
              return (
                <tr key={strike} className="hover:bg-gray-50/80">
                  <OptionCells opt={call} cls={callCls} />
                  <td className="px-4 py-1.5 text-center font-bold bg-gray-100 text-gray-900 whitespace-nowrap">
                    ${fmt2(strike)}
                  </td>
                  <OptionCells opt={put} cls={putCls} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Glavna komponenta ────────────────────────────────────────────────────────

/**
 * Pristup 2: Prikazuje tabelu datuma isteka opcija za datu akciju.
 * Klikom na datum otvara se detaljan prikaz opcijskog lanca (Calls | Strike | Puts).
 */
export default function OptionsExpiryApproach2({ underlying, stockPrice }: Props) {
  const [allOptions, setAllOptions] = useState<ParsedOption[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const u = underlying.trim()
    if (!u) {
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    setSelectedExpiry(null)

    getListings({
      listingType: 'OPTION',
      search: u,
      page: 1,
      pageSize: 500,
      sortBy: 'ticker',
      sortOrder: 'ASC',
    })
      .then((res) => {
        if (cancelled) return
        const list = (res.listings ?? []).filter((l) =>
          l.ticker.toUpperCase().startsWith(u.toUpperCase())
        )
        const parsed: ParsedOption[] = []
        for (const l of list) {
          const p = parseOCCTicker(l.ticker)
          if (!p) continue
          parsed.push({ listing: l, ...p })
        }
        setAllOptions(parsed)
        // Automatski otvori prvi (najbliži) datum isteka
        const firstExpiry = [...new Set(parsed.map((p) => p.expiry))].sort()[0]
        if (firstExpiry) setSelectedExpiry(firstExpiry)
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Greška pri učitavanju opcija')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [underlying])

  // Grupišemo opcije po datumu isteka
  const expiryGroups = useMemo<ExpiryGroup[]>(() => {
    const map = new Map<string, { calls: ParsedOption[]; puts: ParsedOption[] }>()
    for (const opt of allOptions) {
      const entry = map.get(opt.expiry) ?? { calls: [], puts: [] }
      if (opt.isCall) entry.calls.push(opt)
      else entry.puts.push(opt)
      map.set(opt.expiry, entry)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([expiry, { calls, puts }]) => {
        const allStrikes = [
          ...new Set([...calls, ...puts].map((o) => o.strike)),
        ].sort((a, b) => a - b)
        return {
          expiry,
          daysUntilExpiry: daysUntil(expiry),
          calls,
          puts,
          strikes: allStrikes,
        }
      })
  }, [allOptions])

  const selectedGroup = useMemo(
    () => expiryGroups.find((g) => g.expiry === selectedExpiry) ?? null,
    [expiryGroups, selectedExpiry]
  )

  if (!underlying.trim()) return null

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Opcije — {underlying}
        </h3>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      )}
      {!loading && err && <p className="text-sm text-red-600">{err}</p>}
      {!loading && !err && expiryGroups.length === 0 && (
        <p className="text-sm text-gray-500">
          Nema opcija za ovu akciju. Opcije se generišu pri pokretanju servera.
        </p>
      )}

      {!loading && !err && expiryGroups.length > 0 && (
        <div className="space-y-4">
          {/* Tabela datuma isteka */}
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Kliknite na datum da biste videli opcijski lanac za taj datum.
            </p>
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-2 font-medium">Datum isteka</th>
                    <th className="px-4 py-2 font-medium">Dana do isteka</th>
                    <th className="px-4 py-2 font-medium">Broj opcija</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryGroups.map(({ expiry, daysUntilExpiry, calls, puts }) => {
                    const isSelected = selectedExpiry === expiry
                    const isExpired = daysUntilExpiry < 0
                    return (
                      <tr
                        key={expiry}
                        onClick={() =>
                          setSelectedExpiry(isSelected ? null : expiry)
                        }
                        className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-primary-50' : ''
                        }`}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <ChevronDown className="w-4 h-4 text-primary-600 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                            <span
                              className={`font-medium ${
                                isSelected ? 'text-primary-700' : 'text-gray-900'
                              }`}
                            >
                              {expiry}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-4 py-2 ${
                            isExpired
                              ? 'text-red-500'
                              : daysUntilExpiry <= 7
                              ? 'text-orange-600 font-medium'
                              : 'text-gray-600'
                          }`}
                        >
                          {isExpired ? 'Isteklo' : `${daysUntilExpiry} dana`}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {calls.length + puts.length}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Opcijski lanac za odabrani datum */}
          {selectedGroup && (
            <div className="border border-primary-100 rounded-lg p-4 bg-primary-50/30">
              <h4 className="text-sm font-semibold text-gray-800 mb-1">
                Opcijski lanac — {selectedGroup.expiry}
              </h4>
              <OptionsChainTable group={selectedGroup} stockPrice={stockPrice} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
