import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, PlusCircle, ChevronRight, CalendarDays, TrendingDown } from 'lucide-react'
import { getClientCredits } from '@/services/kreditService'
import Button from '@/components/common/Button'
import KreditDetailsDialog from './KreditDetailsDialog'
import type { Kredit } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, valuta: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${valuta}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const VRSTA_LABEL: Record<string, string> = {
  GOTOVINSKI: 'Gotovinski',
  STAMBENI: 'Stambeni',
  AUTO: 'Auto',
  REFINANSIRAJUCI: 'Refinansirajući',
  STUDENTSKI: 'Studentski',
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ODOBREN: { label: 'Aktivan', cls: 'bg-green-100 text-green-700' },
  U_KASNJENJU: { label: 'U kašnjenju', cls: 'bg-red-100 text-red-700' },
  OTPLACEN: { label: 'Otplaćen', cls: 'bg-gray-100 text-gray-500' },
  ODBIJEN: { label: 'Odbijen', cls: 'bg-orange-100 text-orange-700' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KreditiPage() {
  const navigate = useNavigate()

  const [credits, setCredits] = useState<Kredit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    getClientCredits()
      .then((data) => {
        setCredits([...data].sort((a, b) => b.ukupan_iznos - a.ukupan_iznos))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Moji krediti</h1>
        <Button
          variant="primary"
          leftIcon={<PlusCircle className="h-4 w-4" />}
          onClick={() => navigate('/client/krediti/novo')}
        >
          Zahtev za kredit
        </Button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">Učitavanje kredita…</div>
      ) : credits.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────────────── */
        <div className="card flex flex-col items-center justify-center py-16 gap-5 text-center">
          <div className="rounded-full bg-primary-50 p-5">
            <Landmark className="h-10 w-10 text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Nemate aktivnih kredita</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Podnesite zahtev za kredit i dobijte odgovor u kratkom roku. Nudimo gotovinske,
              stambene, auto i studentske kredite.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            leftIcon={<PlusCircle className="h-5 w-5" />}
            onClick={() => navigate('/client/krediti/novo')}
            data-cy="empty-state-cta"
          >
            Podnesi zahtev za kredit
          </Button>
        </div>
      ) : (
        /* ── Credits grid ────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {credits.map((kredit) => {
            const status = STATUS_STYLE[kredit.status] ?? {
              label: kredit.status,
              cls: 'bg-gray-100 text-gray-600',
            }

            return (
              <div
                key={kredit.id}
                className="card flex flex-col gap-4 hover:shadow-md transition-shadow"
                data-cy="kredit-card"
              >
                {/* Card header: name + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 truncate font-mono mb-0.5">
                      {kredit.broj_kredita}
                    </p>
                    <h2 className="text-base font-bold text-gray-900">
                      {VRSTA_LABEL[kredit.vrsta_kredita] ?? kredit.vrsta_kredita}
                    </h2>
                  </div>
                  <span
                    className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Main amount */}
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Ukupan iznos</p>
                  <p className="text-2xl font-bold text-primary-700">
                    {formatAmount(kredit.ukupan_iznos, kredit.valuta)}
                  </p>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <TrendingDown className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Preostalo</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {formatAmount(kredit.preostalo_dugovanje, kredit.valuta)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Sledeća rata</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {formatAmount(kredit.iznos_sledece_rate, kredit.valuta)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(kredit.datum_sledece_rate)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setDetailId(kredit.id)}
                    className="flex w-full items-center justify-between text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors"
                    data-cy="detalji-btn"
                  >
                    <span>Pogledaj detalje</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Details dialog ────────────────────────────────────────────────── */}
      {detailId !== null && (
        <KreditDetailsDialog kreditId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}
