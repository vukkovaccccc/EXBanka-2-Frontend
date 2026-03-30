/**
 * Feature 1: Autentifikacija korisnika
 * Scenarios 1–4
 *
 * PRAVI end-to-end test — bez mock-ova, komunicira sa pravim backendom.
 *
 * ─── Preduslovi ───────────────────────────────────────────────────────────────
 * 1. docker-compose up -d  (u EXBanka-2-Backend ili EXBanka-2-Infrastructure)
 * 2. npm run dev           (u EXBanka-2-Frontend, port 3000)
 *
 * ─── Korisnici u bazi ─────────────────────────────────────────────────────────
 *   zaposleni@exbanka.rs / Test1234  (EMPLOYEE)
 *
 * ─── Napomene o submit dugmetu ────────────────────────────────────────────────
 * Login forma koristi mode:'onChange' sa Zod validacijom.
 * Dugme ima disabled={!isValid || isSubmitting} — mora biti enabled pre klika.
 * Koristimo .should('not.be.disabled') da Cypress sačeka React state update.
 */

const EMPLOYEE_EMAIL = 'zaposleni@exbanka.rs'
const EMPLOYEE_PASS  = 'Test1234'

// Prolazi klijentsku validaciju (8+, uppercase, lowercase, 2+ cifre)
// ali nije ispravna lozinka → backend vraća 401
const WRONG_PASS = 'WrongPass12'

describe('Feature 1: Autentifikacija korisnika', () => {

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ── Scenario 1: Uspešno logovanje zaposlenog ─────────────────────────────────
  it('S1: zaposleni se uspešno loguje — dobija access token i preusmerava se na dashboard', () => {
    cy.intercept('POST', '/api/login').as('loginReq')

    // Given: zaposleni se nalazi na login stranici
    cy.visit('/login')
    cy.contains('Prijava').should('be.visible')

    // When: unese validan email i lozinku
    cy.get('input[name="email"]').type(EMPLOYEE_EMAIL)
    cy.get('#password').type(EMPLOYEE_PASS)

    // Sačekaj da React form validacija odobri dugme, pa klikni
    cy.get('button[type="submit"]').should('not.be.disabled').click()

    // Then: sistem uspešno autentifikuje korisnika i generiše access token
    cy.wait('@loginReq', { timeout: 10_000 }).then((interception) => {
      expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)

      const body = interception.response?.body
      // And: generiše access token za sesiju
      expect(body, 'response ima accessToken').to.have.property('accessToken')
      expect(body.accessToken, 'access token je string').to.be.a('string').and.not.be.empty
      expect(body, 'response ima refreshToken').to.have.property('refreshToken')
    })

    // And: korisnik se preusmerava na početnu stranicu sistema
    cy.url({ timeout: 10_000 }).should('include', '/employee')
  })

  // ── Scenario 2: Neuspešno logovanje zbog pogrešne lozinke ───────────────────
  it('S2: sistem odbija login sa pogrešnom lozinkom i prikazuje grešku', () => {
    cy.intercept('POST', '/api/login').as('loginReq')

    // Given: zaposleni se nalazi na login stranici
    cy.visit('/login')

    // When: unese validan email i pogrešnu lozinku
    cy.get('input[name="email"]').type(EMPLOYEE_EMAIL)
    cy.get('#password').type(WRONG_PASS)

    // Sačekaj da dugme postane enabled (forma validna), pa klikni
    cy.get('button[type="submit"]').should('not.be.disabled').click()

    // Then: sistem odbija prijavu
    cy.wait('@loginReq', { timeout: 10_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.equal(401)
    })

    // And: prikazuje poruku o grešci
    cy.contains('Pogrešan email ili lozinka', { timeout: 8_000 }).should('be.visible')
    cy.url().should('include', '/login')
  })

  // ── Scenario 3: Neuspešno logovanje zbog nepostojećeg korisnika ─────────────
  it('S3: sistem odbija login za nepostojeći nalog i prikazuje grešku', () => {
    cy.intercept('POST', '/api/login').as('loginReq')

    // Given: korisnik se nalazi na login stranici
    cy.visit('/login')

    // When: unese email koji ne postoji u sistemu
    cy.get('input[name="email"]').type('nepostojeci@banka.rs')
    cy.get('#password').type('NotExist12')

    cy.get('button[type="submit"]').should('not.be.disabled').click()

    // Then: sistem odbija prijavu (backend vraća 404)
    cy.wait('@loginReq', { timeout: 10_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.equal(404)
    })

    // And: prikazuje poruku (frontend prikazuje backend message)
    cy.get('[role="alert"]', { timeout: 8_000 }).should('be.visible')
    cy.url().should('include', '/login')
  })

  // ── Scenario 4: Reset lozinke putem email-a ──────────────────────────────────
  it('S4: korisnik zatraži reset lozinke — sistem potvrđuje slanje emaila', () => {
    cy.intercept('POST', '/api/auth/forgot-password').as('forgotPw')

    // Given: korisnik se nalazi na login stranici
    cy.visit('/login')

    // When: klikne na "Zaboravili ste lozinku?"
    cy.contains('Zaboravili ste lozinku?').click()
    cy.url({ timeout: 6_000 }).should('include', '/forgot-password')
    cy.contains('Zaboravili ste lozinku?').should('be.visible')

    // And: unese email
    cy.get('input[name="email"]').type(EMPLOYEE_EMAIL)
    cy.contains('button', 'Pošalji link za reset').click()

    // Then: sistem šalje email sa linkom za reset lozinke
    cy.wait('@forgotPw', { timeout: 8_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
    })

    // And: prikazuje potvrdu slanja
    // (backend uvek prikazuje uspeh — ne odaje da li email postoji)
    cy.contains('Email poslan', { timeout: 8_000 }).should('be.visible')
    cy.contains('link za resetovanje lozinke').should('be.visible')
  })
})

export {}
