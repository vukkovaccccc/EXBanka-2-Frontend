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
import { getClientById, updateClient } from '@/services/clientService'
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
        const client = await getClientById(id)
        reset({
          first_name:   client.first_name,
          last_name:    client.last_name,
          email:        client.email,
          phone_number: client.phone_number,
          address:      client.address,
        })
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
