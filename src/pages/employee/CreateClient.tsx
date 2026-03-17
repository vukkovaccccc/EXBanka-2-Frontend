import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import ErrorMessage from '@/components/common/ErrorMessage'
import { createClient } from '@/services/clientService'
import { GrpcStatus } from '@/types'

const schema = z.object({
  first_name:    z.string().min(1, 'Ime je obavezno'),
  last_name:     z.string().min(1, 'Prezime je obavezno'),
  email:         z.string().email('Unesite ispravan email'),
  address:       z.string().min(1, 'Adresa je obavezna'),
  date_of_birth: z
    .string()
    .refine(
      (d) => d === '' || new Date(d) <= new Date(),
      'Datum rođenja ne može biti u budućnosti'
    ),
  gender: z.string(),
  phone:  z
    .string()
    .refine(
      (v) => v === '' || /^\+?[0-9]{9,15}$/.test(v),
      'Telefon mora imati 9–15 cifara (opciono + na početku)'
    ),
})

type FormValues = z.infer<typeof schema>

const DEFAULT_VALUES: FormValues = {
  first_name:    '',
  last_name:     '',
  email:         '',
  address:       '',
  date_of_birth: '',
  gender:        '',
  phone:         '',
}

export default function CreateClient() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    setEmailError(null)

    try {
      await createClient(values)
      toast.success('Klijent uspješno kreiran. Email za aktivaciju je poslan.')
      reset(DEFAULT_VALUES)
    } catch (err) {
      const e = err as Error & { grpcCode?: number }

      if (e.grpcCode === GrpcStatus.ALREADY_EXISTS) {
        setEmailError('Nalog sa ovom email adresom već postoji.')
        return
      }

      setError(e.message ?? 'Greška pri kreiranju. Pokušajte ponovo.')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/employee')}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Kreiraj klijenta</h1>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b">Lični podaci</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Ime" error={errors.first_name?.message} {...register('first_name')} />
            <Input label="Prezime" error={errors.last_name?.message} {...register('last_name')} />
            <Input
              label="Email"
              type="email"
              error={emailError ?? errors.email?.message}
              {...register('email')}
            />
            <Input label="Adresa" error={errors.address?.message} {...register('address')} />
            <Input
              label="Datum rođenja"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              error={errors.date_of_birth?.message}
              {...register('date_of_birth')}
            />
            <div>
              <label className="form-label">Pol</label>
              <select className="input-base" {...register('gender')}>
                <option value="">-- Odaberite --</option>
                <option value="MALE">Muški</option>
                <option value="FEMALE">Ženski</option>
              </select>
              {errors.gender && (
                <p role="alert" className="mt-1 text-xs text-red-600">{errors.gender.message}</p>
              )}
            </div>
            <Input
              label="Telefon"
              placeholder="+381641234567"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate('/employee')}>
            Odustani
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
            Kreiraj klijenta
          </Button>
        </div>
      </form>
    </div>
  )
}
