/**
 * Feature: Permisije zaposlenih — Scenarios 16, 17, 18
 *
 * Pravi end-to-end test — bez response stub-ova.
 */

import { ADMIN_EMAIL, ADMIN_PASS } from '../../../support/commands'

describe('Scenariji 16–18: Permisije zaposlenih', () => {
  let target: { id: string; email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      target = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('S16: zaposleni ne može pristupiti admin delu — preusmerava se na svoju početnu', () => {
    cy.login(target.email, target.password)
    cy.url({ timeout: 10_000 }).should('include', '/employee')

    cy.visit('/admin/employees')
    cy.url({ timeout: 8_000 }).should('not.include', '/admin/employees')
  })

  it('S17: admin dodeljuje permisiju VIEW_ACCOUNTS zaposlenom', () => {
    cy.intercept('PUT', '**/api/employee/*').as('updateEmployee')

    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')

    cy.get('aside').contains('Lista zaposlenih').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees')
    cy.get('input[name="email"]').clear().type(target.email)
    cy.contains('button', 'Pretraži').click()
    cy.get('tbody', { timeout: 10_000 }).contains(target.email).should('be.visible')
    cy.get('tbody').contains(target.email).closest('tr').click()
    cy.contains('Izmena:', { timeout: 8_000 }).should('be.visible')

    // Fresh account ne mora imati adresu/pol; forma inače ne šalje PUT
    cy.get('input[name="address"]').then(($a) => {
      if (!(($a.val() as string) ?? '').trim()) cy.wrap($a).clear().type('Adresa za E2E')
    })
    cy.get('select[name="gender"]').then(($s) => {
      if (!$s.val()) cy.wrap($s).select('MALE')
    })

    cy.contains('label', /Pregled računa|VIEW_ACCOUNTS/).click()
    cy.contains('button', 'Sačuvaj izmene').click()

    cy.wait('@updateEmployee', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
    })

    cy.contains('Izmene uspješno sačuvane', { timeout: 8_000 }).should('be.visible')

    // Verify via API
    cy.getAdminToken().then((adminToken) => {
      cy.request({
        method: 'GET',
        url: `/api/employee/${target.id}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((resp) => {
        const permissions: string[] = resp.body.employee?.permissions ?? []
        expect(permissions).to.include('VIEW_ACCOUNTS')
      })
    })
  })

  it('S18: admin kreira zaposlenog bez permisija — nalog nema permisije', () => {
    cy.intercept('POST', '/api/employee').as('createEmployee')

    const ts = Date.now()
    const email = `bez.permisija.${ts}@testbanka.rs`

    cy.login(ADMIN_EMAIL, ADMIN_PASS)
    cy.url({ timeout: 10_000 }).should('include', '/admin')
    cy.get('aside').contains('Novi zaposleni').click()
    cy.url({ timeout: 6_000 }).should('include', '/admin/employees/new')

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

    cy.get('input[type="checkbox"]').not('[name="is_active"]').each(($cb) => {
      cy.wrap($cb).should('not.be.checked')
    })

    cy.contains('button', 'Kreiraj zaposlenog').click()

    cy.wait('@createEmployee', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
      const empId = String(i.response?.body.id)

      cy.getAdminToken().then((adminToken) => {
        cy.request({
          method: 'GET',
          url: `/api/employee/${empId}`,
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((resp) => {
          const permissions: string[] = resp.body.employee?.permissions ?? []
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(permissions, 'novi zaposleni nema permisije').to.be.empty
        })
      })
    })

    cy.contains('Zaposleni uspješno kreiran', { timeout: 8_000 }).should('be.visible')
  })
})

export {}
