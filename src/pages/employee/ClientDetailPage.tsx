import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, User } from 'lucide-react'
import { getClientById } from '@/services/clientService'
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

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const data = await getClientById(id)
        setClient(data)
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
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
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
    </div>
  )
}
