import { apiGet, apiPost } from './grpcClient'
import { useAuthStore } from '@/store/authStore'
import type { ClientPreview, Currency, Delatnost, CreateAccountRequest } from '@/types'

// ─── Backend response shapes (gRPC-Gateway camelCase) ─────────────────────────

interface BackendClientPreview {
  id: string | number
  firstName: string
  lastName: string
  email: string
}

interface BackendCurrency {
  id: string | number
  naziv: string
  oznaka: string
}

interface BackendDelatnost {
  id: string | number
  sifra: string
  naziv: string
  grana: string
  sektor: string
}

// ─── SearchClients ─────────────────────────────────────────────────────────────

export interface SearchClientsResult {
  clients: ClientPreview[]
  hasMore: boolean
}

export async function searchClients(req: {
  query?: string
  page: number
  limit: number
}): Promise<SearchClientsResult> {
  const res = await apiGet<{ clients: BackendClientPreview[] | null; hasMore?: boolean }>(
    '/client/search',
    {
      query:  req.query || undefined,
      page:   req.page,
      limit:  req.limit,
    }
  )
  const clients: ClientPreview[] = (res.clients ?? []).map((c) => ({
    id:         String(c.id),
    first_name: c.firstName,
    last_name:  c.lastName,
    email:      c.email,
  }))
  return { clients, hasMore: res.hasMore ?? false }
}

// ─── GetCurrencies ─────────────────────────────────────────────────────────────

export async function getCurrencies(): Promise<Currency[]> {
  const res = await apiGet<{ valute: BackendCurrency[] | null }>('/bank/currencies')
  return (res.valute ?? []).map((c) => ({
    id:     String(c.id),
    naziv:  c.naziv,
    oznaka: c.oznaka,
  }))
}

// ─── GetDelatnosti ─────────────────────────────────────────────────────────────

export async function getDelatnosti(): Promise<Delatnost[]> {
  const res = await apiGet<{ delatnosti: BackendDelatnost[] | null }>('/bank/delatnosti')
  return (res.delatnosti ?? []).map((d) => ({
    id:     String(d.id),
    sifra:  d.sifra,
    naziv:  d.naziv,
    grana:  d.grana,
    sektor: d.sektor,
  }))
}

// ─── CreateAccount ─────────────────────────────────────────────────────────────

export async function createAccount(req: CreateAccountRequest): Promise<{ id: string }> {
  const zaposleniId = useAuthStore.getState().user?.id

  const body = {
    zaposleniId:      Number(zaposleniId),
    vlasnikId:        Number(req.vlasnik_id),
    valutaId:         Number(req.valuta_id),
    kategorijaRacuna: req.kategorija,
    vrstaRacuna:      req.tip,
    podvrsta:         req.podvrsta ?? '',
    naziv:            req.naziv_racuna,
    stanje:           req.pocetno_stanje,
    kreirajKarticu:   req.napravi_karticu,
    ...(req.firma && {
      firma: {
        naziv:       req.firma.naziv,
        maticniBroj: req.firma.maticni_broj,
        pib:         req.firma.pib,
        delatnostId: Number(req.firma.sifra_delatnosti_id),
        adresa:      req.firma.adresa,
        vlasnikId:   Number(req.vlasnik_id),
      },
    }),
  }

  const res = await apiPost<typeof body, { id: string | number }>('/bank/accounts', body)
  return { id: String(res.id) }
}
