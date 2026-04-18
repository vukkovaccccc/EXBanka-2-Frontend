/**
 * Feature: Upravljanje zaposlenima — Scenarios 6, 7, 11, 12, 13, 14, 15
 *
 * Pravi end-to-end test — bez response stub-ova. Fresh zaposleni se kreira
 * via API pre file-suite-a i koristi se kao "cilj" za pretragu/izmenu/deaktivaciju.
 */

import { ADMIN_EMAIL, ADMIN_PASS } from '../../../support/commands'

// ─── Helper: navigacija do edit stranice zaposlenog (po email-u) ─────────────
function navigateToEmployeeEdit(employeeEmail: string) {
  cy.get('aside').contains('Lista zaposlenih').click()
  cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
  cy.get('input[name="email"]').clear().type(employeeEmail)
  cy.contains('button', 'Pretraži').click()
  cy.get('tbody', { timeout: 10_000 }).contains(employeeEmail).should('be.visible')
  cy.get('tbody').contains(employeeEmail).closest('tr').click()
  cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')
  // Fresh account ne mora imati adresu/pol; forma inače ne šalje PUT
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

// ─── Scenarios 6–7: Kreiranje zaposlenog (admin) ─────────────────────────────

describe('Scenariji 6–7: Kreiranje zaposlenog (admin)', () => {
  let targetEmployee: { id: string; email: string }

  // Kreiramo jednog zaposlenog koji ce biti target za "duplikat email" test
  before(() => {
    cy.createActivatedEmployee().then((u) => {
      targetEmployee = { id: u.id, email: u.email }
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('S6: admin kreira novog zaposlenog — sistem šalje email za aktivaciju', () => {
    cy.intercept('POST', '/api/employee').as('createEmployee')

    const ts = Date.now()
    const newEmail = `novi.zaposleni.${ts}@testbanka.rs`

    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')

    cy.get('aside').contains('Novi zaposleni').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees/new')

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

    cy.contains('button', 'Kreiraj zaposlenog').click()

    cy.wait('@createEmployee', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
      expect(i.response?.body).to.have.property('id')
    })

    cy.contains('Zaposleni uspješno kreiran', { timeout: 8_000 }).should('be.visible')
    cy.url({ timeout: 8_000 }).should('include', '/admin/employees')
    cy.url().should('not.include', '/new')
  })

  it('S7: sistem odbija kreiranje zaposlenog sa već korišćenim email-om', () => {
    cy.intercept('POST', '/api/employee').as('createEmployee')

    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')

    cy.get('aside').contains('Novi zaposleni').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees/new')

    const ts = Date.now()
    cy.get('input[name="first_name"]').type('Duplikat')
    cy.get('input[name="last_name"]').type('Korisnik')
    cy.get('input[name="email"]').type(targetEmployee.email)
    cy.get('input[name="phone"]').type('+381641234567')
    cy.get('input[name="address"]').type('Testna ulica 5')
    cy.get('input[name="date_of_birth"]').type('1992-03-10')
    cy.get('select[name="gender"]').select('MALE')
    cy.get('input[name="username"]').type(`duplikat.${ts}`)
    cy.get('input[name="position"]').type('Developer')
    cy.get('input[name="department"]').type('IT')

    cy.contains('button', 'Kreiraj zaposlenog').click()

    cy.wait('@createEmployee', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode).to.not.equal(200)
    })

    cy.contains('Nalog sa ovom email adresom već postoji', { timeout: 8_000 }).should('be.visible')
    cy.url().should('include', '/admin/employees/new')
  })
})

// ─── Scenarios 11–12: Lista i pretraga zaposlenih ───────────────────────────

describe('Scenariji 11–12: Lista i pretraga zaposlenih (admin)', () => {
  let target: { id: string; email: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      target = { id: u.id, email: u.email }
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')
    cy.get('aside').contains('Lista zaposlenih').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
  })

  it('S11: admin vidi listu svih zaposlenih', () => {
    cy.contains('Lista korisnika').should('be.visible')
    // Admin seed korisnik je uvek prisutan
    cy.contains('admin@raf.rs', { timeout: 8_000 }).should('be.visible')
  })

  it('S12: admin pretražuje zaposlenog po emailu i dobija rezultat', () => {
    cy.intercept('GET', '/api/employee*').as('searchEmployees')

    cy.get('input[name="email"]').type(target.email)
    cy.contains('button', 'Pretraži').click()

    cy.wait('@searchEmployees', { timeout: 10_000 })

    cy.contains(target.email).should('be.visible')
  })
})

// ─── Scenarios 13–15: Izmena, deaktivacija i zaštita admin naloga ──────────

describe('Scenariji 13–15: Izmena, deaktivacija i zaštita admin naloga', () => {
  let target: { id: string; email: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      target = { id: u.id, email: u.email }
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')
  })

  it('S13: admin menja podatke zaposlenog i čuva izmene', () => {
    cy.intercept('PUT', '**/api/employee/*').as('updateEmployee')

    navigateToEmployeeEdit(target.email)

    cy.get('input[name="position"]').clear().type('Senior Savetnik')
    cy.contains('button', 'Sačuvaj izmene').click()

    cy.wait('@updateEmployee', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
    })

    cy.contains('Izmene uspješno sačuvane', { timeout: 8_000 }).should('be.visible')
    cy.url({ timeout: 8_000 }).should('include', '/admin/employees')
    cy.url().should('not.include', '/edit')
  })

  it('S14: admin deaktivira zaposlenog i može ga ponovo aktivirati', () => {
    // Zaseban zaposleni za ovaj test — da ne remeti ostale
    cy.createActivatedEmployee().then((u) => {
      cy.intercept('PATCH', `/api/employee/${u.id}/active`).as('toggleActive')

      cy.get('aside').contains('Lista zaposlenih').click()
      cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
      cy.get('input[name="email"]').clear().type(u.email)
      cy.contains('button', 'Pretraži').click()
      cy.contains(u.email, { timeout: 10_000 }).should('be.visible')
      cy.contains(u.email).closest('tr').click()
      cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')

      cy.contains('● Nalog aktivan').should('be.visible')

      cy.contains('button', 'Deaktiviraj nalog').click()

      cy.wait('@toggleActive', { timeout: 15_000 }).then((i) => {
        expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
      })

      cy.contains('Nalog deaktiviran', { timeout: 8_000 }).should('be.visible')
      cy.contains('● Nalog deaktiviran', { timeout: 6_000 }).should('be.visible')

      cy.contains('button', 'Aktiviraj nalog').click()
      cy.wait('@toggleActive', { timeout: 15_000 })
      cy.contains('Nalog aktiviran', { timeout: 8_000 }).should('be.visible')
    })
  })

  it('S15: admin nalozi su zaštićeni — nema dugmeta za izmenu u listi', () => {
    cy.get('aside').contains('Lista zaposlenih').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees')

    cy.get('input[name="email"]').clear().type(ADMIN_EMAIL)
    cy.contains('button', 'Pretraži').click()
    cy.get('tbody', { timeout: 10_000 }).contains(ADMIN_EMAIL).should('be.visible')

    cy.get('tbody').contains(ADMIN_EMAIL).closest('tr')
      .find('button[title="Izmeni zaposlenog"]').should('not.exist')
    cy.get('tbody').contains(ADMIN_EMAIL).closest('tr')
      .find('button[title="Deaktiviraj nalog"]').should('not.exist')
    cy.get('tbody').contains(ADMIN_EMAIL).closest('tr')
      .should('not.have.class', 'cursor-pointer')
  })
})

export {}
