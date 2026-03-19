import { apiGet, apiPost } from './grpcClient'
import type { Kredit, KreditDetail, KreditRata, KreditZahtev, ZahtevZaKreditRequest } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSafeNum(v: any): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function normalizeTipKamate(tip: string): 'FIKSNA' | 'VARIJABILNA' {
  const t = (tip || '').toUpperCase()
  if (t === 'FIKSNI' || t === 'FIKSNA') return 'FIKSNA'
  if (t === 'VARIJABILNI' || t === 'VARIJABILNA') return 'VARIJABILNA'
  return 'FIKSNA'
}

// ─── Resilient mappers (snake_case || camelCase fallback) ──────────────────────

function mapKredit(k: any): Kredit {
  return {
    id:                      String(k.id ?? ''),
    broj_kredita:            k.brojKredita            || k.broj_kredita            || '',
    vrsta_kredita:           (k.vrstaKredita           || k.vrsta_kredita           || '') as Kredit['vrsta_kredita'],
    broj_racuna:             k.brojRacuna              || k.broj_racuna             || '',
    ukupan_iznos:            parseSafeNum(k.iznosKredita          || k.iznos_kredita          || 0),
    period_otplate:          parseSafeNum(k.periodOtplate         || k.period_otplate         || 0),
    kamatna_stopa:           parseSafeNum(k.nominalnaKamatnaStopa || k.nominalna_kamatna_stopa || k.kamatnaStopa || k.kamatna_stopa || 0),
    efektivna_kamatna_stopa: parseSafeNum(k.efektivnaKamatnaStopa || k.efektivna_kamatna_stopa || 0),
    datum_ugovaranja:        k.datumUgovaranja         || k.datum_ugovaranja         || '',
    datum_isplate:           k.datumIsplate            || k.datum_isplate            || '',
    iznos_sledece_rate:      parseSafeNum(k.iznosMesecneRate      || k.iznos_mesecne_rate      || 0),
    datum_sledece_rate:      k.datumSledeceRate        || k.datum_sledece_rate       || '',
    preostalo_dugovanje:     parseSafeNum(k.preostaloDugovanje    || k.preostalo_dugovanje     || 0),
    valuta:                  k.valuta                  || '',
    status:                  (k.status                 || 'ODOBREN') as Kredit['status'],
    tip_kamate:              normalizeTipKamate(k.tipKamate || k.tip_kamate || ''),
  }
}

function mapRata(r: any): KreditRata {
  return {
    id:                      String(r.id ?? ''),
    broj_kredita:            r.brojKredita             || r.broj_kredita             || '',
    iznos_rate:              parseSafeNum(r.iznosRate              || r.iznos_rate              || 0),
    iznos_kamatne_stope:     parseSafeNum(r.iznosKamatneStope     || r.iznos_kamatne_stope     || 0),
    valuta:                  r.valuta                  || '',
    ocekivani_datum_dospeca: r.ocekivaniDatumDospeca  || r.ocekivani_datum_dospeca  || '',
    pravi_datum_dospeca:     r.praviDatumDospeca      ?? r.pravi_datum_dospeca      ?? null,
    status_placanja:         (r.statusPlacanja         || r.status_placanja          || 'NEPLACENO') as KreditRata['status_placanja'],
  }
}

function mapZahtev(z: any): KreditZahtev {
  const iznosRaw        = z.iznosKredita       || z.iznos_kredita        || z.iznos        || 0
  const mesecnaPlataRaw = z.iznosMesecnePlate  || z.iznos_mesecne_plate  || z.mesecnaPlata || 0
  return {
    id:                String(z.id ?? ''),
    vrsta_kredita:     (z.vrstaKredita     || z.vrsta_kredita     || '') as KreditZahtev['vrsta_kredita'],
    tip_kamatne_stope: normalizeTipKamate(z.tipKamate || z.tip_kamate || ''),
    iznos:             parseSafeNum(iznosRaw),
    valuta:            z.valuta            || '',
    svrha:             z.svrhaKredita      || z.svrha_kredita     || z.svrha      || '',
    mesecna_plata:     parseSafeNum(mesecnaPlataRaw),
    status_zaposlenja: z.statusZaposlenja  || z.status_zaposlenja  || '',
    period_zaposlenja: parseSafeNum(z.periodZaposlenja || z.period_zaposlenja || 0),
    kontakt_telefon:   z.kontaktTelefon    || z.kontakt_telefon    || '',
    broj_racuna:       z.brojRacuna        || z.broj_racuna        || '',
    rok_otplate:       parseSafeNum(z.rokOtplate       || z.rok_otplate       || 0),
    datum_podnosenja:  z.datumPodnosenja   || z.datum_podnosenja   || '',
    status:            (z.status           || 'NA_CEKANJU') as KreditZahtev['status'],
  }
}

// ─── Client: getClientCredits ─────────────────────────────────────────────────
// GET /api/v1/client/credits

export async function getClientCredits(): Promise<Kredit[]> {
  const res = await apiGet<any>('/v1/client/credits')
  console.log('RAW BACKEND RESPONSE [getClientCredits]:', res)
  const arr: any[] = res.krediti || res.credits || []
  return arr.map(mapKredit)
}

// ─── Client: getCreditDetails ─────────────────────────────────────────────────
// GET /api/v1/client/credits/{id}

export async function getCreditDetails(id: string): Promise<KreditDetail> {
  const res = await apiGet<any>(`/v1/client/credits/${id}`)
  const rawKredit = res.kredit || res.credit || res
  const mappedKredit = mapKredit(rawKredit)
  const rawRate = res.rate || res.rata || res.installments || []
  const mappedRate = rawRate.map(mapRata)
  return { kredit: mappedKredit, rate: mappedRate }
}

// ─── Client: applyForCredit ───────────────────────────────────────────────────
// POST /api/v1/client/credits

export async function applyForCredit(req: ZahtevZaKreditRequest): Promise<{ id: string }> {
  const tipInput = req.tip_kamatne_stope.toUpperCase()
  let mappedTipKamate = tipInput
  if (tipInput === 'FIKSNA' || tipInput === 'FIKSNI') mappedTipKamate = 'FIKSNI'
  if (tipInput === 'VARIJABILNA' || tipInput === 'VARIJABILNI') mappedTipKamate = 'VARIJABILNI'

  const body = {
    vrsta_kredita:       req.vrsta_kredita.toUpperCase(),
    tip_kamate:          mappedTipKamate,
    iznos_kredita:       String(req.iznos),
    valuta:              req.valuta,
    svrha_kredita:       req.svrha,
    iznos_mesecne_plate: String(req.mesecna_plata),
    status_zaposlenja:   req.status_zaposlenja,
    period_zaposlenja:   req.period_zaposlenja,
    kontakt_telefon:     req.kontakt_telefon,
    broj_racuna:         req.broj_racuna,
    rok_otplate:         req.rok_otplate,
  }
  const res = await apiPost<typeof body, { id: string | number }>('/v1/client/credits', body)
  return { id: String(res.id) }
}

// ─── Employee: getAllCreditRequests ───────────────────────────────────────────
// GET /api/v1/employee/credits/requests

export async function getAllCreditRequests(): Promise<KreditZahtev[]> {
  const res = await apiGet<any>('/v1/employee/credits/requests')
  console.log('RAW BACKEND RESPONSE [getAllCreditRequests]:', res)
  const arr: any[] = res.zahtevi || res.requests || []
  return arr.map(mapZahtev)
}

// ─── Employee: approveCredit ──────────────────────────────────────────────────
// POST /api/v1/employee/credits/requests/{id}/approve

export async function approveCredit(id: string): Promise<void> {
  await apiPost<Record<string, unknown>, unknown>(
    `/v1/employee/credits/requests/${id}/approve`,
    {}
  )
}

// ─── Employee: rejectCredit ───────────────────────────────────────────────────
// POST /api/v1/employee/credits/requests/{id}/reject

export async function rejectCredit(id: string): Promise<void> {
  await apiPost<Record<string, unknown>, unknown>(
    `/v1/employee/credits/requests/${id}/reject`,
    {}
  )
}

// ─── Employee: getAllCreditsForEmployee ───────────────────────────────────────
// GET /api/v1/employee/credits

export async function getAllCreditsForEmployee(): Promise<Kredit[]> {
  const res = await apiGet<any>('/v1/employee/credits')
  console.log('RAW BACKEND RESPONSE [getAllCreditsForEmployee]:', res)
  const arr: any[] = res.krediti || res.credits || []
  return arr.map(mapKredit)
}
