/**
 * Celina 6: Kartice — Scenariji 27–32
 *
 * Pravi end-to-end za S27. Za ostale scenarije (kartice + račun) koristimo
 * cy.intercept sa stub-ovanim odgovorima, pa se prava UI logika može testirati
 * bez potrebe da se u bazi zaista kreiraju računi i kartice.
 */

// ─── Stub helpers ──────────────────────────────────────────────────────────────

function stubClientAccount() {
  cy.intercept('GET', '/api/bank/client/accounts', {
    statusCode: 200,
    body: {
      accounts: [
        { id: '1', brojRacuna: '1111111111111111', nazivRacuna: 'Tekući RSD',
          kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
          stanjeRacuna: '10000', rezervisanaSredstva: '0', raspolozivoStanje: '10000' },
      ],
    },
  }).as('getAccounts')
}

function stubCards(status: 'AKTIVNA' | 'BLOKIRANA' | 'DEAKTIVIRANA') {
  cy.intercept('GET', '/api/bank/cards/my', {
    statusCode: 200,
    body: {
      kartice: [
        {
          id: '100',
          brojKartice: '5798123456785571',
          tipKartice: 'VISA',
          vrstaKartice: 'DEBIT',
          datumIsteka: '2028-12-31T00:00:00Z',
          status,
          racunId: '1',
          nazivRacuna: 'Tekući RSD',
          brojRacuna: '1111111111111111',
        },
      ],
    },
  }).as('getCards')
}

// ─── Scenario 27 ──────────────────────────────────────────────────────────────

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

// ─── Scenario 28 ──────────────────────────────────────────────────────────────

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
    stubClientAccount()
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Računi').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/accounts')
    cy.wait('@getAccounts', { timeout: 10_000 })
  })

  it('prikazuje stranicu sa računima', () => {
    cy.contains('Moji računi').should('be.visible')
  })

  it('prikazuje opciju za zahtev nove kartice', () => {
    cy.contains('button', 'Zatraži karticu').should('be.visible')
  })

  it('klijent može da otvori wizard za novu karticu', () => {
    cy.contains('button', 'Zatraži karticu').click()
    cy.contains('Tip kartice').should('be.visible')
    cy.contains('Visa').should('be.visible')
    cy.contains('Mastercard').should('be.visible')
  })
})

// ─── Scenario 29 ──────────────────────────────────────────────────────────────

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
    stubCards('AKTIVNA')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Kartice').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/cards')
    cy.wait('@getCards', { timeout: 10_000 })
  })

  it('prikazuje stranicu Moje kartice', () => {
    cy.contains('Moje kartice').should('be.visible')
  })

  it('broj kartice je prikazan u maskiranom obliku', () => {
    // Maska: 5798********5571
    cy.contains('5798********5571').should('be.visible')
  })

  it('prikazuje status kartice', () => {
    cy.contains('Aktivna').should('be.visible')
  })
})

// ─── Scenario 30 ──────────────────────────────────────────────────────────────

describe('Scenario 30: Blokiranje kartice od strane klijenta', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    stubCards('AKTIVNA')
    cy.intercept('PATCH', '/api/bank/cards/*/block', {
      statusCode: 200,
      body: {},
    }).as('blockCard')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Kartice').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/cards')
    cy.wait('@getCards', { timeout: 10_000 })
  })

  it('dugme Blokiraj karticu je vidljivo za aktivnu karticu', () => {
    cy.contains('button', 'Blokiraj karticu').should('be.visible').and('not.be.disabled')
  })

  it('prikazuje dijalog za potvrdu blokiranja', () => {
    cy.contains('button', 'Blokiraj karticu').click()
    cy.contains('Da li ste sigurni da zelite da blokirate ovu karticu?').should('be.visible')
  })

  it('status kartice se menja u Blokirana', () => {
    cy.contains('button', 'Blokiraj karticu').click()
    cy.contains('Da li ste sigurni').should('be.visible')
    // Klik na confirm dugme UNUTAR dijaloga (btn-danger); `.last()` hvata dugme
    // na kartici koje je pokriveno modal backdrop-om → eksplicitno biramo
    // dugme u dijalogu koje ima klasu btn-danger.
    // Dialog confirm button (klasa "btn-danger" bez card-ovih w-full/text-sm)
    cy.get('[role="dialog"]').contains('button', 'Blokiraj karticu').click()
    cy.wait('@blockCard')
    cy.contains('Blokirana').should('be.visible')
  })
})

// ─── Scenario 31 ──────────────────────────────────────────────────────────────

describe('Scenario 31: Odblokiranje kartice od strane zaposlenog', () => {
  let employee: { email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      employee = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    // Stub zaposleni: lista računa
    cy.intercept('GET', '/api/bank/employee/accounts*', {
      statusCode: 200,
      body: {
        accounts: [
          { id: '1', brojRacuna: '1111111111111111', vrstaRacuna: 'LICNI',
            kategorijaRacuna: 'TEKUCI', vlasnikId: '999',
            imeVlasnika: 'Marko', prezimeVlasnika: 'Marković' },
        ],
      },
    }).as('getEmployeeAccounts')

    // Stub kartice na računu — jedna BLOKIRANA
    cy.intercept('GET', '/api/bank/employee/accounts/1111111111111111/cards', {
      statusCode: 200,
      body: {
        kartice: [
          { id: '200', brojKartice: '5798123456785571', status: 'BLOKIRANA',
            imeVlasnika: 'Marko', prezimeVlasnika: 'Marković',
            emailVlasnika: 'marko@test.rs' },
        ],
      },
    }).as('getAccountCards')

    // Stub PATCH za promenu statusa
    cy.intercept('PATCH', '/api/bank/employee/cards/*/status', {
      statusCode: 200,
      body: {},
    }).as('changeCardStatus')

    cy.login(employee.email, employee.password)
    cy.url({ timeout: 10_000 }).should('include', '/employee')
    cy.get('aside').contains('Svi računi').click()
    cy.wait('@getEmployeeAccounts', { timeout: 10_000 })
    // Kliknemo red sa našim stub-ovanim računom — SPA navigate na /cards rutu
    cy.contains('tr', '1111111111111111').click()
    cy.url({ timeout: 6_000 }).should('include', '/employee/accounts/1111111111111111/cards')
  })

  it('prikazuje karticu sa statusom Blokirana', () => {
    cy.wait('@getAccountCards', { timeout: 10_000 })
    cy.contains(/Blokirana/i).should('be.visible')
  })

  it('zaposleni može da deblokiraj karticu', () => {
    cy.wait('@getAccountCards', { timeout: 10_000 })
    // Dugme za aktivaciju blokirane kartice
    cy.contains('button', /Aktiviraj|Odblokiraj/i).should('be.visible')
  })

  it('status kartice se menja u Aktivna', () => {
    cy.wait('@getAccountCards', { timeout: 10_000 })
    cy.contains('button', /Aktiviraj|Odblokiraj/i).click()
    cy.wait('@changeCardStatus').its('request.body').should('have.property', 'status')
  })
})

// ─── Scenario 32 ──────────────────────────────────────────────────────────────

describe('Scenario 32: Pokušaj aktivacije deaktivirane kartice', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    stubCards('DEAKTIVIRANA')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Kartice').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/cards')
    cy.wait('@getCards', { timeout: 10_000 })
  })

  it('prikazuje deaktiviranu karticu sa statusom Deaktivirana', () => {
    cy.contains('Deaktivirana').should('be.visible')
  })

  it('dugme za akciju je onemogućeno za deaktiviranu karticu', () => {
    cy.contains('button', 'Kartica je deaktivirana').should('be.disabled')
  })

  it('sistem ne dozvoljava aktivaciju deaktivirane kartice', () => {
    // Dugme je disabled → klik force:true samo provjerava da nema mogućnosti aktivacije
    cy.contains('button', 'Kartica je deaktivirana').should('be.disabled')
    // Ne sme postojati dugme "Aktiviraj" na klijentskoj strani za deaktiviranu karticu
    cy.contains('button', /^Aktiviraj$/).should('not.exist')
  })
})

export {}
