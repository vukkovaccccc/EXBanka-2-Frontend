import { useEffect, useState, useMemo } from 'react'
import { Landmark, SearchX } from 'lucide-react'
import { getAllCreditsForEmployee } from '@/services/kreditService'
import type { Kredit } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const VRSTA_LABEL: Record<string, string> = {
  GOTOVINSKI:      'Gotovinski',
  STAMBENI:        'Stambeni',
  AUTO:            'Auto',
  REFINANSIRAJUCI: 'Refinansirajući',
  STUDENTSKI:      'Studentski',
}

const VRSTA_FILTER_OPTIONS = [
  { value: '',               label: 'Sve vrste' },
  { value: 'GOTOVINSKI',      label: 'Gotovinski' },
  { value: 'STAMBENI',        label: 'Stambeni' },
  { value: 'AUTO',            label: 'Auto' },
  { value: 'REFINANSIRAJUCI', label: 'Refinansirajući' },
  { value: 'STUDENTSKI',      label: 'Studentski' },
]

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ODOBREN:     { label: 'Aktivan',      cls: 'bg-green-100 text-green-700' },
  U_KASNJENJU: { label: 'U kašnjenju', cls: 'bg-red-100 text-red-700' },
  OTPLACEN:    { label: 'Otplaćen',    cls: 'bg-gray-100 text-gray-500' },
  ODBIJEN:     { label: 'Odbijen',     cls: 'bg-orange-100 text-orange-700' },
}

const STATUS_FILTER_OPTIONS = [
  { value: '',            label: 'Svi statusi' },
  { value: 'ODOBREN',     label: 'Aktivan' },
  { value: 'U_KASNJENJU', label: 'U kašnjenju' },
  { value: 'OTPLACEN',    label: 'Otplaćen' },
  { value: 'ODBIJEN',     label: 'Odbijen' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, valuta: string): string {
  return `${amount.toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${valuta}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ─── Table header cell ────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={[
        'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
        right ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  )
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td
      className={[
        'whitespace-nowrap px-4 py-3 text-sm text-gray-800',
        right ? 'text-right' : '',
        mono  ? 'font-mono text-xs' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SviKreditiPage() {
  const [credits, setCredits]   = useState<Kredit[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Filters
  const [filterVrsta,  setFilterVrsta]  = useState('')
  const [filterRacun,  setFilterRacun]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    getAllCreditsForEmployee()
      .then((data) =>
        setCredits([...data].sort((a, b) => a.broj_racuna.localeCompare(b.broj_racuna)))
      )
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () =>
      credits.filter((c) => {
        const vrstaOk  = !filterVrsta  || c.vrsta_kredita === filterVrsta
        const racunOk  = !filterRacun.trim()  || c.broj_racuna.toLowerCase().includes(filterRacun.trim().toLowerCase())
        const statusOk = !filterStatus || c.status === filterStatus
        return vrstaOk && racunOk && statusOk
      }),
    [credits, filterVrsta, filterRacun, filterStatus]
  )

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-primary-600 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900">Svi krediti</h1>
          {!loading && (
            <span className="inline-flex items-center rounded-full bg-primary-100 text-primary-700 px-2.5 py-0.5 text-xs font-semibold">
              {credits.length} ukupno
            </span>
          )}
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="form-label">Vrsta kredita</label>
            <select
              value={filterVrsta}
              onChange={(e) => setFilterVrsta(e.target.value)}
              className="input-base"
              data-cy="filter-vrsta"
            >
              {VRSTA_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="form-label">Broj računa</label>
            <input
              type="text"
              value={filterRacun}
              onChange={(e) => setFilterRacun(e.target.value)}
              placeholder="Pretraži…"
              className="input-base"
              data-cy="filter-racun"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="form-label">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-base"
              data-cy="filter-status"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">Učitavanje kredita…</div>

      ) : filtered.length === 0 ? (
        /* ── Empty state ────────────────────────────────────────────────── */
        <div className="card flex flex-col items-center py-14 gap-3 text-center">
          <SearchX className="h-10 w-10 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {credits.length === 0
              ? 'Nema evidentiranih kredita u sistemu.'
              : 'Nema kredita koji odgovaraju zadatim filterima.'}
          </p>
        </div>

      ) : (
        /* ── Table ──────────────────────────────────────────────────────── */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <Th>Vrsta kredita</Th>
                  <Th>Tip kamate</Th>
                  <Th>Datum ugovaranja</Th>
                  <Th>Period</Th>
                  <Th>Broj računa</Th>
                  <Th right>Iznos kredita</Th>
                  <Th right>Preostalo dugovanje</Th>
                  <Th>Valuta</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((kredit) => {
                  const st = STATUS_STYLE[kredit.status] ?? {
                    label: kredit.status,
                    cls: 'bg-gray-100 text-gray-600',
                  }
                  return (
                    <tr
                      key={kredit.id}
                      className="hover:bg-gray-50 transition-colors"
                      data-cy="kredit-row"
                    >
                      <Td>
                        <span className="font-medium text-gray-900">
                          {VRSTA_LABEL[kredit.vrsta_kredita] ?? kredit.vrsta_kredita}
                        </span>
                      </Td>
                      <Td>
                        {kredit.tip_kamate === 'FIKSNA' ? 'Fiksna' : 'Varijabilna'}
                      </Td>
                      <Td>{formatDate(kredit.datum_ugovaranja)}</Td>
                      <Td>{kredit.period_otplate} mes.</Td>
                      <Td mono>{kredit.broj_racuna}</Td>
                      <Td right>
                        <span className="font-semibold text-primary-700">
                          {formatAmount(kredit.ukupan_iznos, kredit.valuta)}
                        </span>
                      </Td>
                      <Td right>
                        <span className={kredit.preostalo_dugovanje > 0 ? 'text-red-600 font-medium' : ''}>
                          {formatAmount(kredit.preostalo_dugovanje, kredit.valuta)}
                        </span>
                      </Td>
                      <Td>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {kredit.valuta}
                        </span>
                      </Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Table footer */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400">
            Prikazano {filtered.length} od {credits.length} kredita · Sortirano po broju računa
          </div>
        </div>
      )}

    </div>
  )
}
