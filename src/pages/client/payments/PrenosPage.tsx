import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react'
import { getClientAccounts } from '@/services/bankaService'
import { createTransferIntent, verifyAndExecutePayment } from '@/services/paymentService'
import type { AccountListItem, CreatePaymentIntentResult } from '@/types'

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

type Step = 'form' | 'verify' | 'done'

export default function PrenosPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')

  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [iznos, setIznos] = useState('')
  const [svrha, setSvrha] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  const [pendingIntent, setPendingIntent] = useState<CreatePaymentIntentResult | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)

  const [completedIntentId, setCompletedIntentId] = useState<string | null>(null)

  useEffect(() => {
    getClientAccounts()
      .then((accs) => {
        setAccounts(accs)
        if (accs.length >= 1) setFromId(accs[0].id)
        if (accs.length >= 2) setToId(accs[1].id)
      })
      .catch((err: Error) => setInitError(err.message))
      .finally(() => setLoadingInit(false))
  }, [])

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!fromId || !toId) { setFormError('Odaberite oba računa.'); return }
    if (fromId === toId) { setFormError('Račun platioca i primaoca ne smeju biti isti.'); return }

    const iznNum = parseFloat(iznos)
    if (!iznos || isNaN(iznNum) || iznNum <= 0) { setFormError('Unesite ispravan iznos.'); return }

    setFormLoading(true)
    try {
      const result = await createTransferIntent({
        idempotencyKey:  crypto.randomUUID(),
        racunPlatiocaId: Number(fromId),
        racunPrimaocaId: Number(toId),
        iznos:           iznNum,
        svrhaPlacanja:   svrha.trim(),
      })
      setPendingIntent(result)
      setVerifyCode('')
      setVerifyError(null)
      setStep('verify')
    } catch (err: unknown) {
      setFormError((err as Error).message)
    } finally {
      setFormLoading(false)
    }
  }

  async function handleVerify() {
    if (!pendingIntent) return
    if (verifyCode.length !== 6) { setVerifyError('Unesite 6-cifreni kod.'); return }

    setVerifyLoading(true)
    setVerifyError(null)
    try {
      const done = await verifyAndExecutePayment(pendingIntent.intent_id, verifyCode)
      setCompletedIntentId(done.id)
      setStep('done')
    } catch (err: unknown) {
      const e = err as Error
      if (e.message?.includes('otkazan') || e.message?.includes('previše')) {
        setVerifyError('Nalog je otkazan — previše neuspešnih pokušaja. Kreirajte novi nalog.')
        setPendingIntent(null)
        setStep('form')
      } else if (e.message?.includes('istekao')) {
        setVerifyError('Kod je istekao. Kreirajte novi nalog.')
        setPendingIntent(null)
        setStep('form')
      } else {
        setVerifyError(e.message)
      }
    } finally {
      setVerifyLoading(false)
    }
  }

  if (loadingInit) return <div className="card text-center py-10 text-gray-400">Učitavanje…</div>
  if (initError) return <div className="card bg-red-50 text-red-700 text-sm">{initError}</div>

  if (accounts.length < 2) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Prenos između računa</h1>
        <div className="card bg-yellow-50 text-yellow-800 text-sm">
          Za prenos između računa potrebno je da imate najmanje 2 aktivna računa.
        </div>
      </div>
    )
  }

  const fromAccount = accounts.find((a) => a.id === fromId)
  const toAccount = accounts.find((a) => a.id === toId)

  // ── Done ──────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="max-w-lg space-y-6">
        <div className="card text-center py-10 space-y-4">
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
          <h2 className="text-xl font-bold text-gray-900">Prenos realizovan!</h2>
          <p className="text-sm text-gray-500">
            Nalog <span className="font-mono font-medium">{pendingIntent?.broj_naloga}</span> je uspešno izvršen.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {completedIntentId && (
              <a
                href={`/api/bank/payments/${completedIntentId}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary flex items-center gap-1.5 text-sm justify-center"
              >
                <ExternalLink className="h-4 w-4" /> Preuzmi potvrdu
              </a>
            )}
            <button onClick={() => navigate('/client/payments/history')} className="btn btn-secondary text-sm">
              Pregled plaćanja
            </button>
            <button
              onClick={() => { setStep('form'); setPendingIntent(null); setVerifyCode(''); setIznos(''); setSvrha('') }}
              className="btn btn-primary text-sm"
            >
              Novi prenos
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Verify ────────────────────────────────────────────────────────────────

  if (step === 'verify') {
    return (
      <div className="max-w-lg space-y-6">
        <button
          onClick={() => { setStep('form'); setPendingIntent(null) }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Nazad
        </button>

        <h1 className="text-2xl font-bold text-gray-900">Verifikacija prenosa</h1>

        <div className="card space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Nalog je kreiran — otvorite mobilnu aplikaciju</p>
            <p>Pronađite zahtev u sekciji &ldquo;Pending Approvals&rdquo; i pritisnite &ldquo;Approve Transaction&rdquo;.</p>
            <p>Mobilna aplikacija će vam prikazati 6-cifreni verifikacioni kod.</p>
          </div>

          {pendingIntent && fromAccount && toAccount && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <div className="flex items-center justify-between">
                <span className="truncate">{fromAccount.naziv_racuna}</span>
                <ArrowRight className="h-3.5 w-3.5 mx-2 shrink-0 text-gray-400" />
                <span className="truncate text-right">{toAccount.naziv_racuna}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span>Iznos</span>
                <span className="font-semibold">{formatAmount(pendingIntent.iznos, pendingIntent.valuta)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verifikacioni kod (6 cifara)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input w-full text-center text-2xl font-mono tracking-widest"
              placeholder="• • • • • •"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Kod važi 5 minuta · Nakon 3 neuspešna pokušaja nalog se otkazuje</p>
          </div>

          {verifyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{verifyError}</div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => { setStep('form'); setPendingIntent(null); setVerifyCode('') }}
              className="btn btn-secondary"
              disabled={verifyLoading}
            >
              Otkaži
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifyLoading || verifyCode.length !== 6}
              className="btn btn-primary"
            >
              {verifyLoading ? 'Proveravanje…' : 'Potvrdi prenos'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl space-y-6">
      <button
        onClick={() => navigate('/client')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Nazad
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Prenos između računa</h1>

      <form onSubmit={handleFormSubmit} className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Račun platioca (sa)</label>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="input w-full">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.naziv_racuna} — {a.broj_racuna} ({formatAmount(a.raspolozivo_stanje, a.valuta_oznaka)})
              </option>
            ))}
          </select>
          {fromAccount && (
            <p className="text-xs text-gray-400 mt-1">
              Raspoloživo: <span className="font-medium text-gray-600">{formatAmount(fromAccount.raspolozivo_stanje, fromAccount.valuta_oznaka)}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Račun primaoca (na)</label>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="input w-full">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.naziv_racuna} — {a.broj_racuna} ({formatAmount(a.raspolozivo_stanje, a.valuta_oznaka)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Iznos {fromAccount ? `(${fromAccount.valuta_oznaka})` : ''}
          </label>
          <input
            className="input w-full"
            type="number"
            step="0.01"
            min="0.01"
            value={iznos}
            onChange={(e) => setIznos(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Svrha plaćanja (opciono)</label>
          <input
            className="input w-full"
            value={svrha}
            onChange={(e) => setSvrha(e.target.value)}
            placeholder="npr. Mesačne uštedine"
          />
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">Otkaži</button>
          <button type="submit" disabled={formLoading} className="btn btn-primary">
            {formLoading ? 'Kreiranje naloga…' : 'Nastavi'}
          </button>
        </div>
      </form>
    </div>
  )
}
