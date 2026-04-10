// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserType = 'ADMIN' | 'EMPLOYEE' | 'CLIENT'

export interface Permission {
  id: string
  name: string        // mapped from backend permissionCode
  description?: string
}

export interface JwtPayload {
  sub: string            // user id
  email: string
  user_type: string      // "ADMIN" | "EMPLOYEE" | "CLIENT" in JWT
  permissions: string[]  // permission codes
  exp: number
  iat: number
}

// ─── Auth Service contracts ───────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

// Backend (gRPC-Gateway) returns camelCase
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresIn?: string
}

export interface RefreshTokenRequest {
  refresh_token: string
}

// Backend returns camelCase for refresh too
export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

export interface ResetPasswordRequest {
  email: string
}

export interface SetPasswordRequest {
  token: string
  new_password: string
}

// ─── Employee Service contracts ──────────────────────────────────────────────

/**
 * Unified frontend Employee type – normalized from backend camelCase response.
 */
export interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string           // mapped from backend phoneNumber
  position: string
  department: string
  address: string
  username: string
  date_of_birth: string   // YYYY-MM-DD, mapped from backend birthDate (unix ms string)
  gender: string          // "MALE" | "FEMALE" | "OTHER"
  is_active: boolean
  user_type: UserType     // mapped from backend userType string enum
  permissions: string[]
}

export interface ListEmployeesRequest {
  page: number
  size: number            // sent as page_size to backend
  email?: string
  first_name?: string
  last_name?: string
  position?: string
}

export interface ListEmployeesResponse {
  employees: Employee[]
  hasMore: boolean
}

export interface GetEmployeeByIdRequest {
  id: string
}

export interface CreateEmployeeRequest {
  first_name: string
  last_name: string
  date_of_birth: string   // YYYY-MM-DD from form
  gender: string          // "MALE" | "FEMALE"
  email: string
  phone: string
  address: string
  username: string
  position: string
  department: string
  is_active: boolean
  permissions: string[]
  user_type?: UserType    // defaults to EMPLOYEE on backend when omitted
}

export interface UpdateEmployeeRequest {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  email: string
  phone: string
  address: string
  username: string
  position: string
  department: string
  is_active: boolean
  permissions: string[]
}

export interface UpdateClientRequest {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  address: string
}

export interface CreateClientRequest {
  first_name: string
  last_name: string
  email: string
  address: string
  date_of_birth: string   // YYYY-MM-DD from form; "" = not provided
  gender: string          // "" | "MALE" | "FEMALE"
  phone: string
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

export interface ClientDetail {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  address: string
  date_of_birth: number   // unix timestamp ms
  gender: string          // "MALE" | "FEMALE" | "OTHER" | ""
}

export interface ListClientsParams {
  name?: string
  email?: string
  limit?: number
  offset?: number
}

export interface ListClientsResponse {
  clients: Client[]
  has_more: boolean
}

// ─── gRPC/HTTP status codes ───────────────────────────────────────────────────

export enum GrpcStatus {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  UNAUTHENTICATED = 16,
}

export interface GrpcError {
  code: GrpcStatus
  message: string
}

// ─── Bank / Dictionary types ──────────────────────────────────────────────────

export interface ClientPreview {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface Currency {
  id: string
  naziv: string   // full name, e.g. "Srpski dinar"
  oznaka: string  // ISO 4217 code, e.g. "RSD"
}

export interface Delatnost {
  id: string
  sifra: string
  naziv: string
  grana: string
  sektor: string
}

// ─── Account creation contracts ──────────────────────────────────────────────

export interface CreateAccountFirmaRequest {
  naziv:               string
  maticni_broj:        string
  pib:                 string
  adresa:              string
  sifra_delatnosti_id: string
}

export interface CreateAccountRequest {
  vlasnik_id:      string
  kategorija:      string   // "TEKUCI" | "DEVIZNI"
  tip:             string   // "LICNI" | "POSLOVNI"
  valuta_id:       string
  podvrsta?:       string
  naziv_racuna:    string
  pocetno_stanje:  number
  napravi_karticu: boolean
  tip_kartice?:    string   // "VISA" | "MASTERCARD" | "DINACARD" | "AMEX"
  firma?:          CreateAccountFirmaRequest
}

// ─── App state ────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  userType: UserType
  permissions: string[]
}

// ─── Client account types ─────────────────────────────────────────────────────

export interface AccountListItem {
  id: string
  broj_racuna: string
  naziv_racuna: string
  kategorija_racuna: string  // "TEKUCI" | "DEVIZNI"
  vrsta_racuna: string       // "LICNI" | "POSLOVNI"
  valuta_oznaka: string      // e.g. "RSD", "EUR"
  stanje_racuna: number
  rezervisana_sredstva: number
  raspolozivo_stanje: number
}

export interface AccountDetail {
  id: string
  broj_racuna: string
  naziv_racuna: string
  kategorija_racuna: string
  vrsta_racuna: string
  valuta_oznaka: string
  stanje_racuna: number
  rezervisana_sredstva: number
  raspolozivo_stanje: number
  dnevni_limit: number   // 0 = nije postavljen
  mesecni_limit: number  // 0 = nije postavljen
  naziv_firme?: string   // samo za POSLOVNI
}

export interface Transakcija {
  id: string
  tip_transakcije: string     // "UPLATA" | "ISPLATA" | "INTERNI_TRANSFER"
  iznos: number
  opis: string
  vreme_izvrsavanja: string   // ISO 8601
  status: string              // "IZVRSEN" | "CEKANJE" | "STORNIRAN"
}

export interface KarticaKlijenta {
  id: string
  broj_kartice: string
  tip_kartice: string       // "VISA" | "MASTERCARD" | "DINACARD" | "AMEX"
  vrsta_kartice: string     // "DEBIT" | "CREDIT"
  datum_isteka: string      // ISO 8601
  status: string            // "AKTIVNA" | "BLOKIRANA" | "DEAKTIVIRANA"
  racun_id: string
  naziv_racuna: string
  broj_racuna: string
}

export interface MyProfile {
  id: string
  email: string
  first_name: string
  last_name: string
}

// ─── Employee account/card management types ───────────────────────────────────

export interface EmployeeAccountListItem {
  id: string
  broj_racuna: string
  vrsta_racuna: string       // "LICNI" | "POSLOVNI"
  kategorija_racuna: string  // "TEKUCI" | "DEVIZNI"
  vlasnik_id: string
  ime_vlasnika: string
  prezime_vlasnika: string
}

export interface EmployeeKarticaListItem {
  id: string
  broj_kartice: string
  status: string             // "AKTIVNA" | "BLOKIRANA" | "DEAKTIVIRANA"
  ime_vlasnika: string
  prezime_vlasnika: string
  email_vlasnika: string
}

// ─── Payment module types ─────────────────────────────────────────────────────

export interface PaymentRecipient {
  id: string
  naziv: string
  broj_racuna: string
}

export interface PaymentIntent {
  id: string
  idempotency_key: string
  broj_naloga: string
  tip_transakcije: string    // "PLACANJE" | "PRENOS"
  broj_racuna_platioca: string
  broj_racuna_primaoca: string
  naziv_primaoca: string
  iznos: number
  krajnji_iznos: number
  provizija: number
  valuta: string
  sifra_placanja: string
  poziv_na_broj: string
  svrha_placanja: string
  status: string             // "U_OBRADI" | "REALIZOVANO" | "ODBIJENO"
  created_at: string
  executed_at: string
  failed_reason: string
}

export interface CreatePaymentIntentResult {
  intent_id: string
  action_id: string
  broj_naloga: string
  status: string
  valuta: string
  iznos: number
  krajnji_iznos: number
  provizija: number
  kurs: number
  valuta_primaoca: string
}

export interface PaymentHistoryFilter {
  status?: string
  date_from?: string
  date_to?: string
  min_iznos?: number
  max_iznos?: number
}

// ─── Loan (Kredit) types ──────────────────────────────────────────────────────

export type VrstaKredita = 'GOTOVINSKI' | 'STAMBENI' | 'AUTO' | 'REFINANSIRAJUCI' | 'STUDENTSKI'
export type TipKamate = 'FIKSNA' | 'VARIJABILNA'
export type StatusKredita = 'ODOBREN' | 'ODBIJEN' | 'OTPLACEN' | 'U_KASNJENJU'
export type StatusPlacanja = 'PLACENO' | 'NEPLACENO' | 'KASNI'

export interface Kredit {
  id: string
  broj_kredita: string
  vrsta_kredita: VrstaKredita
  broj_racuna: string
  ukupan_iznos: number
  period_otplate: number
  kamatna_stopa: number
  efektivna_kamatna_stopa: number
  datum_ugovaranja: string
  datum_isplate: string
  iznos_sledece_rate: number
  datum_sledece_rate: string
  preostalo_dugovanje: number
  valuta: string
  status: StatusKredita
  tip_kamate: TipKamate
}

export interface KreditRata {
  id: string
  broj_kredita: string
  iznos_rate: number
  iznos_kamatne_stope: number
  valuta: string
  ocekivani_datum_dospeca: string
  pravi_datum_dospeca: string | null
  status_placanja: StatusPlacanja
}

export interface KreditDetail {
  kredit: Kredit
  rate: KreditRata[]
}

export interface ZahtevZaKreditRequest {
  vrsta_kredita: string
  tip_kamatne_stope: string
  iznos: number
  valuta: string
  svrha: string
  mesecna_plata: number
  status_zaposlenja: string
  period_zaposlenja: number
  kontakt_telefon: string
  broj_racuna: string
  rok_otplate: number
}

export type StatusZahteva = 'NA_CEKANJU' | 'ODOBREN' | 'ODBIJEN'

export interface KreditZahtev {
  id: string
  vrsta_kredita: VrstaKredita
  tip_kamatne_stope: TipKamate
  iznos: number
  valuta: string
  svrha: string
  mesecna_plata: number
  status_zaposlenja: string
  period_zaposlenja: number
  kontakt_telefon: string
  broj_racuna: string
  rok_otplate: number
  datum_podnosenja: string
  status: StatusZahteva
}

// ─── Trading (Celina 3) ───────────────────────────────────────────────────────

export type TradingOrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'
export type TradingOrderStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'DONE' | 'CANCELED'
export type TradingDirection = 'BUY' | 'SELL'

export interface TradingOrder {
  id: string
  userId: string
  accountId: string
  listingId: string
  orderType: TradingOrderType
  direction: TradingDirection
  quantity: number
  contractSize: number
  pricePerUnit?: string   // nil for MARKET orders
  stopPrice?: string      // nil for MARKET and LIMIT orders
  status: TradingOrderStatus
  approvedBy?: string
  approvedByLabel?: string  // "No need for approval" when auto-approved; supervisor ID otherwise
  isDone: boolean
  remainingPortions: number
  afterHours: boolean
  allOrNone: boolean
  margin: boolean
  lastModified: string    // ISO 8601
  createdAt: string       // ISO 8601
}

export interface TradingCalculateRequest {
  orderType: TradingOrderType
  direction: TradingDirection
  listingId: string
  quantity: number
  contractSize: number
  pricePerUnit?: string   // required for LIMIT, STOP_LIMIT
  stopPrice?: string      // required for STOP, STOP_LIMIT
  margin: boolean
  allOrNone: boolean
}

export interface TradingCalculateResponse {
  pricePerUnit: string
  approximatePrice: string
  commission: string
  initialMarginCost?: string  // only when margin=true
}

export interface TradingCreateOrderRequest {
  accountId: string
  listingId: string
  orderType: TradingOrderType
  direction: TradingDirection
  quantity: number
  contractSize: number
  pricePerUnit?: string
  stopPrice?: string
  afterHours: boolean
  allOrNone: boolean
  margin: boolean
}

// ─── Listings (Hartije od vrednosti) ─────────────────────────────────────────

export type ListingType = 'STOCK' | 'FOREX' | 'FUTURE' | 'OPTION'

export interface Listing {
  id: string               // int64 → string (gRPC-Gateway serijalizacija)
  ticker: string
  name: string
  listingType: ListingType
  exchangeId: string
  price: number
  ask: number
  bid: number
  volume: string           // int64 → string; koristiti parseInt() pri prikazu
  changePercent: number
  dollarVolume: number
  initialMarginCost: number
  lastRefresh: string      // ISO 8601 string ili ""
}

export interface ListingDetail {
  base: Listing
  nominalValue: number
  contractSize: number
  maintenanceMargin: number
  detailsJson: string
}

export interface ListingHistoryItem {
  /** "YYYY-MM-DD" ili RFC3339 za intradnevne tačke */
  date: string
  price: number
  askHigh: number
  bidLow: number
  priceChange: number
  volume: string
}

export interface ListingsFilter {
  listingType?: ListingType | ''
  search?: string
  minPrice?: number
  maxPrice?: number
  minVolume?: number
  maxVolume?: number
  /** YYYY-MM-DD — FUTURE/OPTION (settlement_date u details_json) */
  settlementFrom?: string
  settlementTo?: string
  sortBy?: 'price' | 'volume' | 'change' | 'ticker'
  sortOrder?: 'ASC' | 'DESC'
  page?: number
  pageSize?: number
}
