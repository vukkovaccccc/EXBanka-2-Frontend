import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import { getCreditDetails } from '@/services/kreditService'
import Dialog from '@/components/common/Dialog'
import type { KreditDetail } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, valuta: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${valuta}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatPercent(v: number): string {
  return `${v.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

const VRSTA_LABEL: Record<string, string> = {
  GOTOVINSKI:    'Gotovinski',
  STAMBENI:      'Stambeni',
  AUTO:          'Auto',
  REFINANSIRAJUCI: 'Refinansirajući',
  STUDENTSKI:    'Studentski',
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

interface FieldRowProps { label: string; value: React.ReactNode }
function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 sm:w-52 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  kreditId: string
  onClose: () => void
}

export default function KreditDetailsDialog({ kreditId, onClose }: Props) {
  const [detail, setDetail] = useState<KreditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCreditDetails(kreditId)
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [kreditId])

  return (
    <Dialog open onClose={onClose} title="Detalji kredita" maxWidth="lg">
      {loading && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-gray-400">Učitavanje detalja…</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {detail && (
        <div>
          {/* Subtitle badge */}
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="h-5 w-5 text-primary-500" />
            <span className="text-sm font-semibold text-primary-700">
              {VRSTA_LABEL[detail.kredit.vrsta_kredita] ?? detail.kredit.vrsta_kredita} kredit · {detail.kredit.valuta}
            </span>
          </div>

          <FieldRow label="Broj kredita" value={
            <span className="font-mono text-xs tracking-wide">{detail.kredit.broj_kredita}</span>
          } />
          <FieldRow label="Vrsta kredita" value={VRSTA_LABEL[detail.kredit.vrsta_kredita] ?? detail.kredit.vrsta_kredita} />
          <FieldRow label="Tip kamatne stope" value={detail.kredit.tip_kamate === 'FIKSNA' ? 'Fiksna' : 'Varijabilna'} />
          <FieldRow label="Iznos" value={
            <span className="text-primary-700 font-bold">{formatAmount(detail.kredit.ukupan_iznos, detail.kredit.valuta)}</span>
          } />
          <FieldRow label="Valuta" value={detail.kredit.valuta} />
          <FieldRow label="Period otplate" value={`${detail.kredit.period_otplate} meseci`} />
          <FieldRow label="Nominalna kamatna stopa" value={formatPercent(detail.kredit.kamatna_stopa)} />
          <FieldRow label="Efektivna kamatna stopa" value={formatPercent(detail.kredit.efektivna_kamatna_stopa)} />
          <FieldRow label="Datum ugovaranja" value={formatDate(detail.kredit.datum_ugovaranja)} />
          <FieldRow label="Datum isplate" value={formatDate(detail.kredit.datum_isplate)} />
          <FieldRow label="Iznos sledeće rate" value={formatAmount(detail.kredit.iznos_sledece_rate, detail.kredit.valuta)} />
          <FieldRow label="Datum sledeće rate" value={formatDate(detail.kredit.datum_sledece_rate)} />
          <FieldRow label="Preostalo dugovanje" value={
            <span className="text-red-600 font-semibold">{formatAmount(detail.kredit.preostalo_dugovanje, detail.kredit.valuta)}</span>
          } />
          <FieldRow label="Broj računa" value={
            <span className="font-mono text-xs">{detail.kredit.broj_racuna}</span>
          } />
        </div>
      )}
    </Dialog>
  )
}
