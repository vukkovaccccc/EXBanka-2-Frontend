/**
 * Feature: Upravljanje zaposlenima
 * Scenarios 6, 7, 11, 12, 13, 14, 15
 *
 * PRAVI end-to-end test — bez mock-ova, komunicira sa pravim backendom.
 *
 * ─── Napomena o navigaciji ────────────────────────────────────────────────────
 * Auth token živi samo u Zustand memoriji. cy.visit() bi resetovalo Zustand
 * i izgubilo sesiju. Nakon login-a navigiramo isključivo preko React Router-a
 * (klikovi na sidebar i tabelu — bez ponovnog cy.visit).
 *
 * ─── Preduslovi ───────────────────────────────────────────────────────────────
 * 1. docker-compose up -d  (u EXBanka-2-Backend)
 * 2. npm run dev           (u EXBanka-2-Frontend, port 3000)
 *
 * ─── Korisnici u bazi ─────────────────────────────────────────────────────────
 *   admin@raf.rs         / Test1234  (ADMIN,    ID 1)
 *   zaposleni@exbanka.rs / Test1234  (EMPLOYEE — Stefan Jovanovic, ID 5)
 */

const ADMIN_EMAIL    = 'admin@raf.rs'
const ADMIN_PASS     = 'Test1234'
const STEFAN_EMAIL   = 'zaposleni@exbanka.rs'
const STEFAN_ID      = '5'

/** Dohvata accessToken direktnim API pozivom (van Zustand sesije). */
function getToken(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({ method: 'POST', url: '/api/login', body: { email, password } })
    .its('body.accessToken')
}

// ─── Helper: navigacija do edit stranice zaposlenog ───────────────────────────

/**
 * Navigira do edit stranice zaposlenog putem SPA klikova (bez cy.visit).
 * Pretpostavlja da je admin već ulogovan i sidebar je vidljiv.
 * Traži zaposlenog po email-u u tabeli i klika na red.
 */
function navigateToEmployeeEdit(employeeEmail: string) {
  cy.get('aside').contains('Lista zaposlenih').click()
  cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
  // Polje za pretragu takođe sadrži tekst emaila — traži red samo u tabeli
  cy.get('tbody', { timeout: 10_000 }).contains(employeeEmail).should('be.visible')
  cy.get('tbody').contains(employeeEmail).closest('tr').click()
  cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')
  // Seed korisnik često ima praznu adresu ili GENDER_UNSPECIFIED → prazan select; forma inače ne šalje PUT
  cy.get('input[name="address"]').then(($a) => {
    if (!(($a.val() as string) ?? '').trim()) {
      cy.wrap($a).clear().type('Adresa za E2E')
    }
  })
  cy.get('select[name="gender"]').then(($s) => {
    if (!$s.val()) {
      cy.wrap($s).select('MALE')
    }
  })
}

// ─── Scenarios 6–7: Kreiranje zaposlenog ─────────────────────────────────────

describe('Scenariji 6–7: Kreiranje zaposlenog (admin)', () => {
  const ts = Date.now()
  const newEmail = `novi.zaposleni.${ts}@testbanka.rs`

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ── Scenario 6: Uspešno kreiranje zaposlenog ──────────────────────────────
  it('S6: admin kreira novog zaposlenog — sistem šalje email za aktivaciju', () => {
    cy.intercept('POST', '/api/employee').as('createEmployee')

    // Given: admin je ulogovan
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')

    // And: na stranici za kreiranje zaposlenog (klik na sidebar)
    cy.get('aside').contains('Novi zaposleni').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees/new')

    // When: popuni formular
    cy.get('input[name="first_name"]').type('Novi')
    cy.get('input[name="last_name"]').type('Zaposleni')
    cy.get('input[name="email"]').type(newEmail)
    cy.get('input[name="phone"]').type('+381641234567')
    cy.get('input[name="address"]').type('Testna ulica 5')
    cy.get('input[name="date_of_birth"]').type('1992-03-10')
    cy.get('select[name="gender"]').select('MALE')
    cy.get('input[name="username"]').type(`novi.zap.${ts}`)
    cy.get('input[name="position"]').type('Junior Developer')
    cy.get('input[name="department"]').type('IT')

    // And: klikne "Kreiraj zaposlenog"
    cy.contains('button', 'Kreiraj zaposlenog').click()

    // Then: sistem kreira zaposlenog
    cy.wait('@createEmployee', { timeout: 12_000 }).then((interception) => {
      expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)
      expect(interception.response?.body).to.have.property('id')
    })

    // And: prikazuje toast poruku o uspehu
    cy.contains('Zaposleni uspješno kreiran', { timeout: 8_000 }).should('be.visible')

    // And: preusmerava na listu zaposlenih
    cy.url({ timeout: 8_000 }).should('include', '/admin/employees')
    cy.url().should('not.include', '/new')
  })

  // ── Scenario 7: Duplikat email greška ─────────────────────────────────────
  it('S7: sistem odbija kreiranje zaposlenog sa već korišćenim email-om', () => {
    cy.intercept('POST', '/api/employee').as('createEmployee')

    // Given: admin je ulogovan
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')

    cy.get('aside').contains('Novi zaposleni').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees/new')

    // When: popuni formular sa već postojećim emailom (Stefan-ovim)
    cy.get('input[name="first_name"]').type('Duplikat')
    cy.get('input[name="last_name"]').type('Korisnik')
    cy.get('input[name="email"]').type(STEFAN_EMAIL)
    cy.get('input[name="phone"]').type('+381641234567')
    cy.get('input[name="address"]').type('Testna ulica 5')
    cy.get('input[name="date_of_birth"]').type('1992-03-10')
    cy.get('select[name="gender"]').select('MALE')
    cy.get('input[name="username"]').type(`duplikat.${ts}`)
    cy.get('input[name="position"]').type('Developer')
    cy.get('input[name="department"]').type('IT')

    cy.contains('button', 'Kreiraj zaposlenog').click()

    // Then: sistem odbija zahtev
    cy.wait('@createEmployee', { timeout: 12_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.not.equal(200)
    })

    // And: prikazuje grešku o duplikatu
    cy.contains('Nalog sa ovom email adresom već postoji', { timeout: 8_000 }).should('be.visible')
    cy.url().should('include', '/admin/employees/new')
  })
})

// ─── Scenarios 11–12: Lista i pretraga zaposlenih ────────────────────────────

describe('Scenariji 11–12: Lista i pretraga zaposlenih (admin)', () => {

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')
    cy.get('aside').contains('Lista zaposlenih').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
  })

  // ── Scenario 11: Pregled liste zaposlenih ─────────────────────────────────
  it('S11: admin vidi listu svih zaposlenih', () => {
    cy.contains('Lista korisnika').should('be.visible')
    cy.contains('Stefan', { timeout: 8_000 }).should('be.visible')
    cy.contains('Jovanovic').should('be.visible')
  })

  // ── Scenario 12: Pretraga zaposlenog po imenu ─────────────────────────────
  it('S12: admin pretražuje zaposlenog po imenu i dobija rezultat', () => {
    cy.intercept('GET', '/api/employee*').as('searchEmployees')

    cy.get('input[placeholder="Ime"]').type('Stefan')
    cy.contains('button', 'Pretraži').click()

    cy.wait('@searchEmployees', { timeout: 8_000 })

    cy.contains('Stefan').should('be.visible')
    cy.contains(STEFAN_EMAIL).should('be.visible')
  })
})

// ─── Scenarios 13–15: Izmena, deaktivacija i zaštita admin naloga ────────────

describe('Scenariji 13–15: Izmena, deaktivacija i zaštita admin naloga', () => {

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')
  })

  // ── Scenario 13: Izmena podataka zaposlenog ───────────────────────────────
  it('S13: admin menja podatke zaposlenog (Stefan) i čuva izmene', () => {
    cy.intercept('PUT', '**/api/employee/*').as('updateEmployee')

    // Given: admin navigira na edit stranicu Stefana putem SPA klikova
    navigateToEmployeeEdit(STEFAN_EMAIL)
    cy.contains('Stefan').should('be.visible')

    // When: izmeni poziciju
    cy.get('input[name="position"]').clear().type('Senior Savetnik')

    // And: sačuva izmene
    cy.contains('button', 'Sačuvaj izmene').click()

    // Then: sistem čuva izmene
    cy.wait('@updateEmployee', { timeout: 10_000 }).then((interception) => {
      expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)
    })

    cy.contains('Izmene uspješno sačuvane', { timeout: 8_000 }).should('be.visible')
    cy.url({ timeout: 8_000 }).should('include', '/admin/employees')
    cy.url().should('not.include', '/edit')

    // Cleanup: vrati originalnu poziciju
    cy.intercept('PUT', '**/api/employee/*').as('restorePosition')
    navigateToEmployeeEdit(STEFAN_EMAIL)
    cy.get('input[name="position"]').clear().type('Savetnik')
    cy.contains('button', 'Sačuvaj izmene').click()
    cy.wait('@restorePosition', { timeout: 10_000 })
  })

  // ── Scenario 14: Deaktivacija zaposlenog ─────────────────────────────────
  it('S14: admin deaktivira zaposlenog i može ga ponovo aktivirati', () => {
    const ts14    = Date.now()
    const email14 = `deaktivacija.${ts14}@testbanka.rs`

    // Kreiranje zasebnog test zaposlenog (direktan API poziv, van Zustand sesije)
    getToken(ADMIN_EMAIL, ADMIN_PASS).then((adminToken) => {
      cy.request({
        method: 'POST',
        url: '/api/employee',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          email:        email14,
          first_name:   'Deaktivacija',
          last_name:    'Test',
          birth_date:   new Date('1990-01-01').getTime(),
          gender:       1,
          phone_number: '+381601234567',
          address:      'Testna 1',
          username:     `deak.${ts14}`,
          position:     'Tester',
          department:   'IT',
          is_active:    true,
          permissions:  [],
          userType:     'USER_TYPE_EMPLOYEE',
        },
      }).then((createResp) => {
        const empId = String(createResp.body.id)
        cy.intercept('PATCH', `/api/employee/${empId}/active`).as('toggleActive')

        // Given: admin navigira na edit stranicu novog zaposlenog putem SPA
        // Traži zaposlenog u listi po email-u
        cy.get('aside').contains('Lista zaposlenih').click()
        cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
        cy.get('input[type="email"]').type(email14)
        cy.contains('button', 'Pretraži').click()
        cy.contains(email14, { timeout: 10_000 }).should('be.visible')
        cy.contains(email14).closest('tr').click()
        cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')

        // Verifikuj da je nalog aktivan
        cy.contains('● Nalog aktivan').should('be.visible')

        // When: klikne "Deaktiviraj nalog"
        cy.contains('button', 'Deaktiviraj nalog').click()

        // Then: nalog se deaktivira
        cy.wait('@toggleActive', { timeout: 10_000 }).then((interception) => {
          expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)
        })

        cy.contains('Nalog deaktiviran', { timeout: 8_000 }).should('be.visible')
        cy.contains('● Nalog deaktiviran', { timeout: 6_000 }).should('be.visible')

        // And: može ga ponovo aktivirati
        cy.contains('button', 'Aktiviraj nalog').click()
        cy.wait('@toggleActive', { timeout: 10_000 })
        cy.contains('Nalog aktiviran', { timeout: 8_000 }).should('be.visible')
      })
    })
  })

  // ── Scenario 15: Zaštita admin naloga od izmene ───────────────────────────
  // Admin nalozi nemaju dugme za izmenu u listi — sistem ih štiti na UI nivou.
  // Backend dodatno štiti putem PERMISSION_DENIED ako se direktno pozove API.
  it('S15: admin nalozi su zaštićeni — nema dugmeta za izmenu u listi', () => {
    // Given: admin navigira na listu zaposlenih
    cy.get('aside').contains('Lista zaposlenih').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees')

    // Admin može biti van prve strane (paginacija) — lociraj pretragom po email-u
    cy.get('input[name="email"]').clear().type(ADMIN_EMAIL)
    cy.contains('button', 'Pretraži').click()
    cy.get('tbody', { timeout: 10_000 }).contains(ADMIN_EMAIL).should('be.visible')

    // Then: admin red NEMA dugme za izmenu zaposlenog
    cy.get('tbody').contains(ADMIN_EMAIL).closest('tr')
      .find('button[title="Izmeni zaposlenog"]').should('not.exist')

    // And: admin red NEMA dugme za deaktivaciju
    cy.get('tbody').contains(ADMIN_EMAIL).closest('tr')
      .find('button[title="Deaktiviraj nalog"]').should('not.exist')

    // And: admin red NEMA cursor-pointer klasu (nije klikabilan kao redirect)
    cy.get('tbody').contains(ADMIN_EMAIL).closest('tr')
      .should('not.have.class', 'cursor-pointer')
  })
})

export {}
