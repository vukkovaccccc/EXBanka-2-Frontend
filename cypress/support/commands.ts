// Custom Cypress commands
/* eslint-disable @typescript-eslint/no-namespace -- Cypress typings use namespace merging */

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').should('not.be.disabled').click()
})

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Cypress.Chainable<void>
    }
  }
}

export {}
