/**
 * Feature 1: Autentifikacija korisnika — Scenarios 1–4
 *
 * Pravi end-to-end testovi — bez response stub-ova. Fresh zaposleni se kreira
 * i aktivira pre suite-a, a login se izvršava preko UI-ja.
 */

describe('Feature 1: Autentifikacija korisnika', () => {
  const WRONG_PASS = 'WrongPass12'
  let employee: { id: string; email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      employee = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ── Scenario 1: Uspešno logovanje zaposlenog ─────────────────────────────
  it('S1: zaposleni se uspešno loguje — dobija access token i preusmerava se na dashboard', () => {
    cy.intercept('POST', '/api/login').as('loginReq')

    cy.visit('/login')
    cy.contains('Prijava').should('be.visible')

    cy.get('input[name="email"]').type(employee.email)
    cy.get('#password').type(employee.password)
    cy.get('button[type="submit"]').should('not.be.disabled').click()

    cy.wait('@loginReq', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
      const body = i.response?.body
      expect(body).to.have.property('accessToken')
      expect(body.accessToken).to.be.a('string').and.not.be.empty
      expect(body).to.have.property('refreshToken')
    })

    cy.url({ timeout: 10_000 }).should('include', '/employee')
  })

  // ── Scenario 2: Neuspešno logovanje zbog pogrešne lozinke ───────────────
  it('S2: sistem odbija login sa pogrešnom lozinkom i prikazuje grešku', () => {
    cy.intercept('POST', '/api/login').as('loginReq')

    cy.visit('/login')
    cy.get('input[name="email"]').type(employee.email)
    cy.get('#password').type(WRONG_PASS)
    cy.get('button[type="submit"]').should('not.be.disabled').click()

    cy.wait('@loginReq', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode).to.not.equal(200)
    })

    cy.get('[role="alert"]', { timeout: 8_000 })
      .should('be.visible')
      .and('contain', 'Neispravni unos')
    cy.url().should('include', '/login')
  })

  // ── Scenario 3: Neuspešno logovanje zbog nepostojećeg korisnika ─────────
  it('S3: sistem odbija login za nepostojeći nalog i prikazuje grešku', () => {
    cy.intercept('POST', '/api/login').as('loginReq')

    cy.visit('/login')
    cy.get('input[name="email"]').type('nepostojeci.e2e@banka.rs')
    cy.get('#password').type('NotExist12')
    cy.get('button[type="submit"]').should('not.be.disabled').click()

    cy.wait('@loginReq', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode).to.not.equal(200)
    })

    cy.get('[role="alert"]', { timeout: 8_000 })
      .should('be.visible')
      .and('contain', 'Korisnik ne postoji')
    cy.url().should('include', '/login')
  })

  // ── Scenario 4: Reset lozinke putem email-a ─────────────────────────────
  it('S4: korisnik zatraži reset lozinke — sistem potvrđuje slanje emaila', () => {
    cy.intercept('POST', '/api/auth/forgot-password').as('forgotPw')

    cy.visit('/login')
    cy.contains('Zaboravili ste lozinku?').click()
    cy.url({ timeout: 6_000 }).should('include', '/forgot-password')
    cy.contains('Zaboravili ste lozinku?').should('be.visible')

    cy.get('input[name="email"]').type(employee.email)
    cy.contains('button', 'Pošalji link za reset').click()

    cy.wait('@forgotPw', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode).to.equal(200)
    })

    cy.contains('Email poslan', { timeout: 8_000 }).should('be.visible')
  })
})

export {}
