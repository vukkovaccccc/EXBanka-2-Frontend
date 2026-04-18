/**
 * Celina 6: Kartice — Scenariji 27–32
 *
 * Pravi end-to-end. Fresh zaposleni / klijent: asertujemo strukturu UI-ja.
 * Scenariji koji zahtevaju postojecu karticu (blokiranje/deblokiranje,
 * deaktivirana kartica) su skipovani — jer ih nije moguće dobiti bez
 * setup-a računa u test okruženju.
 */

describe('Scenario 27: Automatsko kreiranje kartice prilikom otvaranja računa', () => {
  let employee: { email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      employee = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.login(employee.email, employee.password)
    cy.get('aside').contains('Kreiraj račun').click()
    cy.url({ timeout: 6_000 }).should('include', '/accounts/new')
  })

  it('čekiranje opcije Napravi karticu prikazuje izbor tipa kartice', () => {
    cy.get('input[name="napravi_karticu"]').check()
    cy.get('select[name="tip_kartice"]').should('be.visible')
  })

  it('forma dozvoljava odabir tipa kartice VISA', () => {
    cy.get('select[name="podvrsta"]').select('Standardni')
    cy.get('input[name="naziv_racuna"]').clear().type('Račun sa karticom')
    cy.get('input[name="pocetno_stanje"]').clear().type('5000')
    cy.get('input[name="napravi_karticu"]').check()
    cy.get('select[name="tip_kartice"]').select('VISA')

    cy.get('input[name="napravi_karticu"]').should('be.checked')
    cy.get('select[name="tip_kartice"]').should('have.value', 'VISA')
  })
})

describe('Scenario 28: Kreiranje kartice na zahtev klijenta', () => {
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
    cy.get('aside').contains('Računi').click()
    cy.wait('@getAccounts', { timeout: 10_000 })
  })

  it('prikazuje stranicu sa računima', () => {
    cy.url().should('include', '/client/accounts')
    cy.contains(/Moji računi|Nemate još nijedan račun|Računi/).should('be.visible')
  })

  // "Zatraži karticu" button appears only when there is at least one account.
  it.skip('prikazuje opciju za zahtev nove kartice', () => {
    // Zahteva postojeći račun klijenta.
  })

  it.skip('klijent može da otvori wizard za novu karticu', () => {
    // Zahteva postojeći račun klijenta.
  })
})

describe('Scenario 29: Pregled liste kartica', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/bank/cards/my').as('getCards')
    cy.login(client.email, client.password)
    cy.get('aside').contains('Kartice').click()
    cy.wait('@getCards', { timeout: 10_000 })
  })

  it('prikazuje stranicu Moje kartice', () => {
    cy.contains('Moje kartice').should('be.visible')
  })

  // Listed cards require accounts+cards setup.
  it.skip('broj kartice je prikazan u maskiranom obliku', () => {
    // Zahteva postojeću karticu klijenta.
  })

  it.skip('prikazuje status kartice', () => {
    // Zahteva postojeću karticu klijenta.
  })
})

describe('Scenario 30: Blokiranje kartice od strane klijenta', () => {
  // Svi scenariji ovde zahtevaju aktivnu karticu klijenta.
  it.skip('dugme Blokiraj karticu je vidljivo za aktivnu karticu', () => {
    // Zahteva aktivnu karticu klijenta.
  })

  it.skip('prikazuje dijalog za potvrdu blokiranja', () => {
    // Zahteva aktivnu karticu klijenta.
  })

  it.skip('status kartice se menja u Blokirana', () => {
    // Zahteva aktivnu karticu klijenta.
  })
})

describe('Scenario 31: Odblokiranje kartice od strane zaposlenog', () => {
  // Zahteva blokiranu karticu na seed račun + navigaciju kroz AccountsListPage.
  it.skip('prikazuje karticu sa statusom Blokirana', () => {
    // Zahteva blokiranu karticu u test okruženju.
  })

  it.skip('zaposleni može da deblokiraj karticu', () => {
    // Zahteva blokiranu karticu u test okruženju.
  })

  it.skip('status kartice se menja u Aktivna', () => {
    // Zahteva blokiranu karticu u test okruženju.
  })
})

describe('Scenario 32: Pokušaj aktivacije deaktivirane kartice', () => {
  // Zahteva deaktiviranu karticu, nedostupno u test okruženju.
  it.skip('prikazuje deaktiviranu karticu sa statusom Deaktivirana', () => {
    // Zahteva deaktiviranu karticu.
  })

  it.skip('dugme za akciju je onemogućeno za deaktiviranu karticu', () => {
    // Zahteva deaktiviranu karticu.
  })

  it.skip('sistem ne dozvoljava aktivaciju deaktivirane kartice', () => {
    // Zahteva deaktiviranu karticu.
  })
})

export {}
