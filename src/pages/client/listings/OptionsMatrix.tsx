import { useMemo, useState } from 'react'
import type { ListingDetail } from '@/types'

interface OptionRow {
  strike: number
  callLast: number
  callTheta: number
  callBid: number
  callAsk: number
  callVol: number
  callOI: number
  putLast: number
  putTheta: number
  putBid: number
  putAsk: number
  putVol: number
  putOI: number
}

interface OptionsData {
  options?: Array<{
    strike: number
    callBid: number
    callAsk: number
    callVol: number
    callOI: number
    putBid: number
    putAsk: number
    putVol: number
    putOI: number
    callLast?: number
    callTheta?: number
    putLast?: number
    putTheta?: number
  }>
}

interface Props {
  listing: ListingDetail
}

function parseOptions(detailsJson: string): OptionRow[] {
  try {
    const data: OptionsData = JSON.parse(detailsJson)
    const raw = data.options ?? []
    return raw.map((r) => {
      const callMid = (r.callBid + r.callAsk) / 2
      const putMid = (r.putBid + r.putAsk) / 2
      return {
        strike: r.strike,
        callLast: r.callLast ?? callMid,
        callTheta: r.callTheta ?? -0.05,
        callBid: r.callBid,
        callAsk: r.callAsk,
        callVol: r.callVol,
        callOI: r.callOI,
        putLast: r.putLast ?? putMid,
        putTheta: r.putTheta ?? -0.04,
        putBid: r.putBid,
        putAsk: r.putAsk,
        putVol: r.putVol,
        putOI: r.putOI,
      }
    })
  } catch {
    return []
  }
}

function fmt(n: number): string {
  return n.toFixed(2)
}

export default function OptionsMatrix({ listing }: Props) {
  const spot = listing.base.price
  const allRows = useMemo(() => parseOptions(listing.detailsJson), [listing.detailsJson])
  const [strikesEachSide, setStrikesEachSide] = useState(2)

  const rows = useMemo(() => {
    if (allRows.length === 0) return []
    const sorted = [...allRows].sort((a, b) => a.strike - b.strike)
    let best = 0
    let bestDiff = Math.abs(sorted[0].strike - spot)
    for (let i = 1; i < sorted.length; i++) {
      const d = Math.abs(sorted[i].strike - spot)
      if (d < bestDiff) {
        bestDiff = d
        best = i
      }
    }
    const from = Math.max(0, best - strikesEachSide)
    const to = Math.min(sorted.length, best + strikesEachSide + 1)
    return sorted.slice(from, to)
  }, [allRows, spot, strikesEachSide])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Matrica opcija</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-500">
            Shared Price:{' '}
            <span className="font-semibold text-gray-900">${spot.toFixed(2)}</span>
          </span>
          <label className="flex items-center gap-2 text-gray-600">
            <span className="whitespace-nowrap">Strike redova oko cene</span>
            <select
              value={strikesEachSide}
              onChange={(e) => setStrikesEachSide(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} iznad / {n} ispod
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">
          Nema dostupnih podataka o opcijama za ovu akciju.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <p className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-4">
            <span>
              <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200 align-middle mr-1" />
              ITM (in-the-money)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200 align-middle mr-1" />
              OTM (out-of-the-money)
            </span>
            <span className="text-gray-400">| CALL ITM: strike &lt; spot · PUT ITM: strike &gt; spot</span>
          </p>
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th
                  colSpan={6}
                  className="text-center text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-50 px-2 py-2"
                >
                  CALLS
                </th>
                <th className="text-center text-xs font-semibold uppercase tracking-wide text-gray-700 bg-gray-100 px-3 py-2">
                  Strike
                </th>
                <th
                  colSpan={6}
                  className="text-center text-xs font-semibold uppercase tracking-wide text-red-700 bg-red-50 px-2 py-2"
                >
                  PUTS
                </th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-1 py-2 text-right">Last</th>
                <th className="px-1 py-2 text-right">Theta</th>
                <th className="px-1 py-2 text-right">Bid</th>
                <th className="px-1 py-2 text-right">Ask</th>
                <th className="px-1 py-2 text-right">Vol</th>
                <th className="px-1 py-2 text-right">OI</th>
                <th className="px-3 py-2 text-center bg-gray-100 font-semibold text-gray-700">
                  Cena
                </th>
                <th className="px-1 py-2 text-right">Last</th>
                <th className="px-1 py-2 text-right">Theta</th>
                <th className="px-1 py-2 text-right">Bid</th>
                <th className="px-1 py-2 text-right">Ask</th>
                <th className="px-1 py-2 text-right">Vol</th>
                <th className="px-1 py-2 text-right">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const callITM = row.strike < spot
                const putITM = row.strike > spot

                const itmClass = 'bg-green-50 text-green-900'
                const otmClass = 'bg-red-50 text-red-900'

                const callCellClass = callITM ? itmClass : otmClass
                const putCellClass = putITM ? itmClass : otmClass

                return (
                  <tr key={row.strike} className="hover:bg-gray-50/80">
                    <td className={`px-1 py-2 text-right font-mono text-xs ${callCellClass}`}>
                      {fmt(row.callLast)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${callCellClass}`}>
                      {fmt(row.callTheta)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${callCellClass}`}>
                      {fmt(row.callBid)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${callCellClass}`}>
                      {fmt(row.callAsk)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${callCellClass}`}>
                      {row.callVol.toLocaleString()}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${callCellClass}`}>
                      {row.callOI.toLocaleString()}
                    </td>

                    <td className="px-3 py-2 text-center font-bold bg-gray-100 text-gray-900">
                      ${row.strike.toFixed(2)}
                    </td>

                    <td className={`px-1 py-2 text-right font-mono text-xs ${putCellClass}`}>
                      {fmt(row.putLast)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${putCellClass}`}>
                      {fmt(row.putTheta)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${putCellClass}`}>
                      {fmt(row.putBid)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${putCellClass}`}>
                      {fmt(row.putAsk)}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${putCellClass}`}>
                      {row.putVol.toLocaleString()}
                    </td>
                    <td className={`px-1 py-2 text-right font-mono text-xs ${putCellClass}`}>
                      {row.putOI.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
