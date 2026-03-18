import { apiGet, apiPost, apiPatch, apiDelete } from './grpcClient'
import type {
  PaymentRecipient,
  PaymentIntent,
  CreatePaymentIntentResult,
  PaymentHistoryFilter,
} from '@/types'

// ─── Backend shapes (gRPC-Gateway camelCase) ──────────────────────────────────

interface BackendRecipient {
  id: string | number
  naziv: string
  brojRacuna: string
}

interface BackendCreatePaymentIntentResponse {
  intentId: string | number
  actionId: string | number
  brojNaloga: string
  status: string
  valuta: string
  iznos: string | number
}

interface BackendPaymentIntentItem {
  id: string | number
  intentId?: string | number
  idempotencyKey?: string
  brojNaloga: string
  tipTransakcije: string
  brojRacunaPlatioca: string
  brojRacunaPrimaoca: string
  nazivPrimaoca: string
  iznos: string | number
  krajnjiIznos?: string | number
  provizija: string | number
  valuta: string
  sifraPlacanja?: string
  pozivNaBroj?: string
  svrhaPlacanja?: string
  status: string
  createdAt: string
  executedAt?: string
  failedReason?: string
}

function parseNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0
}

function mapIntent(r: BackendPaymentIntentItem): PaymentIntent {
  return {
    id:                   String(r.id),
    idempotency_key:      r.idempotencyKey ?? '',
    broj_naloga:          r.brojNaloga,
    tip_transakcije:      r.tipTransakcije,
    broj_racuna_platioca: r.brojRacunaPlatioca,
    broj_racuna_primaoca: r.brojRacunaPrimaoca,
    naziv_primaoca:       r.nazivPrimaoca,
    iznos:                parseNum(r.iznos),
    krajnji_iznos:        parseNum(r.krajnjiIznos),
    provizija:            parseNum(r.provizija),
    valuta:               r.valuta,
    sifra_placanja:       r.sifraPlacanja ?? '',
    poziv_na_broj:        r.pozivNaBroj ?? '',
    svrha_placanja:       r.svrhaPlacanja ?? '',
    status:               r.status,
    created_at:           r.createdAt ?? '',
    executed_at:          r.executedAt ?? '',
    failed_reason:        r.failedReason ?? '',
  }
}

// ─── Payment Recipients ───────────────────────────────────────────────────────

export async function getPaymentRecipients(): Promise<PaymentRecipient[]> {
  const res = await apiGet<{ recipients: BackendRecipient[] | null }>('/bank/client/payment-recipients')
  return (res.recipients ?? []).map((r) => ({
    id:          String(r.id),
    naziv:       r.naziv,
    broj_racuna: r.brojRacuna,
  }))
}

export async function createPaymentRecipient(naziv: string, brojRacuna: string): Promise<PaymentRecipient> {
  const r = await apiPost<{ naziv: string; brojRacuna: string }, BackendRecipient>(
    '/bank/client/payment-recipients',
    { naziv, brojRacuna }
  )
  return { id: String(r.id), naziv: r.naziv, broj_racuna: r.brojRacuna }
}

export async function updatePaymentRecipient(id: string, naziv: string, brojRacuna: string): Promise<PaymentRecipient> {
  const r = await apiPatch<{ naziv: string; brojRacuna: string }, BackendRecipient>(
    `/bank/client/payment-recipients/${id}`,
    { naziv, brojRacuna }
  )
  return { id: String(r.id), naziv: r.naziv, broj_racuna: r.brojRacuna }
}

export async function deletePaymentRecipient(id: string): Promise<void> {
  await apiDelete<unknown>(`/bank/client/payment-recipients/${id}`)
}

// ─── Create Payment Intent ────────────────────────────────────────────────────

export async function createPaymentIntent(params: {
  idempotencyKey: string
  racunPlatiocaId: number
  brojRacunaPrimaoca: string
  nazivPrimaoca: string
  iznos: number
  sifraPlacanja: string
  pozivNaBroj: string
  svrhaPlacanja: string
}): Promise<CreatePaymentIntentResult> {
  const res = await apiPost<typeof params, BackendCreatePaymentIntentResponse>(
    '/bank/client/payments',
    params
  )
  return {
    intent_id:   String(res.intentId),
    action_id:   String(res.actionId),
    broj_naloga: res.brojNaloga,
    status:      res.status,
    valuta:      res.valuta,
    iznos:       parseNum(res.iznos),
  }
}

// ─── Create Transfer Intent ───────────────────────────────────────────────────

export async function createTransferIntent(params: {
  idempotencyKey: string
  racunPlatiocaId: number
  racunPrimaocaId: number
  iznos: number
  svrhaPlacanja: string
}): Promise<CreatePaymentIntentResult> {
  const res = await apiPost<typeof params, BackendCreatePaymentIntentResponse>(
    '/bank/client/transfers',
    params
  )
  return {
    intent_id:   String(res.intentId),
    action_id:   String(res.actionId),
    broj_naloga: res.brojNaloga,
    status:      res.status,
    valuta:      res.valuta,
    iznos:       parseNum(res.iznos),
  }
}

// ─── Verify and Execute Payment ───────────────────────────────────────────────

export async function verifyAndExecutePayment(intentId: string, code: string): Promise<PaymentIntent> {
  const r = await apiPost<{ intentId: string; code: string }, BackendPaymentIntentItem>(
    `/bank/client/payments/${intentId}/verify`,
    { intentId, code }
  )
  return mapIntent(r)
}

// ─── Payment History ──────────────────────────────────────────────────────────

export async function getPaymentHistory(filter: PaymentHistoryFilter = {}): Promise<PaymentIntent[]> {
  const params: Record<string, string | number | boolean | undefined> = {}
  if (filter.status)     params['status']    = filter.status
  if (filter.date_from)  params['dateFrom']  = filter.date_from
  if (filter.date_to)    params['dateTo']    = filter.date_to
  if (filter.min_iznos)  params['minIznos']  = filter.min_iznos
  if (filter.max_iznos)  params['maxIznos']  = filter.max_iznos

  const res = await apiGet<{ payments: BackendPaymentIntentItem[] | null }>(
    '/bank/client/payments',
    params
  )
  return (res.payments ?? []).map(mapIntent)
}

// ─── Payment Detail ───────────────────────────────────────────────────────────

export async function getPaymentDetail(id: string): Promise<PaymentIntent> {
  const r = await apiGet<BackendPaymentIntentItem>(`/bank/client/payments/${id}`)
  return mapIntent(r)
}
