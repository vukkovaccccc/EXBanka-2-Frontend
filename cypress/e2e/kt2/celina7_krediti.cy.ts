/**
 * Celina 7: Krediti — Scenariji 33–38
 *
 * Pravi UI flow-ovi sa cy.intercept stub-ovanim odgovorima, pa se logika
 * može testirati bez potrebe da se u bazi zaista kreiraju krediti.
 */

// ─── Stub helpers ──────────────────────────────────────────────────────────────

function stubClientAccount() {
  cy.intercept('GET', '/api/bank/client/accounts', {
    statusCode: 200,
    body: {
      accounts: [
        {
          id: '1',
          brojRacuna: '1111111111111111',
          nazivRacuna: 'Tekući RSD',
          kategorijaRacuna: 'TEKUCI',
          vrstaRacuna: 'LICNI',
          valutaOznaka: 'RSD',
          stanjeRacuna: '100000',
          rezervisanaSredstva: '0',
          raspolozivoStanje: '100000',
        },
      ],
    },
  }).as('getAccounts')
}

function stubCurrencies() {
  cy.intercept('GET', '/api/bank/currencies', {
    statusCode: 200,
    body: {
      valute: [
        { id: '1', naziv: 'Srpski dinar', oznaka: 'RSD' },
        { id: '2', naziv: 'Euro', oznaka: 'EUR' },
      ],
    },
  }).as('getCurrencies')
}

// ─── Scenario 33 ──────────────────────────────────────────────────────────────

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
    cy.intercept('GET', '/api/v1/client/credits', {
      statusCode: 200,
      body: { krediti: [] },
    }).as('getCredits')
    cy.login(client.email, client.password)
    cy.get('aside').contains('Krediti').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits')
  })

  it('prikazuje stranicu Moji krediti', () => {
    cy.contains('Moji krediti').should('be.visible')
  })

  it('uspešno podnosi zahtev za kredit', () => {
    stubClientAccount()
    stubCurrencies()
    cy.intercept('POST', '/api/v1/client/credits', {
      statusCode: 200,
      body: { id: '999' },
    }).as('applyForCredit')

    // SPA navigation (cy.visit reloads page and loses in-memory access token)
    cy.contains('button', /Zahtev za kredit|Podnesi zahtev/).click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits/new')
    cy.wait('@getAccounts')
    cy.wait('@getCurrencies')

    // Vrsta kredita
    cy.get('#vrsta_kredita').select('GOTOVINSKI')
    // Tip kamate
    cy.get('#tip_kamate').select('FIKSNA')
    // Iznos
    cy.get('input[name="iznos"]').type('500000')
    // Valuta
    cy.get('#valuta').select('RSD')
    // Rok otplate
    cy.get('#rok_otplate').select('36')
    // Svrha
    cy.get('input[name="svrha"]').type('Renoviranje stana')
    // Mesečna plata
    cy.get('input[name="mesecna_plata"]').type('80000')
    // Status zaposlenja
    cy.get('#status_zaposlenja').select('STALNO')
    // Period zaposlenja
    cy.get('input[name="period_zaposlenja"]').type('24')
    // Kontakt telefon
    cy.get('input[name="kontakt_telefon"]').type('+381601234567')
    // Račun (match currency RSD)
    cy.get('#broj_racuna').select('1111111111111111')

    cy.get('[data-cy="submit-zahtev"]').click()
    cy.wait('@applyForCredit').its('request.body').should('include', {
      vrsta_kredita: 'GOTOVINSKI',
      broj_racuna: '1111111111111111',
    })
    cy.contains('Zahtev je uspešno podnet!').should('be.visible')
  })
})

// ─── Scenario 34 ──────────────────────────────────────────────────────────────

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
  })

  it('prikazuje sekciju Moji krediti', () => {
    cy.intercept('GET', '/api/v1/client/credits', {
      statusCode: 200,
      body: { krediti: [] },
    }).as('getCreditsEmpty')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Krediti').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits')
    cy.wait('@getCreditsEmpty')
    cy.contains('Moji krediti').should('be.visible')
  })

  it('krediti su sortirani po ukupnom iznosu — veći iznos prvi', () => {
    cy.intercept('GET', '/api/v1/client/credits', {
      statusCode: 200,
      body: {
        krediti: [
          {
            id: '1',
            brojKredita: 'KR-001',
            vrstaKredita: 'GOTOVINSKI',
            brojRacuna: '1111111111111111',
            iznosKredita: '300000',
            periodOtplate: 36,
            nominalnaKamatnaStopa: '8.5',
            efektivnaKamatnaStopa: '9.1',
            datumUgovaranja: '2025-01-15T00:00:00Z',
            datumIsplate: '2025-01-20T00:00:00Z',
            iznosMesecneRate: '10000',
            datumSledeceRate: '2026-05-20T00:00:00Z',
            preostaloDugovanje: '200000',
            valuta: 'RSD',
            status: 'ODOBREN',
            tipKamate: 'FIKSNA',
          },
          {
            id: '2',
            brojKredita: 'KR-002',
            vrstaKredita: 'STAMBENI',
            brojRacuna: '2222222222222222',
            iznosKredita: '1500000',
            periodOtplate: 120,
            nominalnaKamatnaStopa: '5.5',
            efektivnaKamatnaStopa: '5.9',
            datumUgovaranja: '2024-06-01T00:00:00Z',
            datumIsplate: '2024-06-10T00:00:00Z',
            iznosMesecneRate: '20000',
            datumSledeceRate: '2026-05-10T00:00:00Z',
            preostaloDugovanje: '1200000',
            valuta: 'RSD',
            status: 'ODOBREN',
            tipKamate: 'FIKSNA',
          },
        ],
      },
    }).as('getCreditsSorted')

    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Krediti').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits')
    cy.wait('@getCreditsSorted')

    // Očekujemo dva 'kredit-card' elementa
    cy.get('[data-cy="kredit-card"]').should('have.length', 2)
    // Prvi kredit u listi treba da bude STAMBENI (veći iznos)
    cy.get('[data-cy="kredit-card"]').first().should('contain', 'Stambeni')
    cy.get('[data-cy="kredit-card"]').last().should('contain', 'Gotovinski')
  })
})

// ─── Scenario 35 ──────────────────────────────────────────────────────────────

describe('Scenario 35: Odobravanje kredita od strane zaposlenog', () => {
  let employee: { email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      employee = u
    })
  })

  function stubRequests() {
    cy.intercept('GET', '/api/v1/employee/credits/requests', {
      statusCode: 200,
      body: {
        zahtevi: [
          {
            id: '501',
            vrstaKredita: 'GOTOVINSKI',
            tipKamate: 'FIKSNA',
            iznosKredita: '400000',
            valuta: 'RSD',
            svrhaKredita: 'Renoviranje',
            iznosMesecnePlate: '90000',
            statusZaposlenja: 'STALNO',
            periodZaposlenja: 36,
            kontaktTelefon: '+381601111111',
            brojRacuna: '1111111111111111',
            rokOtplate: 36,
            datumPodnosenja: '2026-04-10T00:00:00Z',
            status: 'NA_CEKANJU',
          },
        ],
      },
    }).as('getRequests')
  }

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    stubRequests()
    cy.intercept('POST', '/api/v1/employee/credits/requests/*/approve', {
      statusCode: 200,
      body: {},
    }).as('approveCredit')
    cy.login(employee.email, employee.password)
    cy.get('aside').contains('Zahtevi za kredit').click()
    cy.url({ timeout: 6_000 }).should('include', '/employee/credits/requests')
    cy.wait('@getRequests')
  })

  it('prikazuje stranicu Zahtevi za kredit', () => {
    cy.contains('Zahtevi za kredit').should('be.visible')
  })

  it('zaposleni odobrava kredit', () => {
    cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
    cy.get('[data-cy="odobri-btn"]').click()
    cy.wait('@approveCredit')
    // Optimistic update — kartica nestaje iz liste
    cy.get('[data-cy="zahtev-card"]').should('have.length', 0)
  })

  it('kredit dobija status Odobren (zahtev uklonjen iz liste)', () => {
    cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
    cy.get('[data-cy="odobri-btn"]').click()
    cy.wait('@approveCredit').its('request.url').should('include', '/approve')
    cy.contains('Zahtev za kredit je odobren.').should('be.visible')
  })
})

// ─── Scenario 36 ──────────────────────────────────────────────────────────────

describe('Scenario 36: Odbijanje zahteva za kredit', () => {
  let employee: { email: string; password: string }

  before(() => {
    cy.createActivatedEmployee().then((u) => {
      employee = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/v1/employee/credits/requests', {
      statusCode: 200,
      body: {
        zahtevi: [
          {
            id: '601',
            vrstaKredita: 'AUTO',
            tipKamate: 'VARIJABILNA',
            iznosKredita: '800000',
            valuta: 'RSD',
            svrhaKredita: 'Kupovina automobila',
            iznosMesecnePlate: '60000',
            statusZaposlenja: 'PRIVREMENO',
            periodZaposlenja: 6,
            kontaktTelefon: '+381602222222',
            brojRacuna: '3333333333333333',
            rokOtplate: 48,
            datumPodnosenja: '2026-04-12T00:00:00Z',
            status: 'NA_CEKANJU',
          },
        ],
      },
    }).as('getRequests')
    cy.intercept('POST', '/api/v1/employee/credits/requests/*/reject', {
      statusCode: 200,
      body: {},
    }).as('rejectCredit')
    cy.login(employee.email, employee.password)
    cy.url({ timeout: 10_000 }).should('include', '/employee')
    cy.get('aside').contains('Zahtevi za kredit').click()
    cy.url({ timeout: 6_000 }).should('include', '/employee/credits/requests')
    cy.wait('@getRequests')
  })

  it('zaposleni odbija zahtev za kredit', () => {
    cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
    cy.get('[data-cy="odbij-btn"]').click()
    cy.wait('@rejectCredit').its('request.url').should('include', '/reject')
  })

  it('kredit dobija status Odbijen — kartica nestaje iz liste', () => {
    cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
    cy.get('[data-cy="odbij-btn"]').click()
    cy.wait('@rejectCredit')
    cy.get('[data-cy="zahtev-card"]').should('have.length', 0)
    cy.contains('Zahtev za kredit je odbijen.').should('be.visible')
  })
})

// ─── Scenario 37 ──────────────────────────────────────────────────────────────

describe('Scenario 37: Automatsko skidanje rate kredita (UI stanje)', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/v1/client/credits', {
      statusCode: 200,
      body: {
        krediti: [
          {
            id: '700',
            brojKredita: 'KR-700',
            vrstaKredita: 'GOTOVINSKI',
            brojRacuna: '1111111111111111',
            iznosKredita: '500000',
            periodOtplate: 36,
            nominalnaKamatnaStopa: '8.0',
            efektivnaKamatnaStopa: '8.5',
            datumUgovaranja: '2025-01-15T00:00:00Z',
            datumIsplate: '2025-01-20T00:00:00Z',
            iznosMesecneRate: '15500',
            datumSledeceRate: '2026-05-15T00:00:00Z',
            preostaloDugovanje: '420000',
            valuta: 'RSD',
            status: 'ODOBREN',
            tipKamate: 'FIKSNA',
          },
        ],
      },
    }).as('getCredits')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Krediti').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits')
    cy.wait('@getCredits')
  })

  it('prikazuje aktivne kredite sa datumom sledeće rate', () => {
    cy.get('[data-cy="kredit-card"]').should('have.length', 1)
    cy.contains('Sledeća rata').should('be.visible')
    cy.contains('15.05.2026').should('be.visible')
  })

  it('sistem prikazuje iznos sledeće rate', () => {
    // Iznos 15500 RSD → "15.500,00 RSD" formatirano srpski
    cy.get('[data-cy="kredit-card"]').should('contain', 'RSD')
    cy.get('[data-cy="kredit-card"]').should('contain', '15.500,00')
  })
})

// ─── Scenario 38 ──────────────────────────────────────────────────────────────

describe('Scenario 38: Kašnjenje u otplati kredita', () => {
  let client: { email: string; password: string }

  before(() => {
    cy.createActivatedClient().then((u) => {
      client = u
    })
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.intercept('GET', '/api/v1/client/credits', {
      statusCode: 200,
      body: {
        krediti: [
          {
            id: '800',
            brojKredita: 'KR-800',
            vrstaKredita: 'GOTOVINSKI',
            brojRacuna: '1111111111111111',
            iznosKredita: '200000',
            periodOtplate: 24,
            nominalnaKamatnaStopa: '9.0',
            efektivnaKamatnaStopa: '9.5',
            datumUgovaranja: '2024-06-01T00:00:00Z',
            datumIsplate: '2024-06-10T00:00:00Z',
            iznosMesecneRate: '9500',
            datumSledeceRate: '2026-03-10T00:00:00Z',
            preostaloDugovanje: '85000',
            valuta: 'RSD',
            status: 'U_KASNJENJU',
            tipKamate: 'FIKSNA',
          },
        ],
      },
    }).as('getCredits')
    cy.login(client.email, client.password)
    cy.url({ timeout: 10_000 }).should('include', '/client')
    cy.get('aside').contains('Krediti').click()
    cy.url({ timeout: 6_000 }).should('include', '/client/credits')
    cy.wait('@getCredits')
  })

  it('kredit sa statusom U kašnjenju se prikazuje', () => {
    cy.get('[data-cy="kredit-card"]').should('have.length', 1)
  })

  it('prikazuje badge "U kašnjenju"', () => {
    cy.contains('U kašnjenju').should('be.visible')
  })
})

export {}
