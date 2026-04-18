/**
 * Feature 1: Aktivacija naloga — Scenarios 8–10
 *
 * Pravi end-to-end test — bez response stub-ova. Za svaki test kreiramo
 * novog zaposlenog preko admin API-ja, zatim generišemo aktivacioni JWT
 * u browseru (WebCrypto) i prolazimo kroz UI aktivacioni flow.
 */

describe('Feature 1: Aktivacija naloga', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ── Scenario 8: Uspešna aktivacija naloga ─────────────────────────────
  it('S8: zaposleni aktivira nalog validnim tokenom i postavlja lozinku', () => {
    cy.intercept('POST', '/api/activate').as('activateReq')

    const ts = Date.now()
    const email = `aktivacija.s8.${ts}@testbanka.rs`

    cy.getAdminToken().then((adminToken) => {
      cy.request({
        method: 'POST',
        url: '/api/employee',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          email,
          first_name: 'Aktivacija',
          last_name: 'Test',
          birth_date: new Date('1990-06-15').getTime(),
          gender: 1,
          phone_number: '+381601234567',
          address: 'Testna ulica 1',
          username: `akt.s8.${ts}`,
          position: 'Tester',
          department: 'IT',
          is_active: true,
          permissions: [],
          userType: 'USER_TYPE_EMPLOYEE',
        },
      })
    })

    cy.makeActivationJwt(email).then((activationToken) => {
      cy.visit(`/activate?token=${activationToken}`)
      cy.contains('Aktivacija naloga').should('be.visible')

      cy.get('#new-password').type('NovaLozinka12')
      cy.get('#confirm-password').type('NovaLozinka12')

      cy.get('button[type="submit"]').should('not.be.disabled').click()

      cy.wait('@activateReq', { timeout: 15_000 }).then((i) => {
        expect(i.response?.statusCode, 'API vratio 200').to.equal(200)
      })

      cy.url({ timeout: 8_000 }).should('include', '/login')
    })
  })

  // ── Scenario 9: Aktivacija sa nevažećim tokenom ───────────────────────
  it('S9: sistem odbija aktivaciju sa nevažećim tokenom i prikazuje grešku', () => {
    cy.intercept('POST', '/api/activate').as('activateReq')

    // Validni JWT format ali pogrešan potpis
    const bogusJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiJuZS5wb3N0b2ppQGJhbmthLnJzIiwidG9rZW5fdHlwZSI6ImFjdGl2YXRpb24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.' +
      'bogus_signature_xxxxxxxxxxxxxxxxxxxxxx'

    cy.visit(`/activate?token=${bogusJwt}`)
    cy.contains('Aktivacija naloga').should('be.visible')

    cy.get('#new-password').type('ValidLozinka12')
    cy.get('#confirm-password').type('ValidLozinka12')

    cy.get('button[type="submit"]').should('not.be.disabled').click()

    cy.wait('@activateReq', { timeout: 15_000 }).then((i) => {
      expect(i.response?.statusCode).to.not.equal(200)
    })

    cy.contains('Link je nevažeći ili je istekao', { timeout: 8_000 }).should('be.visible')
    cy.url().should('include', '/activate')
  })

  // ── Scenario 10: Klijentska validacija — slaba lozinka ───────────────
  it('S10: sistem ne dozvoljava slabe lozinke — dugme ostaje disabled', () => {
    cy.visit('/activate?token=fake-token-for-client-validation')
    cy.contains('Aktivacija naloga').should('be.visible')

    cy.get('#new-password').type('slaba')
    cy.get('#confirm-password').type('slaba')

    cy.get('[role="alert"]', { timeout: 6_000 }).should('be.visible')
    cy.get('button[type="submit"]').should('be.disabled')
  })
})

export {}
