/**
 * Celina 4: Primaoci plaćanja — Scenariji 21–23
 */

describe('Scenariji 21–23: Upravljanje primaocima plaćanja', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/bank/client/payment-recipients').as('getRecipients')
    cy.login(client.email, client.password)
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Primaoci').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/recipients')
    cy.wait('@getRecipients', { timeout: 10_000 })
  })

  it('S21: prikazuje sekciju primalaca plaćanja', () => {
    cy.contains(/Primaoci|Dodaj primaoca/).should('be.visible')
  })

  it('S21: stranica ima dugme "Dodaj primaoca"', () => {
    cy.contains('button', 'Dodaj primaoca').should('be.visible')
  })

  it('S22: dodaje novog primaoca', () => {
    cy.intercept('POST', '/api/bank/client/payment-recipients').as('addRecipient')
    const ts = Date.now()
    const naziv = `Test Primalac ${ts}`
    const broj = `4440000000${String(ts).slice(-8)}`

    cy.contains('button', 'Dodaj primaoca').click()
    cy.get('input[placeholder="npr. Marko Marković"]').type(naziv)
    cy.get('input[placeholder="npr. 1234567890123456"]').type(broj)
    cy.get('input[placeholder="npr. Marko Marković"]').parents('[role="dialog"], .fixed').first()
      .within(() => {
        cy.contains('button', /^Dodaj$/).click()
      })
    cy.wait('@addRecipient', { timeout: 15_000 }).its('response.statusCode').should('eq', 200)
    cy.contains(naziv).should('be.visible')
  })

  it('S23: briše primaoca iz liste', () => {
    cy.intercept('POST', '/api/bank/client/payment-recipients').as('addRecipient')
    cy.intercept('DELETE', '/api/bank/client/payment-recipients/*').as('deleteRecipient')

    const ts = Date.now()
    const naziv = `Za brisanje ${ts}`
    const broj = `4440000000${String(ts).slice(-8)}`

    // Dodaj jednog
    cy.contains('button', 'Dodaj primaoca').click()
    cy.get('input[placeholder="npr. Marko Marković"]').type(naziv)
    cy.get('input[placeholder="npr. 1234567890123456"]').type(broj)
    cy.get('input[placeholder="npr. Marko Marković"]').parents('[role="dialog"], .fixed').first()
      .within(() => {
        cy.contains('button', /^Dodaj$/).click()
      })
    cy.wait('@addRecipient', { timeout: 15_000 })
    cy.contains(naziv, { timeout: 10_000 }).should('be.visible')

    // Obriši ga
    cy.contains(naziv).parent().parent()
      .find('button[title="Obriši"]').click()
    cy.contains('button', 'Obriši').last().click()
    cy.wait('@deleteRecipient', { timeout: 15_000 }).its('response.statusCode').should('eq', 200)
  })
})

export {}
