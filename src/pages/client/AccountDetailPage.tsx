import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Pencil, CreditCard, Building2, AlertCircle } from 'lucide-react'
import { getAccountDetail, renameAccount, requestLimitChange, verifyLimitChange } from '@/services/bankaService'
import { getMyProfile } from '@/services/authService'
import Dialog from '@/components/common/Dialog'
import type { AccountDetail, MyProfile } from '@/types'

// ─── Validation ───────────────────────────────────────────────────────────────

const renameSchema = z.object({
  naziv: z.string().min(1, 'Naziv ne sme biti prazan').max(255),
})
type RenameForm = z.infer<typeof renameSchema>

const limitSchema = z.object({
  dnevni_limit:  z.string().optional(),
  mesecni_limit: z.string().optional(),
}).refine(
  (data) => (data.dnevni_limit?.trim() !== '') || (data.mesecni_limit?.trim() !== ''),
  { message: 'Unesite bar jedan limit koji želite da promenite.' }
)
type LimitForm = z.infer<typeof limitSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, oznaka: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${oznaka}`
}

interface FieldRowProps { label: string; value: React.ReactNode }
function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)

  // ── Limit: 3-step flow ────────────────────────────────────────────────────
  // Step 1: enter new limits
  const [limitOpen, setLimitOpen] = useState(false)
  // Step 2: waiting for mobile approval + code entry
  const [limitWaitOpen, setLimitWaitOpen] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [pendingLimitValues, setPendingLimitValues] = useState<{ d: number; m: number } | null>(null)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [limitLoading, setLimitLoading] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([getAccountDetail(id), getMyProfile()])
      .then(([acc, prof]) => { setAccount(acc); setProfile(prof) })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // ── Rename ────────────────────────────────────────────────────────────────

  const renameForm = useForm<RenameForm>({
    resolver: zodResolver(renameSchema),
    defaultValues: { naziv: '' },
  })

  useEffect(() => {
    if (account) renameForm.reset({ naziv: account.naziv_racuna })
  }, [account, renameForm])

  async function handleRename(data: RenameForm) {
    if (!account) return
    if (data.naziv === account.naziv_racuna) {
      setRenameError('Novi naziv mora biti različit od trenutnog.')
      return
    }
    setRenameLoading(true)
    setRenameError(null)
    try {
      await renameAccount(account.id, data.naziv)
      setAccount((prev) => prev ? { ...prev, naziv_racuna: data.naziv } : prev)
      setRenameOpen(false)
    } catch (err: unknown) {
      const e = err as Error & { grpcCode?: number }
      if (e.grpcCode === 6) {
        setRenameError('Već imate račun sa tim nazivom.')
      } else {
        setRenameError(e.message)
      }
    } finally {
      setRenameLoading(false)
    }
  }

  // ── Limit ─────────────────────────────────────────────────────────────────

  const limitForm = useForm<LimitForm>({
    resolver: zodResolver(limitSchema),
    defaultValues: { dnevni_limit: '', mesecni_limit: '' },
  })

  // Forma se NE pre-puni trenutnim vrednostima — korisnik unosi samo ono što menja.
  // Prazno polje = ne menjaj taj limit. Sentinel -1 se šalje backendu za "ne menjaj".

  // Step 1 → Step 2: send limit change request to backend (creates pending action)
  async function handleLimitSubmit(data: LimitForm) {
    if (!account) return
    setLimitLoading(true)
    setLimitError(null)
    // -1 = sentinel "ne menjaj ovaj limit"
    const d = data.dnevni_limit?.trim() ? parseFloat(data.dnevni_limit) : -1
    const m = data.mesecni_limit?.trim() ? parseFloat(data.mesecni_limit) : -1
    try {
      const res = await requestLimitChange(account.id, d, m)
      setPendingActionId(res.actionId)
      setPendingLimitValues({ d, m })
      setLimitOpen(false)
      setVerifyCode('')
      setVerifyError(null)
      setLimitWaitOpen(true)
    } catch (err: unknown) {
      const e = err as Error & { grpcCode?: number }
      if (e.grpcCode === 6) {
        // AlreadyExists — već postoji aktivan zahtev za ovaj račun
        setLimitError('Već postoji aktivan zahtev za promenu limita za ovaj račun. Odobrite ga na mobilnoj aplikaciji ili sačekajte da istekne.')
      } else {
        setLimitError(e.message)
      }
    } finally {
      setLimitLoading(false)
    }
  }

  // Step 2: verify code entered by user
  async function handleVerifyCode() {
    if (!pendingActionId || !account || !pendingLimitValues) return
    if (verifyCode.length !== 6) {
      setVerifyError('Unesite 6-cifreni kod.')
      return
    }
    setVerifyLoading(true)
    setVerifyError(null)
    try {
      await verifyLimitChange(pendingActionId, verifyCode)
      // Ažuriraj lokalno stanje — -1 znači "nije menjano", zadržavamo staru vrednost
      setAccount((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          dnevni_limit:  pendingLimitValues.d >= 0 ? pendingLimitValues.d  : prev.dnevni_limit,
          mesecni_limit: pendingLimitValues.m >= 0 ? pendingLimitValues.m : prev.mesecni_limit,
        }
      })
      setLimitWaitOpen(false)
      setPendingActionId(null)
      setPendingLimitValues(null)
    } catch (err: unknown) {
      const e = err as Error & { grpcCode?: number; message: string }
      // gRPC codes: 3=InvalidArgument(wrong code), 4=DeadlineExceeded(expired), 7=PermissionDenied(cancelled)
      if (e.message?.includes('otkazan') || e.message?.includes('previše')) {
        setVerifyError('Zahtev je otkazan — previše neuspešnih pokušaja. Pokrenite novi zahtev.')
        setLimitWaitOpen(false)
        setPendingActionId(null)
      } else if (e.message?.includes('istekao')) {
        setVerifyError('Kod je istekao. Pokrenite novi zahtev.')
        setLimitWaitOpen(false)
        setPendingActionId(null)
      } else {
        setVerifyError(e.message ?? 'Pogrešan kod. Pokušajte ponovo.')
      }
    } finally {
      setVerifyLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-400">Učitavanje…</p>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/client/accounts')} className="btn btn-secondary flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Nazad
        </button>
        <div className="card flex items-center gap-3 text-red-600 bg-red-50">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error ?? 'Račun nije pronađen.'}</span>
        </div>
      </div>
    )
  }

  const isBusiness = account.vrsta_racuna === 'POSLOVNI'
  const ownerName = profile ? `${profile.first_name} ${profile.last_name}` : '—'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => navigate('/client/accounts')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Nazad na račune
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{account.naziv_racuna}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{account.broj_racuna}</p>
      </div>

      {/* Account details */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-semibold text-gray-900">Podaci o računu</h2>
        </div>
        <FieldRow label="Naziv računa" value={account.naziv_racuna} />
        <FieldRow label="Broj računa" value={account.broj_racuna} />
        <FieldRow label="Vlasnik" value={ownerName} />
        <FieldRow
          label="Tip"
          value={`${account.kategorija_racuna === 'TEKUCI' ? 'Tekući' : 'Devizni'} · ${isBusiness ? 'Poslovni' : 'Lični'} · ${account.valuta_oznaka}`}
        />
        <FieldRow
          label="Raspoloživo stanje"
          value={<span className="text-primary-700 font-bold">{formatAmount(account.raspolozivo_stanje, account.valuta_oznaka)}</span>}
        />
        <FieldRow label="Rezervisana sredstva" value={formatAmount(account.rezervisana_sredstva, account.valuta_oznaka)} />
        <FieldRow label="Stanje računa" value={formatAmount(account.stanje_racuna, account.valuta_oznaka)} />
        <FieldRow
          label="Dnevni limit"
          value={account.dnevni_limit > 0 ? formatAmount(account.dnevni_limit, account.valuta_oznaka) : '—'}
        />
        <FieldRow
          label="Mesečni limit"
          value={account.mesecni_limit > 0 ? formatAmount(account.mesecni_limit, account.valuta_oznaka) : '—'}
        />
      </div>

      {/* Company details (business only) */}
      {isBusiness && account.naziv_firme && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Podaci o firmi</h2>
          </div>
          <FieldRow label="Naziv firme" value={account.naziv_firme} />
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Akcije</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => { setRenameError(null); setRenameOpen(true) }}
            className="btn btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Pencil className="h-4 w-4" /> Promena naziva računa
          </button>
          <button
            onClick={() => navigate('/client/payment/new')}
            className="btn btn-primary text-sm"
          >
            Novo plaćanje
          </button>
          <button
            onClick={() => { setLimitError(null); limitForm.reset({ dnevni_limit: '', mesecni_limit: '' }); setLimitOpen(true) }}
            className="btn btn-secondary text-sm"
          >
            Promena limita
          </button>
        </div>
      </div>

      {/* ── Rename dialog ───────────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} title="Promena naziva računa" maxWidth="sm">
        <form onSubmit={renameForm.handleSubmit(handleRename)} className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Trenutno ime: <span className="font-medium text-gray-900">{account.naziv_racuna}</span>
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Novo ime računa</label>
            <input
              {...renameForm.register('naziv')}
              className="input w-full"
              placeholder="Unesite novi naziv"
            />
            {renameForm.formState.errors.naziv && (
              <p className="mt-1 text-xs text-red-600">{renameForm.formState.errors.naziv.message}</p>
            )}
          </div>
          {renameError && <p className="text-sm text-red-600">{renameError}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setRenameOpen(false)} className="btn btn-secondary">Otkaži</button>
            <button type="submit" disabled={renameLoading} className="btn btn-primary">
              {renameLoading ? 'Čuvanje…' : 'Sačuvaj'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* ── Limit step 1: enter new limits ──────────────────────────────────── */}
      <Dialog open={limitOpen} onClose={() => { setLimitOpen(false); limitForm.reset() }} title="Promena limita računa" maxWidth="sm">
        <form onSubmit={limitForm.handleSubmit(handleLimitSubmit)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Unesite <strong>samo limite koje želite da promenite</strong>. Prazno polje = zadržava trenutnu vrednost.
            Nakon potvrde, zahtev ćete odobriti putem mobilne aplikacije.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Novi dnevni limit ({account.valuta_oznaka})
              {account.dnevni_limit > 0 && (
                <span className="ml-2 text-xs text-gray-400 font-normal">trenutno: {account.dnevni_limit.toLocaleString('sr-RS', { minimumFractionDigits: 2 })}</span>
              )}
            </label>
            <input
              {...limitForm.register('dnevni_limit')}
              type="number"
              step="0.01"
              min="0"
              className="input w-full"
              placeholder="Ostavi prazno da ne menjаš"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Novi mesečni limit ({account.valuta_oznaka})
              {account.mesecni_limit > 0 && (
                <span className="ml-2 text-xs text-gray-400 font-normal">trenutno: {account.mesecni_limit.toLocaleString('sr-RS', { minimumFractionDigits: 2 })}</span>
              )}
            </label>
            <input
              {...limitForm.register('mesecni_limit')}
              type="number"
              step="0.01"
              min="0"
              className="input w-full"
              placeholder="Ostavi prazno da ne menjаš"
            />
          </div>
          {limitForm.formState.errors.root?.message && (
            <p className="text-sm text-red-600">{limitForm.formState.errors.root.message}</p>
          )}
          {limitError && <p className="text-sm text-red-600">{limitError}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setLimitOpen(false)} className="btn btn-secondary">Otkaži</button>
            <button type="submit" disabled={limitLoading} className="btn btn-primary">
              {limitLoading ? 'Slanje zahteva…' : 'Nastavi'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* ── Limit step 2: waiting for mobile approval + code entry ────────── */}
      <Dialog
        open={limitWaitOpen}
        onClose={() => { setLimitWaitOpen(false); setPendingActionId(null); setVerifyError(null) }}
        title="Verifikacija promene limita"
        maxWidth="sm"
      >
        <div className="space-y-5">
          {/* Instruction */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Otvorite mobilnu aplikaciju</p>
            <p>Pronađite zahtev za promenu limita u sekciji &ldquo;Pending Approvals&rdquo; i pritisnite &ldquo;Approve Transaction&rdquo;.</p>
            <p className="mt-1">Dobićete 6-cifreni verifikacioni kod koji unesite ispod.</p>
          </div>

          {/* Code input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verifikacioni kod (6 cifara)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input w-full text-center text-2xl font-mono tracking-widest"
              placeholder="• • • • • •"
            />
            <p className="text-xs text-gray-400 mt-1">Kod važi 5 minuta · Nakon 3 neuspešna pokušaja zahtev se otkazuje</p>
          </div>

          {verifyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {verifyError}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => { setLimitWaitOpen(false); setPendingActionId(null); setVerifyError(null) }}
              className="btn btn-secondary"
              disabled={verifyLoading}
            >
              Otkaži
            </button>
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={verifyLoading || verifyCode.length !== 6}
              className="btn btn-primary"
            >
              {verifyLoading ? 'Proveravanje…' : 'Potvrdi'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
