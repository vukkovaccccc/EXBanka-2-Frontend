import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ChevronRight } from 'lucide-react'
import { getListings } from '@/services/listingsService'
import type { Listing } from '@/types'
import { hartijeDetailPath } from '@/router/helpers'
import LoadingSpinner from '@/components/common/LoadingSpinner'

/** Dužina underlying prefiksa u OCC tickera (npr. MSFT u MSFT220404C00180000). */
function underlyingPrefixLength(ticker: string): number {
  let i = 0
  while (i < ticker.length && /[A-Za-z]/.test(ticker[i])) i++
  return i
}

/** Parsira YYMMDD iz tickera odmah posle underlying slova. */
function expiryFromOptionTicker(ticker: string): string | null {
  const n = underlyingPrefixLength(ticker)
  const rest = ticker.slice(n)
  const m = rest.match(/^(\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const yy = parseInt(m[1], 10)
  const year = 2000 + yy
  return `${year}-${m[2]}-${m[3]}`
}

interface GroupRow {
  expiry: string
  listings: Listing[]
}

interface Props {
  underlying: string
  currentListingId: string
}

/**
 * Pristup 2: tabela datuma isteka za isti underlying + link na detalj kontrakta.
 */
export default function OptionsExpiryApproach2({ underlying, currentListingId }: Props) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const u = underlying.trim()
    if (!u) {
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
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
        const list = (res.listings ?? []).filter(
          (l) => l.ticker.toUpperCase().startsWith(u.toUpperCase())
        )
        const map = new Map<string, Listing[]>()
        for (const l of list) {
          const exp = expiryFromOptionTicker(l.ticker)
          if (!exp) continue
          const cur = map.get(exp) ?? []
          cur.push(l)
          map.set(exp, cur)
        }
        const sorted = [...map.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([expiry, listings]) => ({ expiry, listings }))
        setRows(sorted)
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Greška pri učitavanju')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [underlying])

  const currentExpiry = useMemo(() => {
    const cur = rows
      .flatMap((r) => r.listings)
      .find((l) => l.id === currentListingId)
    if (!cur) return null
    return expiryFromOptionTicker(cur.ticker)
  }, [rows, currentListingId])

  if (!underlying.trim()) return null

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">Opcije — pregled po datumu isteka</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Kontrakti sa istim underlying simbolom grupisani su po datumu isteka (iz tickera). Klik na
        red otvara jedan kontrakt za taj datum.
      </p>

      {loading && (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      )}
      {!loading && err && <p className="text-sm text-red-600">{err}</p>}
      {!loading && !err && rows.length === 0 && (
        <p className="text-sm text-gray-500">Nema dodatnih opcijskih listinga za ovaj underlying.</p>
      )}
      {!loading && !err && rows.length > 0 && (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-2 font-medium">Datum isteka</th>
                <th className="px-4 py-2 font-medium">Broj kontrakata</th>
                <th className="px-4 py-2 font-medium w-40">Akcija</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ expiry, listings }) => {
                const sample = listings[0]
                const isCurrent =
                  currentExpiry === expiry ||
                  listings.some((l) => l.id === currentListingId)
                return (
                  <tr
                    key={expiry}
                    className={`border-t border-gray-100 ${isCurrent ? 'bg-primary-50/60' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900">{expiry}</td>
                    <td className="px-4 py-2 text-gray-600">{listings.length}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => navigate(hartijeDetailPath(sample.id))}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Detalji
                        <ChevronRight className="w-4 h-4" />
                      </button>
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
