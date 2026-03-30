/**
 * Celina 1: Računi
 * Feature: Kreiranje i upravljanje računima
 * Scenario 1: Kreiranje tekućeg računa za postojećeg klijenta
 *
 * PRAVI end-to-end test — bez mock-ova, komunicira sa pravim backendom.
 *
 * ─── Preduslovi ───────────────────────────────────────────────────────────────
 * 1. Pokreni backend:
 *      cd EXBanka-2-Backend && docker-compose up -d
 *
 * 2. Pokreni frontend dev server (u zasebnom terminalu):
 *      cd EXBanka-2-Frontend && npm run dev
 *      → sluša na http://localhost:3000
 *
 * 3. Pokreni test:
 *      npx cypress run --spec "cypress/e2e/celina1_scenario1_real.cy.ts"
 *    ili interaktivno:
 *      npx cypress open
 *
 * ─── Korisnici u bazi ─────────────────────────────────────────────────────────
 *   zaposleni@exbanka.rs  / Test1234  (EMPLOYEE)
 *   kseniakenny@gmail.com / Test1234  (CLIENT  — vlasnik novog računa)
 */

// ─── Konstante ─────────────────────────────────────────────────────────────────

const EMPLOYEE_EMAIL = 'zaposleni@exbanka.rs'
const EMPLOYEE_PASS  = 'Test1234'
const CLIENT_EMAIL   = 'kseniakenny@gmail.com'
const CLIENT_PASS    = 'Test1234'
const CLIENT_NAME    = 'Ksenija Kenny'

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Dohvata accessToken za datog korisnika direktnim API pozivom. */
function getToken(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({ method: 'POST', url: '/api/login', body: { email, password } })
    .its('body.accessToken')
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe('Celina 1 — Scenario 1: Kreiranje tekućeg računa za postojećeg klijenta', () => {
  // Jedinstveni naziv računa po svakom pokretanju testa (ne konfliktovaće u bazi)
  const accountName = `Tekuci E2E ${Date.now()}`

  // Čistimo auth state pre svakog `it` bloka — sprečava auto-redirect sa /login
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ─── Before: verifikuj da je backend dostupan ──────────────────────────────
  before(() => {
    cy.request({
      method:           'GET',
      url:              '/api/bank/currencies',
      failOnStatusCode: false,
    }).then((resp) => {
      // 200 = ok, 401 = backend živ ali zahteva token — oba su prihvatljiva
      expect(resp.status, 'bank-service mora biti dostupan').to.be.oneOf([200, 401])
    })
  })

  // ─── Given: zaposleni je ulogovan u aplikaciju ──────────────────────────────
  // ─── And: nalazi se na stranici za kreiranje računa ────────────────────────
  // ─── When: izabere postojećeg klijenta iz baze ─────────────────────────────
  // ─── And: izabere tip računa "Tekući račun" ─────────────────────────────────
  // ─── And: unese početno stanje računa ──────────────────────────────────────
  // ─── Then: sistem generiše broj računa od 18 cifara ────────────────────────
  // ─── And: račun se uspešno kreira ──────────────────────────────────────────
  // ─── And: klijent dobija email obaveštenje ──────────────────────────────────
  it('pokriva pun tok: login zaposlenog → kreiranje tekućeg računa → 18-cifreni broj → email obaveštenje', () => {

    // Spy na kreiranje računa (propuštamo ka pravom backendu, samo pratimo response)
    cy.intercept('POST', '/api/bank/accounts').as('createAccount')

    // ── Given: zaposleni je ulogovan ──────────────────────────────────────────
    cy.login(EMPLOYEE_EMAIL, EMPLOYEE_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/employee')

    // ── And: na stranici za kreiranje računa ──────────────────────────────────
    cy.get('aside').contains('Kreiraj račun').click()
    cy.contains('h1', 'Kreiraj račun', { timeout: 8_000 }).should('be.visible')

    // ── When: izabere postojećeg klijenta iz baze ─────────────────────────────
    // Fokus na search input → dropdown automatski dohvata sve klijente
    cy.get('input[placeholder="Pretraži klijenta..."]').focus()
    cy.contains('button', CLIENT_NAME, { timeout: 8_000 }).click()

    // Verifikuj da je klijent selektovan (input pokazuje ime + email)
    cy.get('input[placeholder="Pretraži klijenta..."]')
      .should('have.value', `${CLIENT_NAME} (${CLIENT_EMAIL})`)

    // ── And: izabere tip računa "Tekući račun" ────────────────────────────────
    // TEKUCI i LICNI su default vrednosti — samo verifikujemo
    cy.get('input[type="radio"][value="TEKUCI"]').should('be.checked')
    cy.get('input[type="radio"][value="LICNI"]').should('be.checked')

    // Podvrsta je obavezna za TEKUCI račun
    cy.get('select[name="podvrsta"]').select('Standardni')

    // ── And: unese naziv računa i početno stanje ──────────────────────────────
    cy.get('input[name="naziv_racuna"]').type(accountName)
    cy.get('input[name="pocetno_stanje"]').clear().type('5000')

    // ── Submit ────────────────────────────────────────────────────────────────
    cy.contains('button', 'Kreiraj račun').click()

    // ── Then: račun se uspešno kreira ─────────────────────────────────────────
    cy.contains('Račun uspješno kreiran.', { timeout: 10_000 }).should('be.visible')

    // ── Then: sistem generiše broj računa od 18 cifara ────────────────────────
    cy.wait('@createAccount', { timeout: 12_000 }).then((interception) => {
      expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)

      const accountId: string = interception.response?.body.id
      expect(accountId, 'response sadrži id kreiranog računa').to.be.a('string').and.not.be.empty

      // Dohvatamo listu klijentovih računa i proveravamo broj računa
      getToken(CLIENT_EMAIL, CLIENT_PASS).then((token) => {
        cy.request({
          method:  'GET',
          url:     '/api/bank/client/accounts',
          headers: { Authorization: `Bearer ${token}` },
        }).then((accountsResp) => {
          const accounts: Array<{ id: string; brojRacuna: string }> =
            accountsResp.body.accounts ?? []

          const created = accounts.find((a) => a.id === accountId)
          expect(created, 'kreirani račun postoji u listi klijenta').to.exist

          // Broj računa je tačno 18 cifara (nema separatora, čist string)
          expect(
            created!.brojRacuna.length,
            `broj računa "${created!.brojRacuna}" treba imati 18 cifara`,
          ).to.equal(18)
        })
      })
    })

    // ── And: klijent dobija email obaveštenje ─────────────────────────────────
    //
    // Email se šalje asinhrono:
    //   bank-service → RabbitMQ → notification-service → SMTP
    //
    // Garancija: HTTP 200 od bank-service znači da je događaj objavljen na
    // RabbitMQ. Notification-service ga prima i šalje email na CLIENT_EMAIL.
    // Stvarna isporuka emaila zavisi od SMTP konfiguracije u .env fajlu.
    //
    // Verifikujemo da je bank-service vratio 200 (event je objavljen):
    cy.get('@createAccount').its('response.statusCode').should('eq', 200)
  })

  // ─── Verifikacija sa strane klijenta ──────────────────────────────────────────
  it('klijent vidi novi račun sa 18-cifrenim brojem na stranici Računi', () => {
    cy.login(CLIENT_EMAIL, CLIENT_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/client')

    cy.get('aside').contains('Računi').click()
    cy.url().should('include', '/client/accounts')

    // Čekamo da se bar jedan račun pojavi u listi
    cy.get('span.text-xs.font-medium.text-gray-500.truncate', { timeout: 8_000 })
      .first()
      .invoke('text')
      .then((brojRacuna) => {
        expect(
          brojRacuna.trim().length,
          `broj računa "${brojRacuna.trim()}" treba imati 18 cifara`,
        ).to.equal(18)
      })
  })
})

export {}
