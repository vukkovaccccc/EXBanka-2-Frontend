import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, BarChart2, Pencil, User } from 'lucide-react'
import { getClientById } from '@/services/clientService'
import {
  getClientTradePermission,
  setClientTradePermission,
} from '@/services/clientTradePermissionService'
import Button from '@/components/common/Button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import ErrorMessage from '@/components/common/ErrorMessage'
import { GrpcStatus } from '@/types'
import type { ClientDetail } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDateOfBirth(timestampMs: number): string {
  if (!timestampMs) return '—'
  return new Date(timestampMs).toLocaleDateString('sr-Latn-RS', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  })
}

export function formatGender(gender: string): string {
  switch (gender) {
    case 'MALE':   return 'Muški'
    case 'FEMALE': return 'Ženski'
    case 'OTHER':  return 'Ostalo'
    default:       return '—'
  }
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string
  value: React.ReactNode
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value ?? '—'}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tradePermission, setTradePermission] = useState<boolean | null>(null)
  const [tradePermissionLoading, setTradePermissionLoading] = useState(false)
  const [tradeSaving, setTradeSaving] = useState(false)

  const loadTradePermission = useCallback(async (clientId: string) => {
    setTradePermissionLoading(true)
    try {
      const has = await getClientTradePermission(clientId)
      setTradePermission(has)
    } catch {
      setTradePermission(null)
      toast.error('Nije moguće učitati status dozvole za trgovanje.')
    } finally {
      setTradePermissionLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const data = await getClientById(id)
        setClient(data)
        void loadTradePermission(id)
      } catch (err) {
        const e = err as Error & { grpcCode?: number }
        if (e.grpcCode === GrpcStatus.NOT_FOUND) {
          setError('Klijent nije pronađen.')
        } else {
          setError(e.message ?? 'Greška pri učitavanju podataka o klijentu.')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, loadTradePermission])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const handleTradeToggle = async () => {
    if (!id || tradePermission === null || tradeSaving) return
    setTradeSaving(true)
    try {
      const next = await setClientTradePermission(id, !tradePermission)
      setTradePermission(next)
      toast.success(
        next
          ? 'Klijentu je dodeljena dozvola za trgovanje hartijama (TRADE_STOCKS).'
          : 'Dozvola za trgovanje hartijama je uklonjena.'
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Greška pri čuvanju dozvole.')
    } finally {
      setTradeSaving(false)
    }
  }

  if (error || !client) {
    return (
      <div className="max-w-lg mt-8 space-y-4">
        <ErrorMessage message={error ?? 'Klijent nije pronađen.'} />
        <Button
          variant="secondary"
          onClick={() => navigate('/employee/clients')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Nazad na listu
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => navigate('/employee/clients')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Nazad na listu klijenata
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/employee/clients/${client.id}/edit`)}
          leftIcon={<Pencil className="h-4 w-4" />}
        >
          Izmeni
        </Button>
      </div>

      {/* Details card */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-semibold text-gray-900">Lični podaci</h2>
        </div>
        <FieldRow label="Ime"           value={client.first_name} />
        <FieldRow label="Prezime"        value={client.last_name} />
        <FieldRow label="Email"          value={client.email} />
        <FieldRow label="Telefon"        value={client.phone_number} />
        <FieldRow label="Adresa"         value={client.address} />
        <FieldRow label="Datum rođenja"  value={formatDateOfBirth(client.date_of_birth)} />
        <FieldRow label="Pol"            value={formatGender(client.gender)} />
      </div>

      {/* TRADE_STOCKS — samo zaposleni (backend) */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-semibold text-gray-900">Trgovanje hartijama</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Dozvola <span className="font-mono text-xs">TRADE_STOCKS</span> omogućava klijentu pristup
          berzi i kupovinu/prodaju. Posle promene klijent se mora ponovo prijaviti da bi novi token
          sadržao permisije.
        </p>
        {tradePermissionLoading ? (
          <p className="text-sm text-gray-500">Učitavanje...</p>
        ) : tradePermission === null ? (
          <p className="text-sm text-amber-700">Status dozvole nije dostupan.</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-medium text-gray-800">
              {tradePermission ? 'Dozvoljeno' : 'Nije dozvoljeno'}
            </span>
            <Button
              type="button"
              variant={tradePermission ? 'secondary' : 'primary'}
              size="sm"
              loading={tradeSaving}
              onClick={() => void handleTradeToggle()}
            >
              {tradePermission ? 'Ukloni dozvolu' : 'Dodeli dozvolu'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
