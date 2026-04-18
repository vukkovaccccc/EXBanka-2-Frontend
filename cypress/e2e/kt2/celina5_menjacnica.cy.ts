/**
 * Celina 5: Menjačnica — Scenariji 24–26
 *
 * Pravi end-to-end. Fresh klijent bez računa: testovi asertuju kursnu listu
 * (valute iz backenda) i strukturu kalkulatora. Konverzija sa izvršenjem nije
 * moguća bez aktivnih računa → skip.
 */

describe('Scenario 24: Pregled kursne liste', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/bank/currencies').as('getCurrencies')
    cy.login(client.email, client.password)
    cy.get('aside').contains('Menjačnica').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/exchange')
    cy.wait('@getCurrencies', { timeout: 10_000 })
  })

  it('prikazuje sekciju Kursna lista', () => {
    cy.contains('Kursna lista').should('be.visible')
  })

  it('prikazuje RSD kao baznu valutu', () => {
    cy.contains('Srpski dinar').should('be.visible')
    cy.contains('bazna valuta').should('be.visible')
  })

  it('prikazuje podržane valute (EUR, CHF, USD, GBP, JPY, CAD, AUD)', () => {
    cy.contains('EUR').should('be.visible')
    cy.contains('USD').should('be.visible')
    cy.contains('GBP').should('be.visible')
    cy.contains('CHF').should('be.visible')
    cy.contains('JPY').should('be.visible')
    cy.contains('CAD').should('be.visible')
    cy.contains('AUD').should('be.visible')
  })
})

describe('Scenario 25: Provera ekvivalentnosti valute', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(client.email, client.password)
    cy.get('aside').contains('Menjačnica').click()
    cy.contains('Proveri ekvivalentnost').click()
  })

  it('prikazuje kalkulator za konverziju valuta', () => {
    cy.contains('Iz valute').should('be.visible')
    cy.contains('U valutu').should('be.visible')
  })

  it('sistem izračunava ekvivalentnu vrednost bez transakcije', () => {
    cy.get('input[inputMode="decimal"]').type('100')
    cy.contains('Dobijate', { timeout: 5_000 }).should('be.visible')
  })

  it('prikazuje rezultat konverzije', () => {
    cy.get('input[inputMode="decimal"]').type('100')
    cy.contains('Dobijate', { timeout: 5_000 }).should('be.visible')
  })

  it('dugme za izvršenje je disabled bez unosa iznosa', () => {
    cy.get('[data-testid="execute-button"]').should('be.disabled')
  })
})

describe('Scenario 26: Konverzija valute tokom transfera iz menjačnice', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(client.email, client.password)
    cy.get('aside').contains('Menjačnica').click()
    cy.contains('Proveri ekvivalentnost').click()
  })

  it('prikazuje sekciju za izvršenje konverzije', () => {
    cy.contains('Izvrši konverziju').should('be.visible')
  })

  it('dugme za izvršenje je disabled bez selektovanog računa', () => {
    cy.get('input[inputMode="decimal"]').type('100')
    cy.get('[data-testid="execute-button"]').should('be.disabled')
  })

  // Requires at least one EUR account and one RSD account — skip.
  it.skip('izvršava konverziju EUR→RSD i prikazuje potvrdu', () => {
    // Zahteva aktivne EUR i RSD račune (nedostupno u test okruženju).
  })
})

export {}
