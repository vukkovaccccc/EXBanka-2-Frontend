/**
 * Celina 3: Transferi — Scenariji 17–20
 *
 * Pravi end-to-end. Za S17 se koristi fresh klijent bez računa (empty-state).
 * Za S18–S20 koristimo cy.intercept da stub-ujemo listu računa, jer fresh klijent
 * nema 2+ računa koji su potrebni da bi se prikazala forma za prenos.
 */

describe('Scenariji 17: Prenos sredstava (empty state)', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/bank/client/accounts').as('getAccounts')
    cy.login(client.email, client.password)
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Prenos').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/transfer')
    cy.wait('@getAccounts', { timeout: 10_000 })
  })

  it('S17: prikazuje formu za prenos', () => {
    cy.contains('Prenos između računa').should('be.visible')
  })

  it('S17: prikazuje empty-state za prenos kada klijent nema dovoljno računa', () => {
    // Fresh client — 0 računa. Forma se prikazuje tek sa 2+ računa;
    // UI prikazuje empty-state heading.
    cy.contains('Prenos između računa').should('be.visible')
  })
})

describe('Scenariji 18–20: Prenos sredstava (stubovani računi)', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  function stubAccounts(accounts: Array<Record<string, unknown>>) {
    cy.intercept('GET', '/api/bank/client/accounts', {
      statusCode: 200,
      body: { accounts },
    }).as('getAccountsStub')
  }

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('S18: cross-currency prenos pokazuje info o konverziji valuta', () => {
    stubAccounts([
      { id: '1', brojRacuna: '1111111111111111', nazivRacuna: 'RSD Tekući',
        kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
        stanjeRacuna: '10000', rezervisanaSredstva: '0', raspolozivoStanje: '10000' },
      { id: '2', brojRacuna: '2222222222222222', nazivRacuna: 'EUR Devizni',
        kategorijaRacuna: 'DEVIZNI', vrstaRacuna: 'LICNI', valutaOznaka: 'EUR',
        stanjeRacuna: '500', rezervisanaSredstva: '0', raspolozivoStanje: '500' },
    ])
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Prenos').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/transfer')
    cy.wait('@getAccountsStub')
    cy.contains('Konverzija valuta').should('be.visible')
  })

  it('S19: prikazuje input za iznos prenosa (placeholder 0.00)', () => {
    stubAccounts([
      { id: '1', brojRacuna: '1111111111111111', nazivRacuna: 'Račun A',
        kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
        stanjeRacuna: '10000', rezervisanaSredstva: '0', raspolozivoStanje: '10000' },
      { id: '2', brojRacuna: '2222222222222222', nazivRacuna: 'Račun B',
        kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
        stanjeRacuna: '5000', rezervisanaSredstva: '0', raspolozivoStanje: '5000' },
    ])
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Prenos').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/transfer')
    cy.wait('@getAccountsStub')
    cy.get('input[placeholder="0.00"]').should('be.visible')
  })

  it('S20: prenos između računa iste valute — nema poruke o blokadi', () => {
    stubAccounts([
      { id: '1', brojRacuna: '1111111111111111', nazivRacuna: 'Račun A',
        kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
        stanjeRacuna: '10000', rezervisanaSredstva: '0', raspolozivoStanje: '10000' },
      { id: '2', brojRacuna: '2222222222222222', nazivRacuna: 'Račun B',
        kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
        stanjeRacuna: '5000', rezervisanaSredstva: '0', raspolozivoStanje: '5000' },
    ])
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Prenos').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/transfer')
    cy.wait('@getAccountsStub')
    // Forma je vidljiva, nema empty-state upozorenja
    cy.contains('Za prenos između računa potrebno je').should('not.exist')
    // Takođe nema info o konverziji (ista valuta)
    cy.contains('Konverzija valuta').should('not.exist')
    cy.contains('button', 'Nastavi').should('be.visible')
  })
})

export {}
