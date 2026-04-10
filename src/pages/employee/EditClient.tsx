import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import ErrorMessage from '@/components/common/ErrorMessage'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getClientById, updateClient, getClientTradePermission, setClientTradePermission } from '@/services/clientService'
import { useBlockNavigation } from '@/hooks/useBlockNavigation'
import { GrpcStatus } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name:   z.string().min(1, 'Ime je obavezno'),
  last_name:    z.string().min(1, 'Prezime je obavezno'),
  email:        z.string().email('Unesite ispravan email'),
  phone_number: z
    .string()
    .refine(
      (v) => v === '' || /^\+?[0-9]{9,15}$/.test(v),
      'Telefon mora imati 9–15 cifara (opciono + na početku)'
    ),
  address: z.string().min(1, 'Adresa je obavezna'),
})

type FormValues = z.infer<typeof schema>

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditClient() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasTradePermission, setHasTradePermission] = useState(false)
  const [permLoading, setPermLoading] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useBlockNavigation(
    isDirty && !isSubmitting,
    'Imate nesačuvane izmene. Da li ste sigurni da želite da napustite stranicu?'
  )

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const [client, hasPerm] = await Promise.all([
          getClientById(id),
          getClientTradePermission(id).catch(() => false),
        ])
        reset({
          first_name:   client.first_name,
          last_name:    client.last_name,
          email:        client.email,
          phone_number: client.phone_number,
          address:      client.address,
        })
        setHasTradePermission(hasPerm)
      } catch (err) {
        const e = err as Error & { grpcCode?: number }
        if (e.grpcCode === GrpcStatus.NOT_FOUND) {
          setLoadError('Klijent nije pronađen.')
        } else {
          setLoadError(e.message ?? 'Greška pri učitavanju podataka o klijentu.')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, reset])

  const handleToggleTradePermission = async () => {
    if (!id) return
    setPermLoading(true)
    setPermError(null)
    try {
      await setClientTradePermission(id, !hasTradePermission)
      setHasTradePermission((prev) => !prev)
    } catch {
      setPermError('Greška pri promeni dozvole za trgovanje.')
    } finally {
      setPermLoading(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (!id) return
    setSaveError(null)
    setEmailError(null)

    try {
      await updateClient(id, values)
      toast.success('Podaci klijenta su uspješno ažurirani.')
      navigate(`/employee/clients/${id}`, { replace: true })
    } catch (err) {
      const e = err as Error & { grpcCode?: number }

      if (e.grpcCode === GrpcStatus.ALREADY_EXISTS) {
        setEmailError('Nalog sa ovom email adresom već postoji.')
        return
      }

      setSaveError(e.message ?? 'Greška pri čuvanju. Pokušajte ponovo.')
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ── Load error ────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="max-w-lg mt-8 space-y-4">
        <ErrorMessage message={loadError} />
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

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(`/employee/clients/${id}`)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Izmena podataka klijenta</h1>
      </div>

      {saveError && (
        <div className="mb-4">
          <ErrorMessage message={saveError} />
        </div>
      )}

      {/* ── Dozvola za trgovanje ─────────────────────────────────────── */}
      <div className="card mb-4">
        <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b mb-4">Dozvole</h2>
        {permError && <div className="mb-3"><ErrorMessage message={permError} /></div>}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Dozvola za trgovanje hartijama</p>
            <p className="text-sm text-gray-500">
              Klijent {hasTradePermission ? 'ima' : 'nema'} dozvolu da trguje akcijama i fjučersima na berzi.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleTradePermission}
            disabled={permLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${
              hasTradePermission ? 'bg-primary-600' : 'bg-gray-300'
            }`}
            aria-label="Toggle trade permission"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                hasTradePermission ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b">Lični podaci</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Ime"
              error={errors.first_name?.message}
              {...register('first_name')}
            />
            <Input
              label="Prezime"
              error={errors.last_name?.message}
              {...register('last_name')}
            />
            <Input
              label="Email"
              type="email"
              error={emailError ?? errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Telefon"
              placeholder="+381641234567"
              error={errors.phone_number?.message}
              {...register('phone_number')}
            />
            <Input
              label="Adresa"
              error={errors.address?.message}
              {...register('address')}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/employee/clients/${id}`)}
          >
            Odustani
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Sačuvaj izmene
          </Button>
        </div>
      </form>
    </div>
  )
}
