/**
 * Feature: Permisije zaposlenih
 * Scenarios 16, 17, 18
 *
 * PRAVI end-to-end test — bez mock-ova, komunicira sa pravim backendom.
 *
 * ─── Napomena o navigaciji ────────────────────────────────────────────────────
 * Auth token živi samo u Zustand memoriji. cy.visit() bi resetovalo Zustand.
 * Nakon login-a navigiramo isključivo preko React Router-a (klikovi).
 *
 * ─── Preduslovi ───────────────────────────────────────────────────────────────
 * 1. docker-compose up -d  (u EXBanka-2-Backend)
 * 2. npm run dev           (u EXBanka-2-Frontend, port 3000)
 *
 * ─── Korisnici u bazi ─────────────────────────────────────────────────────────
 *   admin@raf.rs         / Test1234  (ADMIN)
 *   zaposleni@exbanka.rs / Test1234  (EMPLOYEE — Stefan Jovanovic, ID 5)
 */

const ADMIN_EMAIL  = 'admin@raf.rs'
const ADMIN_PASS   = 'Test1234'
const STEFAN_EMAIL = 'zaposleni@exbanka.rs'
const STEFAN_PASS  = 'Test1234'
const STEFAN_ID    = '5'

/** Dohvata accessToken direktnim API pozivom (van Zustand sesije). */
function getToken(email: string, password: string): Cypress.Chainable<string> {
  return cy
    .request({ method: 'POST', url: '/api/login', body: { email, password } })
    .its('body.accessToken')
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Scenariji 16–18: Permisije zaposlenih', () => {

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ── Scenario 16: Zaposleni bez admin pristupa ─────────────────────────────
  it('S16: zaposleni ne može pristupiti admin delu — preusmerava se na svoju početnu', () => {
    // Given: zaposleni je ulogovan
    cy.login(STEFAN_EMAIL, STEFAN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/employee')

    // When: pokuša da pristupi admin stranici direktnom navigacijom
    cy.visit('/admin/employees')

    // Then: PrivateRoute ga preusmerava (URL ne ostaje na /admin/employees)
    cy.url({ timeout: 8_000 }).should('not.include', '/admin/employees')
  })

  // ── Scenario 17: Dodela permisije VIEW_ACCOUNTS zaposlenom ───────────────
  it('S17: admin dodeljuje permisiju VIEW_ACCOUNTS zaposlenom Stefanu', () => {
    // Pun URL je http://localhost:3000/api/... — oblik /api/employee/5 ne match-uje bez **/
    cy.intercept('PUT', '**/api/employee/*').as('updateEmployee')

    // Given: admin je ulogovan
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')

    // And: navigira na edit stranicu Stefana putem SPA klikova
    cy.get('aside').contains('Lista zaposlenih').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
    cy.get('tbody', { timeout: 10_000 }).contains(STEFAN_EMAIL).should('be.visible')
    cy.get('tbody').contains(STEFAN_EMAIL).closest('tr').click()
    cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')

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

    // When: označi permisiju (kontrolisani checkbox — klik na labelu, ne .check())
    cy.contains('label', /Pregled računa|VIEW_ACCOUNTS/).click()

    // And: sačuva izmene
    cy.contains('button', 'Sačuvaj izmene').click()

    // Then: sistem čuva permisije
    cy.wait('@updateEmployee', { timeout: 10_000 }).then((interception) => {
      expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)
      const empId =
        interception.request.url.match(/\/employee\/(\d+)/)?.[1] ?? STEFAN_ID

      cy.contains('Izmene uspješno sačuvane', { timeout: 8_000 }).should('be.visible')

      return getToken(ADMIN_EMAIL, ADMIN_PASS).then((adminToken) => {
        return cy
          .request({
            method:  'GET',
            url:     `/api/employee/${empId}`,
            headers: { Authorization: `Bearer ${adminToken}` },
          })
          .then((resp) => {
            const permissions: string[] = resp.body.employee?.permissions ?? []
            expect(permissions).to.include('VIEW_ACCOUNTS')
          })
      })
    })

    // Cleanup: ukloni dodatu permisiju (navigacija putem SPA)
    cy.intercept('PUT', '**/api/employee/*').as('updateEmployeeCleanup')
    cy.url({ timeout: 8_000 }).should('include', '/admin/employees')
    cy.url().should('not.include', '/edit')
    cy.get('tbody', { timeout: 8_000 }).contains(STEFAN_EMAIL).should('be.visible')
    cy.get('tbody').contains(STEFAN_EMAIL).closest('tr').click()
    cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')
    cy.contains('label', /Pregled računa|VIEW_ACCOUNTS/).then(($lab) => {
      const $cb = $lab.find('input[type="checkbox"]')
      if ($cb.is(':checked')) cy.wrap($lab).click()
    })
    cy.contains('button', 'Sačuvaj izmene').click()
    cy.wait('@updateEmployeeCleanup', { timeout: 10_000 })
  })

  // ── Scenario 18: Kreiranje zaposlenog bez permisija ───────────────────────
  it('S18: admin kreira zaposlenog bez permisija — nalog nema permisije', () => {
    cy.intercept('POST', '/api/employee').as('createEmployee')

    const ts    = Date.now()
    const email = `bez.permisija.${ts}@testbanka.rs`

    // Given: admin je ulogovan i na stranici za kreiranje
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')
    cy.get('aside').contains('Novi zaposleni').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees/new')

    // When: popuni formular BEZ označavanja permisija
    cy.get('input[name="first_name"]').type('BezPermisija')
    cy.get('input[name="last_name"]').type('Test')
    cy.get('input[name="email"]').type(email)
    cy.get('input[name="phone"]').type('+381601234567')
    cy.get('input[name="address"]').type('Testna ulica 1')
    cy.get('input[name="date_of_birth"]').type('1995-01-01')
    cy.get('select[name="gender"]').select('MALE')
    cy.get('input[name="username"]').type(`bez.perm.${ts}`)
    cy.get('input[name="position"]').type('Junior Tester')
    cy.get('input[name="department"]').type('IT')

    // Proveri da nema označenih permission checkbox-ova
    cy.get('input[type="checkbox"]').not('[name="is_active"]').each(($cb) => {
      cy.wrap($cb).should('not.be.checked')
    })

    cy.contains('button', 'Kreiraj zaposlenog').click()

    // Then: sistem kreira zaposlenog
    cy.wait('@createEmployee', { timeout: 12_000 }).then((interception) => {
      expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)
      const empId = String(interception.response?.body.id)

      // And: verifikuj putem API da permisije su prazne
      getToken(ADMIN_EMAIL, ADMIN_PASS).then((adminToken) => {
        cy.request({
          method:  'GET',
          url:     `/api/employee/${empId}`,
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((resp) => {
          const permissions: string[] = resp.body.employee?.permissions ?? []
          expect(permissions, 'novi zaposleni nema permisije').to.be.empty
        })
      })
    })

    cy.contains('Zaposleni uspješno kreiran', { timeout: 8_000 }).should('be.visible')
  })
})

export {}
