/**
 * Celina 7: Krediti — Scenariji 33–38
 *
 * Pravi end-to-end. Podnošenje zahteva zahteva aktivan račun klijenta,
 * te su operacije koje izmenu stanje kredita (approve/reject, automatska rata,
 * kašnjenje) skipovane.
 */

describe('Scenario 33: Podnošenje zahteva za kredit', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/v1/client/credits').as('getCredits')
    cy.login(client.email, client.password)
    cy.get('aside').contains('Krediti').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits')
  })

  it('prikazuje stranicu Moji krediti', () => {
    cy.contains('Moji krediti').should('be.visible')
  })

  // Form submit requires an existing account and successful backend credit request
  // path. Skipped because the fresh client has no account.
  it.skip('uspešno podnosi zahtev za kredit', () => {
    // Zahteva aktivan račun klijenta radi slanja zahteva za kredit.
  })
})

describe('Scenario 34: Pregled kredita klijenta', () => {
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
    cy.get('aside').contains('Krediti').click()
  })

  it('prikazuje sekciju Moji krediti', () => {
    cy.contains('Moji krediti').should('be.visible')
  })

  it.skip('krediti su sortirani po ukupnom iznosu — veći iznos prvi', () => {
    // Zahteva bar 2 odobrena kredita (nedostupno u test okruženju).
  })
})

describe('Scenario 35: Odobravanje kredita od strane zaposlenog', () => {
  let employee: { email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      employee = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/v1/employee/credits/requests').as('getRequests')
    cy.login(employee.email, employee.password)
    cy.get('aside').contains('Zahtevi za kredit').click()
    cy.url({ timeout: 6_000 }).should('include', '/employee/credits/requests')
  })

  it('prikazuje stranicu Zahtevi za kredit', () => {
    cy.contains('Zahtevi za kredit').should('be.visible')
  })

  it.skip('zaposleni odobrava kredit', () => {
    // Zahteva postojeći zahtev za kredit u bazi.
  })

  it.skip('kredit dobija status Odobren', () => {
    // Zahteva postojeći zahtev za kredit.
  })
})

describe('Scenario 36: Odbijanje zahteva za kredit', () => {
  it.skip('zaposleni odbija zahtev za kredit', () => {
    // Zahteva postojeći zahtev za kredit u bazi.
  })

  it.skip('kredit dobija status Odbijen — kartica nestaje iz liste', () => {
    // Zahteva postojeći zahtev za kredit u bazi.
  })
})

describe('Scenario 37: Automatsko skidanje rate kredita (UI stanje)', () => {
  it.skip('prikazuje aktivne kredite sa datumom sledeće rate', () => {
    // Zahteva aktivan kredit sa sledećom ratom.
  })

  it.skip('sistema prikazuje iznos sledeće rate', () => {
    // Zahteva aktivan kredit.
  })
})

describe('Scenario 38: Kašnjenje u otplati kredita', () => {
  it.skip('kredit sa statusom U kašnjenju se prikazuje', () => {
    // Zahteva kredit u statusu U_KASNJENJU.
  })

  it.skip('prikazuje badge "U kašnjenju"', () => {
    // Zahteva kredit u statusu U_KASNJENJU.
  })
})

export {}
