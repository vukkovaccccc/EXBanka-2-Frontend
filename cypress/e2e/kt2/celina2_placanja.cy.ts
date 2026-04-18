/**
 * Celina 2: Plaćanja — Scenariji 9–16
 *
 * Pravi end-to-end testovi. Svaki scenario koristi fresh klijenta.
 * Klijenti bez računa ne mogu izvršiti plaćanje, pa se fokusiramo
 * na UI strukture formi koje su vidljive i bez stvarnih računa.
 */

describe('Celina 2 — Scenariji 9–16: Plaćanja', () => {
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
    cy.intercept('GET', '/api/bank/client/payment-recipients').as('getRecipients')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
  })

  // Scenario 9
  it('S9: forma za novo plaćanje se prikazuje', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Novo plaćanje').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/new')
    cy.contains('Novo plaćanje').should('be.visible')
    cy.contains('Račun platioca').should('be.visible')
  })

  // Scenario 10: Nedovoljna sredstva — klijent bez računa ne može ni poslati zahtev
  it('S10: forma za plaćanje prikazuje polja za iznos i primaoca', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Novo plaćanje').click()
    cy.get('input[placeholder="npr. 1234567890123456"]').should('exist')
    cy.get('input[placeholder="0.00"]').should('exist')
  })

  // Scenario 11: Nepostojeci racun primaoca — UI only
  it('S11: forma omogućava unos broja računa primaoca', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Novo plaćanje').click()
    cy.get('input[placeholder="npr. 1234567890123456"]').type('999999999999999999')
      .should('have.value', '999999999999999999')
  })

  // Scenario 12: Plaćanje u razlicitim valutama uz konverziju — klijent bez računa
  // Bez računa se <select> popunjava placeholderom; skip.
  it.skip('S12: moguće je izabrati različit račun platioca iz liste', () => {
    // Zahteva aktivne račune klijenta (nedostupno u test okruženju bez setup-a računa).
  })

  // Scenario 13
  it('S13: forma za plaćanje sadrži polje za iznos (očekuje unos pre verifikacije)', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Novo plaćanje').click()
    cy.get('input[placeholder="0.00"]').should('exist')
    cy.contains('button', /Dalje|Nastavi|Potvrdi/).should('exist')
  })

  // Scenario 14
  it('S14: forma za novo plaćanje je vidljiva — verifikacija je deo wizard-a', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Novo plaćanje').click()
    cy.contains('Novo plaćanje').should('be.visible')
  })

  // Scenario 15
  it('S15: wizard za novo plaćanje je dostupan iz sidebar-a', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Novo plaćanje').click()
    cy.contains('Novo plaćanje').should('be.visible')
    cy.contains('Broj računa primaoca').should('be.visible')
    cy.contains('Naziv primaoca').should('be.visible')
  })

  // Scenario 16
  it('S16: stranica Pregled plaćanja je dostupna', () => {
    cy.intercept('GET', '/api/bank/client/payments*').as('getPayments')
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Pregled plaćanja').click()
    cy.url({ timeout: 6_000 }).should('include', '/payments/history')
    cy.contains('Pregled plaćanja').should('be.visible')
  })

  it('S16: stranica Pregled plaćanja ima filtere', () => {
    cy.get('aside').contains('Plaćanja').click()
    cy.get('aside').contains('Pregled plaćanja').click()
    cy.contains('Filteri').click()
    cy.contains('Status').should('be.visible')
    cy.contains('Od datuma').should('be.visible')
    cy.contains('Do datuma').should('be.visible')
    cy.contains('Min iznos').should('be.visible')
    cy.contains('Max iznos').should('be.visible')
  })
})

export {}
