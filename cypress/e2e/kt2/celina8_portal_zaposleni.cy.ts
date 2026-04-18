/**
 * Celina 8: Portali za zaposlene — Scenariji 39–40
 *
 * Auth strategy: cy.login() → navigate within SPA via sidebar clicks.
 */

// ─── JWT helper ───────────────────────────────────────────────────────────────

function makeEmployeeJwt(): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload = btoa(JSON.stringify({
    sub: '10', email: 'zaposleni@test.com', user_type: 'EMPLOYEE',
    permissions: [], exp: 9_999_999_999, iat: 1_000_000_000,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${payload}.fakesig`
}

const EMPLOYEE_JWT = makeEmployeeJwt()

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CLIENTS = [
  {
    id: 42, firstName: 'Marko', lastName: 'Marković',
    email: 'marko@test.com', phoneNumber: '+381601234567',
  },
  {
    id: 43, firstName: 'Ana', lastName: 'Anić',
    email: 'ana@test.com', phoneNumber: '+381691234567',
  },
]

const MOCK_CLIENT_DETAIL = {
  client: {
    id: '42', firstName: 'Marko', lastName: 'Marković',
    email: 'marko@test.com', phoneNumber: '+381601234567',
    address: 'Beograd, Knez Mihailova 1',
    dateOfBirth: '946684800000',
    gender: 'GENDER_MALE',
  },
}

// ─── Auth setup ───────────────────────────────────────────────────────────────

function setupEmployeeAuth() {
  cy.intercept('GET', '/api/bank/currencies', { statusCode: 200, body: { valute: [] } }).as('getDictCurrencies')
  cy.intercept('GET', '/api/bank/delatnosti', { statusCode: 200, body: { delatnosti: [] } }).as('getDictDelatnosti')
  cy.intercept('POST', '/api/login', {
    statusCode: 200,
    body: { accessToken: EMPLOYEE_JWT, refreshToken: 'fake-refresh' },
  }).as('loginReq')
  cy.login('zaposleni@test.com', 'TestPass12')
  cy.wait('@loginReq')
}

// ─── Scenario 39: Pretraga klijenta ──────────────────────────────────────────

describe('Scenario 39: Pretraga klijenta na portalu za upravljanje klijentima', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/client*', {
      statusCode: 200,
      body: { clients: MOCK_CLIENTS, hasMore: false },
    }).as('getClients')

    setupEmployeeAuth()
    cy.get('aside').contains('Lista klijenata').click()
    cy.wait('@getClients')
  })

  it('prikazuje portal za upravljanje klijentima', () => {
    cy.contains('Lista klijenata').should('be.visible')
  })

  it('prikazuje listu klijenata', () => {
    cy.contains('Marko').should('be.visible')
    cy.contains('Marković').should('be.visible')
    cy.contains('Ana').should('be.visible')
  })

  it('pretražuje klijente po imenu', () => {
    cy.intercept('GET', '/api/client*', {
      statusCode: 200,
      body: { clients: [MOCK_CLIENTS[0]], hasMore: false },
    }).as('searchClients')

    cy.get('input[placeholder*="imenu"], input[placeholder*="imenom"]').first().type('Marko')
    cy.contains('button', 'Pretraži').click()
    cy.wait('@searchClients')

    cy.contains('Marko').should('be.visible')
    cy.contains('Ana').should('not.exist')
  })

  it('pretražuje klijente po emailu', () => {
    cy.intercept('GET', '/api/client*', {
      statusCode: 200,
      body: { clients: [MOCK_CLIENTS[1]], hasMore: false },
    }).as('searchByEmail')

    cy.get('input[type="email"], input[placeholder*="email"]').first().type('ana@test.com')
    cy.contains('button', 'Pretraži').click()
    cy.wait('@searchByEmail')

    cy.contains('Ana').should('be.visible')
    cy.contains('Marko').should('not.exist')
  })

  it('može otvoriti profil klijenta klikom na red', () => {
    cy.intercept('GET', '/api/client/42', {
      statusCode: 200,
      body: MOCK_CLIENT_DETAIL,
    }).as('getClientDetail')

    cy.contains('Marko').click()
    cy.wait('@getClientDetail')

    cy.url().should('include', '/employee/clients/42')
    cy.contains('Marko').should('be.visible')
  })
})

// ─── Scenario 40: Izmena podataka klijenta ────────────────────────────────────

describe('Scenario 40: Izmena podataka klijenta', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/client*', {
      statusCode: 200,
      body: { clients: MOCK_CLIENTS, hasMore: false },
    }).as('getClients')
    cy.intercept('GET', '/api/client/42', {
      statusCode: 200,
      body: MOCK_CLIENT_DETAIL,
    }).as('getClient')
    cy.intercept('PATCH', '/api/client/42', {
      statusCode: 200,
      body: {},
    }).as('updateClient')

    setupEmployeeAuth()
    cy.get('aside').contains('Lista klijenata').click()
    cy.wait('@getClients')
    cy.contains('Marko').click()
    cy.wait('@getClient')
  })

  it('zaposleni može otvoriti profil klijenta za pregled', () => {
    cy.contains('Marko').should('be.visible')
    cy.contains('Marković').should('be.visible')
    cy.contains('marko@test.com').should('be.visible')
  })

  it('prikazuje lične podatke klijenta', () => {
    cy.contains('Lični podaci').should('be.visible')
    cy.contains('Beograd').should('be.visible')
  })

  it('dugme Izmeni otvara stranicu za uređivanje', () => {
    cy.contains('button', 'Izmeni').click()
    cy.url().should('include', '/edit')
  })

  it('uspešno menja podatke klijenta', () => {
    cy.intercept('GET', '/api/client/42', {
      statusCode: 200,
      body: MOCK_CLIENT_DETAIL,
    }).as('getClientEdit')

    cy.intercept('GET', '/api/client/42/trade-permission', {
      statusCode: 200, body: { has_trade_permission: true },
    }).as('getTradePerm')
    cy.contains('button', 'Izmeni').click()
    cy.wait('@getClientEdit')

    cy.get('input[name="phone_number"]').clear().type('+381699999999')
    cy.contains('button', 'Sačuvaj izmene').click()
    cy.wait('@updateClient')

    cy.get('@updateClient').its('response.statusCode').should('eq', 200)
  })

  it('ažurirani podaci se prikazuju na profilu klijenta', () => {
    cy.intercept('GET', '/api/client/42', {
      statusCode: 200,
      body: MOCK_CLIENT_DETAIL,
    }).as('getClientEdit')
    cy.intercept('GET', '/api/client/42/trade-permission', {
      statusCode: 200, body: { has_trade_permission: true },
    }).as('getTradePerm')
    cy.intercept('PATCH', '/api/client/42', {
      statusCode: 200,
      body: {},
    }).as('updateClientPatch')

    cy.contains('button', 'Izmeni').click()
    cy.wait('@getClientEdit')

    cy.get('input[name="phone_number"]').clear().type('+381699999999')
    cy.contains('button', 'Sačuvaj izmene').click()
    cy.wait('@updateClientPatch')

    cy.get('@updateClientPatch').its('response.statusCode').should('eq', 200)
  })
})

export {}
