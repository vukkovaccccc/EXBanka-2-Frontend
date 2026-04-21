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

  // Stub-ujemo EUR i RSD račune + intent/verify endpoint-e da pokrijemo pravi flow.
  // Napomena: cy.visit nakon login-a bi resetovao in-memory access token, pa
  // koristimo SPA navigaciju preko sidebar-a (isto kao beforeEach, samo sa stub-om
  // postavljenim pre navigacije).
  it('izvršava konverziju EUR→RSD i prikazuje potvrdu', () => {
    cy.intercept('GET', '/api/bank/client/accounts', {
      statusCode: 200,
      body: {
        accounts: [
          { id: '10', brojRacuna: '1010101010101010', nazivRacuna: 'EUR Devizni',
            kategorijaRacuna: 'DEVIZNI', vrstaRacuna: 'LICNI', valutaOznaka: 'EUR',
            stanjeRacuna: '1000', rezervisanaSredstva: '0', raspolozivoStanje: '1000' },
          { id: '20', brojRacuna: '2020202020202020', nazivRacuna: 'RSD Tekući',
            kategorijaRacuna: 'TEKUCI', vrstaRacuna: 'LICNI', valutaOznaka: 'RSD',
            stanjeRacuna: '500', rezervisanaSredstva: '0', raspolozivoStanje: '500' },
        ],
      },
    }).as('stubAccounts')

    cy.intercept('POST', '/api/bank/client/exchange-transfers', {
      statusCode: 200,
      body: {
        intentId: '777',
        actionId: '888',
        brojNaloga: 'NAL-777',
        status: 'U_OBRADI',
      },
    }).as('createIntent')

    cy.intercept('POST', '/api/bank/client/payments/777/verify', {
      statusCode: 200,
      body: {
        id: '777',
        idempotencyKey: 'abc',
        brojNaloga: 'NAL-777',
        tipTransakcije: 'PRENOS',
        brojRacunaPlatioca: '1010101010101010',
        brojRacunaPrimaoca: '2020202020202020',
        nazivPrimaoca: 'Sam za sebe',
        iznos: '100',
        krajnjiIznos: '11700',
        provizija: '0',
        valuta: 'EUR',
        sifraPlacanja: '',
        pozivNaBroj: '',
        svrhaPlacanja: 'Konverzija EUR → RSD',
        status: 'REALIZOVANO',
        createdAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        failedReason: '',
      },
    }).as('verifyIntent')

    // beforeEach već prijavi klijenta i otvori tab "Proveri ekvivalentnost".
    // Remount-ujemo tab (prvo Kursna lista, pa natrag) da bi stub za accounts
    // bio aktivan pri novom useEffect mount-u.
    cy.contains('Kursna lista').click()
    cy.contains('Proveri ekvivalentnost').click()
    cy.wait('@stubAccounts')

    // Unos iznosa + izbor source/target računa
    cy.get('select').first().select('EUR')  // Iz valute
    // "U valutu" select je drugi — default je RSD
    cy.get('input[inputMode="decimal"]').clear().type('100')
    cy.contains('Dobijate', { timeout: 5_000 }).should('be.visible')

    cy.get('[data-testid="source-account-select"]', { timeout: 5_000 }).select('10')
    cy.get('[data-testid="target-account-select"]').select('20')

    cy.get('[data-testid="execute-button"]').should('not.be.disabled').click()

    // Confirm korak
    cy.contains('Potvrdi konverziju').should('be.visible')
    cy.contains('button', 'Izvrši konverziju').click()
    cy.wait('@createIntent')

    // Verify korak — unesi kod
    cy.contains('Verifikacija konverzije').should('be.visible')
    cy.get('input[maxlength="6"]').type('123456')
    cy.contains('button', 'Potvrdi').click()
    cy.wait('@verifyIntent')

    // Done
    cy.contains('Konverzija izvršena').should('be.visible')
  })
})

export {}
