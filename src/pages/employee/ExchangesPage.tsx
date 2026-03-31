import { useEffect, useRef, useState } from 'react'
import { TrendingUp, FlaskConical, AlertTriangle, SearchX, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { getAllExchanges, toggleMarketTestMode } from '@/services/exchangeService'
import type { Exchange } from '@/services/exchangeService'
import Button from '@/components/common/Button'

// ─── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={[
        'whitespace-nowrap px-4 py-3 text-sm text-gray-800',
        mono ? 'font-mono text-xs' : '',
      ].join(' ')}
    >
      {children ?? <span className="text-gray-400">—</span>}
    </td>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ExchangesPage() {
  const { hasPermission } = useAuthStore()
  const isSupervisor = hasPermission('SUPERVISOR')

  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [testMode, setTestMode]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [toggling, setToggling]   = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── Search & filter state ─────────────────────────────────────────────────
  const [search, setSearch]   = useState('')
  const [polity, setPolity]   = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function loadExchanges(searchVal: string, polityVal: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await getAllExchanges({
        search: searchVal || undefined,
        polity: polityVal || undefined,
      })
      setExchanges(res.exchanges ?? [])
    } catch (err: unknown) {
      setError((err as Error).message || 'Greška pri učitavanju berzi.')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadExchanges('', '')
  }, [])

  // Re-fetch with 300ms debounce whenever search or polity change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadExchanges(search, polity)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, polity])

  // ── Toggle test mode ──────────────────────────────────────────────────────

  async function handleToggleTestMode() {
    const next = !testMode
    setToggling(true)
    try {
      await toggleMarketTestMode(next)
      setTestMode(next)
      toast.success(
        next
          ? 'Market Test Mode je aktiviran.'
          : 'Market Test Mode je deaktiviran.'
      )
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Greška pri promeni test moda.')
    } finally {
      setToggling(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Test mode active banner */}
      {testMode && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">
            Market Test Mode je trenutno AKTIVAN — radno vreme berzi je preskočeno.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 shrink-0 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Berze</h1>
          {!loading && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {exchanges.length}{' '}
              {exchanges.length === 1 ? 'berza' : exchanges.length < 5 ? 'berze' : 'berzi'}
            </span>
          )}
        </div>

        {/* Market Test Mode toggle – SUPERVISOR only */}
        {isSupervisor && (
          <Button
            variant={testMode ? 'primary' : 'secondary'}
            leftIcon={<FlaskConical className="h-4 w-4" />}
            loading={toggling}
            onClick={handleToggleTestMode}
          >
            {testMode ? 'Deaktiviraj Test Mod' : 'Aktiviraj Test Mod'}
          </Button>
        )}
      </div>

      {/* Search & filter */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="form-label" htmlFor="exchange-search">
              Pretraga
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="exchange-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretraži po nazivu ili akronimu…"
                className="input-base pl-9"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="form-label" htmlFor="exchange-polity">
              Država
            </label>
            <input
              id="exchange-polity"
              type="text"
              value={polity}
              onChange={(e) => setPolity(e.target.value)}
              placeholder="npr. United States"
              className="input-base"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="card py-12 text-center text-gray-400">Učitavanje berzi…</div>

      ) : exchanges.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <SearchX className="h-10 w-10 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {search || polity
              ? 'Nema berzi koje odgovaraju zadatim filterima.'
              : 'Nema dostupnih berzi.'}
          </p>
        </div>

      ) : (
        /* Exchange table */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <Th>Naziv berze</Th>
                  <Th>Akronim</Th>
                  <Th>MIC kod</Th>
                  <Th>Država</Th>
                  <Th>Vremenska zona</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exchanges.map((ex, i) => (
                  <tr
                    key={ex.id ?? i}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <Td>{ex.name}</Td>
                    <Td mono>{ex.acronym}</Td>
                    <Td mono>{ex.micCode}</Td>
                    <Td>{ex.polity}</Td>
                    <Td mono>{ex.timezone}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400">
            Prikazano {exchanges.length} berzi
          </div>
        </div>
      )}

    </div>
  )
}
