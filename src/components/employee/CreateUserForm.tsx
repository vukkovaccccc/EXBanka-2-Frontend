import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import ErrorMessage from '@/components/common/ErrorMessage'
import { createClient } from '@/services/clientService'
import { GrpcStatus, type ClientPreview } from '@/types'

const schema = z.object({
  first_name:    z.string().min(1, 'Ime je obavezno'),
  last_name:     z.string().min(1, 'Prezime je obavezno'),
  email:         z.string().email('Unesite ispravan email'),
  address:       z.string().min(1, 'Adresa je obavezna'),
  date_of_birth: z
    .string()
    .refine((d) => d === '' || new Date(d) <= new Date(), 'Datum ne može biti u budućnosti'),
  gender: z.string(),
  phone: z
    .string()
    .refine(
      (v) => v === '' || /^\+?[0-9]{9,15}$/.test(v),
      'Telefon mora imati 9–15 cifara (opciono + na početku)'
    ),
})

type FormValues = z.infer<typeof schema>

interface CreateUserFormProps {
  onSuccess: (client: ClientPreview) => void
  onCancel: () => void
}

export default function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const [error, setError]           = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', email: '',
      address: '', date_of_birth: '', gender: '', phone: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    setEmailError(null)
    try {
      const result = await createClient(values)
      toast.success('Klijent uspješno kreiran. Email za aktivaciju je poslan.')
      onSuccess({
        id:         result.id,
        first_name: values.first_name,
        last_name:  values.last_name,
        email:      result.email,
      })
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
    <form onSubmit={(e) => { e.stopPropagation(); return handleSubmit(onSubmit)(e) }} noValidate className="space-y-4">
      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Ime"     error={errors.first_name?.message} {...register('first_name')} />
        <Input label="Prezime" error={errors.last_name?.message}  {...register('last_name')} />
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
        </div>
        <Input
          label="Telefon"
          placeholder="+381641234567"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Odustani
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
          Kreiraj klijenta
        </Button>
      </div>
    </form>
  )
}
