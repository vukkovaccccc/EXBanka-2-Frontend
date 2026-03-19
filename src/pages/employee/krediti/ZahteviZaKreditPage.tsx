import { useEffect, useState, useMemo } from 'react'
import { FileText, CheckCircle2, XCircle, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAllCreditRequests, approveCredit, rejectCredit } from '@/services/kreditService'
import Button from '@/components/common/Button'
import type { KreditZahtev } from '@/types'

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

const STATUS_ZAP_LABEL: Record<string, string> = {
  STALNO:     'Stalno',
  PRIVREMENO: 'Privremeno',
  NEZAPOSLEN: 'Nezaposlen/a',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, valuta: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${valuta}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// Compact key-value cell used inside each request card
function DataItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 truncate">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value ?? '—'}</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ZahteviZaKreditPage() {
  const [requests, setRequests]     = useState<KreditZahtev[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // Filters
  const [filterVrsta, setFilterVrsta] = useState('')
  const [filterRacun, setFilterRacun] = useState('')

  useEffect(() => {
    getAllCreditRequests()
      .then((data) => {
        setRequests(
          [...data].sort(
            (a, b) =>
              new Date(b.datum_podnosenja).getTime() -
              new Date(a.datum_podnosenja).getTime()
          )
        )
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () =>
      requests.filter((r) => {
        const vrstaOk = !filterVrsta || r.vrsta_kredita === filterVrsta
        const racunOk =
          !filterRacun.trim() ||
          r.broj_racuna.toLowerCase().includes(filterRacun.trim().toLowerCase())
        return vrstaOk && racunOk
      }),
    [requests, filterVrsta, filterRacun]
  )

  // ── Approve (optimistic) ───────────────────────────────────────────────────
  async function handleApprove(id: string) {
    const snapshot = requests
    setRequests((rs) => rs.filter((r) => r.id !== id))
    setApprovingId(id)
    try {
      await approveCredit(id)
      toast.success('Zahtev za kredit je odobren.')
    } catch (err: unknown) {
      setRequests(snapshot)
      toast.error((err as Error).message || 'Greška pri odobravanju zahteva.')
    } finally {
      setApprovingId(null)
    }
  }

  // ── Reject (optimistic) ────────────────────────────────────────────────────
  async function handleReject(id: string) {
    const snapshot = requests
    setRequests((rs) => rs.filter((r) => r.id !== id))
    setRejectingId(id)
    try {
      await rejectCredit(id)
      toast.success('Zahtev za kredit je odbijen.')
    } catch (err: unknown) {
      setRequests(snapshot)
      toast.error((err as Error).message || 'Greška pri odbijanju zahteva.')
    } finally {
      setRejectingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary-600 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900">Zahtevi za kredit</h1>
          {!loading && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
              {requests.length} na čekanju
            </span>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
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
          <div className="flex-1 min-w-[180px]">
            <label className="form-label">Broj računa</label>
            <input
              type="text"
              value={filterRacun}
              onChange={(e) => setFilterRacun(e.target.value)}
              placeholder="Pretraži po broju računa…"
              className="input-base"
              data-cy="filter-racun"
            />
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">Učitavanje zahteva…</div>

      ) : filtered.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────── */
        <div className="card flex flex-col items-center py-14 gap-3 text-center">
          <Inbox className="h-10 w-10 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {requests.length === 0
              ? 'Nema zahteva za kredit na čekanju.'
              : 'Nema zahteva koji odgovaraju zadatim filterima.'}
          </p>
        </div>

      ) : (
        /* ── Request cards ────────────────────────────────────────────── */
        <div className="space-y-4">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="card"
              data-cy="zahtev-card"
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="inline-flex rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
                    Na čekanju
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {VRSTA_LABEL[req.vrsta_kredita] ?? req.vrsta_kredita} kredit
                  </span>
                  <span className="text-xs text-gray-400">
                    Podneto: {formatDate(req.datum_podnosenja)}
                  </span>
                </div>
                <span className="text-xs font-mono text-gray-400" data-cy="zahtev-racun">
                  {req.broj_racuna}
                </span>
              </div>

              {/* Content + action buttons */}
              <div className="flex gap-5 items-start">

                {/* Fields grid — all client-submitted data */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-3">
                  <DataItem label="Vrsta kredita"   value={VRSTA_LABEL[req.vrsta_kredita] ?? req.vrsta_kredita} />
                  <DataItem label="Tip kamate"      value={req.tip_kamatne_stope === 'FIKSNA' ? 'Fiksna' : 'Varijabilna'} />
                  <DataItem label="Iznos"           value={formatAmount(req.iznos, req.valuta)} />
                  <DataItem label="Rok otplate"     value={`${req.rok_otplate} mes.`} />
                  <DataItem label="Svrha"           value={req.svrha} />
                  <DataItem label="Mesečna plata"   value={formatAmount(req.mesecna_plata, 'RSD')} />
                  <DataItem label="Status zap."     value={STATUS_ZAP_LABEL[req.status_zaposlenja] ?? req.status_zaposlenja} />
                  <DataItem label="Period zap."     value={`${req.period_zaposlenja} mes.`} />
                  <DataItem label="Telefon"         value={req.kontakt_telefon} />
                  <DataItem label="Broj računa"     value={<span className="font-mono text-xs">{req.broj_racuna}</span>} />
                </div>

                {/* Action buttons */}
                <div className="shrink-0 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={approvingId === req.id}
                    disabled={
                      approvingId === req.id ||
                      rejectingId === req.id ||
                      approvingId !== null ||
                      rejectingId !== null
                    }
                    onClick={() => handleApprove(req.id)}
                    leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    data-cy="odobri-btn"
                  >
                    Odobri
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={rejectingId === req.id}
                    disabled={
                      approvingId === req.id ||
                      rejectingId === req.id ||
                      approvingId !== null ||
                      rejectingId !== null
                    }
                    onClick={() => handleReject(req.id)}
                    leftIcon={<XCircle className="h-3.5 w-3.5" />}
                    data-cy="odbij-btn"
                  >
                    Odbij
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
