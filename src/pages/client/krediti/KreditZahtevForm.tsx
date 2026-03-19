import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { applyForCredit } from '@/services/kreditService'
import { getClientAccounts, getCurrencies } from '@/services/bankaService'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import type { AccountListItem, Currency } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const VRSTA_OPTIONS = [
  { value: 'GOTOVINSKI',      label: 'Gotovinski' },
  { value: 'STAMBENI',        label: 'Stambeni' },
  { value: 'AUTO',            label: 'Auto' },
  { value: 'REFINANSIRAJUCI', label: 'Refinansirajući' },
  { value: 'STUDENTSKI',      label: 'Studentski' },
]

const TIP_KAMATE_OPTIONS = [
  { value: 'FIKSNA',      label: 'Fiksna' },
  { value: 'VARIJABILNA', label: 'Varijabilna' },
]

const STATUS_ZAPOSLENJA_OPTIONS = [
  { value: 'STALNO',     label: 'Stalno' },
  { value: 'PRIVREMENO', label: 'Privremeno' },
  { value: 'NEZAPOSLEN', label: 'Nezaposlen/a' },
]

const PERIOD_OPTIONS: Record<string, number[]> = {
  STAMBENI: [60, 120, 180, 240, 300, 360],
  DEFAULT:  [12, 24, 36, 48, 60, 72, 84],
}

function getPeriodOptions(vrstaKredita: string): number[] {
  return PERIOD_OPTIONS[vrstaKredita] ?? PERIOD_OPTIONS.DEFAULT
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  vrsta_kredita:     z.string().min(1, 'Odaberite vrstu kredita'),
  tip_kamate:        z.string().min(1, 'Odaberite tip kamatne stope'),
  iznos:             z.coerce.number({ invalid_type_error: 'Unesite iznos' }).positive('Iznos mora biti pozitivan'),
  valuta:            z.string().min(1, 'Odaberite valutu'),
  svrha:             z.string().min(2, 'Unesite svrhu kredita (min. 2 karaktera)'),
  mesecna_plata:     z.coerce.number({ invalid_type_error: 'Unesite platu' }).positive('Plata mora biti pozitivna'),
  status_zaposlenja: z.string().min(1, 'Odaberite status zaposlenja'),
  period_zaposlenja: z.coerce.number({ invalid_type_error: 'Unesite period' }).int().positive('Unesite period zaposlenja'),
  kontakt_telefon:   z.string().min(6, 'Unesite validan broj telefona'),
  broj_racuna:       z.string().min(1, 'Odaberite račun za isplatu'),
  rok_otplate:       z.coerce.number({ invalid_type_error: 'Odaberite rok' }).positive('Odaberite rok otplate'),
})

type FormData = z.infer<typeof schema>

// ─── SelectField helper ───────────────────────────────────────────────────────

interface SelectFieldProps {
  label: string
  error?: string
  children: React.ReactNode
  id: string
  selectProps: React.SelectHTMLAttributes<HTMLSelectElement>
}

function SelectField({ label, error, children, id, selectProps }: SelectFieldProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="form-label">{label}</label>
      <select
        id={id}
        className={[
          'input-base appearance-none bg-white',
          error ? 'input-error' : '',
        ].join(' ')}
        {...selectProps}
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-5">
      <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">{title}</h2>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KreditZahtevForm() {
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vrsta_kredita:     '',
      tip_kamate:        '',
      iznos:             undefined,
      valuta:            '',
      svrha:             '',
      mesecna_plata:     undefined,
      status_zaposlenja: '',
      period_zaposlenja: undefined,
      kontakt_telefon:   '',
      broj_racuna:       '',
      rok_otplate:       undefined,
    },
  })

  // ── Load accounts & currencies ──────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getClientAccounts(), getCurrencies()])
      .then(([accs, curs]) => {
        setAccounts(accs)
        setCurrencies(curs)
      })
      .catch(() => {
        // Non-fatal: forms still usable with empty dropdowns
      })
      .finally(() => setLoadingData(false))
  }, [])

  // ── Watch for dynamic logic ─────────────────────────────────────────────────
  const vrstaKredita     = watch('vrsta_kredita')
  const selectedValuta   = watch('valuta')
  const selectedRacun    = watch('broj_racuna')
  const currentRokOtplate = watch('rok_otplate')

  const periodOptions = getPeriodOptions(vrstaKredita)

  // Reset rok_otplate when vrsta changes and current value is no longer valid
  useEffect(() => {
    if (!currentRokOtplate) return
    if (!periodOptions.includes(Number(currentRokOtplate))) {
      setValue('rok_otplate', undefined as unknown as number)
    }
  }, [vrstaKredita, currentRokOtplate, periodOptions, setValue])

  // Currency mismatch check
  const selectedAccount = accounts.find((a) => a.broj_racuna === selectedRacun)
  const currencyMismatch =
    !!selectedAccount && !!selectedValuta && selectedAccount.valuta_oznaka !== selectedValuta

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    if (currencyMismatch) return
    setSubmitError(null)
    try {
      await applyForCredit({
        vrsta_kredita:     data.vrsta_kredita,
        tip_kamatne_stope: data.tip_kamate,
        iznos:             data.iznos,
        valuta:            data.valuta,
        svrha:             data.svrha,
        mesecna_plata:     data.mesecna_plata,
        status_zaposlenja: data.status_zaposlenja,
        period_zaposlenja: data.period_zaposlenja,
        kontakt_telefon:   data.kontakt_telefon,
        broj_racuna:       data.broj_racuna,
        rok_otplate:       data.rok_otplate,
      })
      setSuccess(true)
    } catch (err: unknown) {
      const e = err as Error
      setSubmitError(e.message ?? 'Greška pri slanju zahteva. Pokušajte ponovo.')
    }
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card flex flex-col items-center text-center py-12 gap-5">
          <div className="rounded-full bg-green-100 p-5">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Zahtev je uspešno podnet!</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-sm">
              Vaš zahtev za kredit je primljen. Banka će ga obraditi i obavestiti vas
              o odluci u najkraćem mogućem roku.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="secondary" onClick={() => navigate('/client/krediti')}>
              Moji krediti
            </Button>
            <Button variant="primary" onClick={() => { setSuccess(false) }}>
              Novi zahtev
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/client/krediti')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Nazad na kredite
      </button>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Zahtev za kredit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Popunite sva polja. Zahtev se obrađuje u roku od 1–3 radna dana.
        </p>
      </div>

      {loadingData && (
        <p className="text-sm text-gray-400">Učitavanje podataka…</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

        {/* ── Section 1: Kredit ─────────────────────────────────────────── */}
        <Section title="Vrsta i iznos kredita">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Vrsta kredita */}
            <Controller
              control={control}
              name="vrsta_kredita"
              render={({ field }) => (
                <SelectField
                  label="Vrsta kredita"
                  error={errors.vrsta_kredita?.message}
                  id="vrsta_kredita"
                  selectProps={field}
                >
                  <option value="">— Odaberite —</option>
                  {VRSTA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SelectField>
              )}
            />

            {/* Tip kamatne stope */}
            <Controller
              control={control}
              name="tip_kamate"
              render={({ field }) => (
                <SelectField
                  label="Tip kamatne stope"
                  error={errors.tip_kamate?.message}
                  id="tip_kamate"
                  selectProps={field}
                >
                  <option value="">— Odaberite —</option>
                  {TIP_KAMATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SelectField>
              )}
            />

            {/* Iznos kredita */}
            <Input
              {...register('iznos')}
              type="number"
              min={1}
              step="0.01"
              label="Iznos kredita"
              placeholder="npr. 500000"
              error={errors.iznos?.message}
            />

            {/* Valuta */}
            <Controller
              control={control}
              name="valuta"
              render={({ field }) => (
                <SelectField
                  label="Valuta kredita"
                  error={errors.valuta?.message}
                  id="valuta"
                  selectProps={field}
                >
                  <option value="">— Odaberite —</option>
                  {currencies.length > 0
                    ? currencies.map((c) => (
                        <option key={c.id} value={c.oznaka}>{c.oznaka} — {c.naziv}</option>
                      ))
                    : (
                        <>
                          <option value="RSD">RSD — Srpski dinar</option>
                          <option value="EUR">EUR — Euro</option>
                          <option value="USD">USD — Američki dolar</option>
                          <option value="CHF">CHF — Švajcarski franak</option>
                        </>
                      )
                  }
                </SelectField>
              )}
            />

            {/* Rok otplate — dynamic */}
            <Controller
              control={control}
              name="rok_otplate"
              render={({ field }) => (
                <SelectField
                  label="Rok otplate (meseci)"
                  error={errors.rok_otplate?.message}
                  id="rok_otplate"
                  selectProps={{
                    ...field,
                    value: field.value ?? '',
                    onChange: (e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value)),
                    disabled: !vrstaKredita,
                  }}
                >
                  <option value="">{vrstaKredita ? '— Odaberite —' : '— Prvo izaberite vrstu kredita —'}</option>
                  {periodOptions.map((p) => (
                    <option key={p} value={p}>{p} meseci</option>
                  ))}
                </SelectField>
              )}
            />

            {/* Svrha kredita — full width */}
            <div className="sm:col-span-2">
              <Input
                {...register('svrha')}
                label="Svrha kredita"
                placeholder="npr. Kupovina stana, kupovina automobila…"
                error={errors.svrha?.message}
              />
            </div>
          </div>
        </Section>

        {/* ── Section 2: Zaposlenje ────────────────────────────────────── */}
        <Section title="Zaposlenje i prihodi">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              {...register('mesecna_plata')}
              type="number"
              min={1}
              step="0.01"
              label="Iznos mesečne plate (RSD)"
              placeholder="npr. 80000"
              error={errors.mesecna_plata?.message}
            />

            <Controller
              control={control}
              name="status_zaposlenja"
              render={({ field }) => (
                <SelectField
                  label="Status zaposlenja"
                  error={errors.status_zaposlenja?.message}
                  id="status_zaposlenja"
                  selectProps={field}
                >
                  <option value="">— Odaberite —</option>
                  {STATUS_ZAPOSLENJA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SelectField>
              )}
            />

            <Input
              {...register('period_zaposlenja')}
              type="number"
              min={1}
              label="Period zaposlenja (meseci)"
              placeholder="npr. 24"
              error={errors.period_zaposlenja?.message}
            />
          </div>
        </Section>

        {/* ── Section 3: Kontakt i račun ──────────────────────────────── */}
        <Section title="Kontakt i račun za isplatu">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              {...register('kontakt_telefon')}
              type="tel"
              label="Kontakt telefon"
              placeholder="npr. +381601234567"
              error={errors.kontakt_telefon?.message}
            />

            {/* Account dropdown */}
            <Controller
              control={control}
              name="broj_racuna"
              render={({ field }) => (
                <SelectField
                  label="Račun za isplatu i skidanje rate"
                  error={errors.broj_racuna?.message}
                  id="broj_racuna"
                  selectProps={field}
                >
                  <option value="">— Odaberite račun —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.broj_racuna}>
                      {a.naziv_racuna} · {a.broj_racuna} ({a.valuta_oznaka})
                    </option>
                  ))}
                </SelectField>
              )}
            />
          </div>

          {/* Currency mismatch inline error */}
          {currencyMismatch && (
            <div
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
              data-cy="currency-mismatch-error"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Valute se ne poklapaju — kredit je u <strong>{selectedValuta}</strong>, a odabrani
                račun je u <strong>{selectedAccount?.valuta_oznaka}</strong>.
                Odaberite račun u istoj valuti ili promenite valutu kredita.
              </span>
            </div>
          )}
        </Section>

        {/* ── Submit error ─────────────────────────────────────────────── */}
        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {submitError}
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/client/krediti')}
          >
            Otkaži
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={currencyMismatch}
            data-cy="submit-zahtev"
          >
            Podnesi zahtev
          </Button>
        </div>
      </form>
    </div>
  )
}
