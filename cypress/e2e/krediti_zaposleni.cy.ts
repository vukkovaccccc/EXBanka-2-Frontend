/**
 * E2E Tests — Krediti (Employee Portal)
 *
 * Auth strategy: intercept POST /api/login to return a fake EMPLOYEE JWT,
 * then use the existing cy.login() command.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployeeJwt(): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload = btoa(JSON.stringify({
    sub:         '10',
    email:       'zaposleni@test.com',
    user_type:   'EMPLOYEE',
    permissions: [],
    exp:         9_999_999_999,
    iat:         1_000_000_000,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${payload}.fakesig`
}

const EMPLOYEE_JWT = makeEmployeeJwt()

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_REQUESTS = [
  {
    id: '1',
    vrstaKredita:     'GOTOVINSKI',
    tipKamate:        'FIKSNA',
    iznos:            500_000,
    valuta:           'RSD',
    svrha:            'Kupovina automobila',
    mesecnaPlata:     100_000,
    statusZaposlenja: 'STALNO',
    periodZaposlenja: 36,
    kontaktTelefon:   '+381601234567',
    brojRacuna:       '111-0000000001-01',
    rokOtplate:       60,
    datumPodnosenja:  '2025-03-10T10:00:00Z',
    status:           'NA_CEKANJU',
  },
  {
    id: '2',
    vrstaKredita:     'STAMBENI',
    tipKamate:        'VARIJABILNA',
    iznos:            8_000_000,
    valuta:           'RSD',
    svrha:            'Kupovina stana',
    mesecnaPlata:     200_000,
    statusZaposlenja: 'STALNO',
    periodZaposlenja: 60,
    kontaktTelefon:   '+381691234567',
    brojRacuna:       '222-0000000002-02',
    rokOtplate:       240,
    datumPodnosenja:  '2025-03-12T08:00:00Z',
    status:           'NA_CEKANJU',
  },
]

const MOCK_CREDITS = [
  {
    id: '10',
    brojKredita:            'KR-2024-00010',
    vrstaKredita:           'GOTOVINSKI',
    brojRacuna:             '111-0000000001-01',
    ukupanIznos:            1_200_000,
    periodOtplate:          60,
    kamatnaStopaOsnovica:   5.75,
    efektivnaKamatnaStoapa: 6.10,
    datumUgovaranja:        '2023-03-15T00:00:00Z',
    datumIsplate:           '2023-03-16T00:00:00Z',
    iznosSledeceRate:       22_500,
    datumSledeceRate:       '2025-04-01T00:00:00Z',
    preostaloDugovanje:     800_000,
    valuta:                 'RSD',
    status:                 'ODOBREN',
    tipKamate:              'FIKSNA',
  },
  {
    id: '11',
    brojKredita:            'KR-2024-00011',
    vrstaKredita:           'STAMBENI',
    brojRacuna:             '222-0000000002-02',
    ukupanIznos:            8_500_000,
    periodOtplate:          240,
    kamatnaStopaOsnovica:   4.75,
    efektivnaKamatnaStoapa: 5.00,
    datumUgovaranja:        '2022-06-01T00:00:00Z',
    datumIsplate:           '2022-06-05T00:00:00Z',
    iznosSledeceRate:       55_000,
    datumSledeceRate:       '2025-04-01T00:00:00Z',
    preostaloDugovanje:     7_200_000,
    valuta:                 'RSD',
    status:                 'U_KASNJENJU',
    tipKamate:              'VARIJABILNA',
  },
]

// ─── Shared auth setup ────────────────────────────────────────────────────────

function setupAuth() {
  cy.intercept('POST', '/api/login', {
    statusCode: 200,
    body: { accessToken: EMPLOYEE_JWT, refreshToken: 'fake-refresh-token' },
  }).as('loginReq')

  cy.login('zaposleni@test.com', 'TestPass12')
  cy.wait('@loginReq')
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Zahtevi za kredit
// ─────────────────────────────────────────────────────────────────────────────

describe('Krediti — Zaposleni: Zahtevi za kredit', () => {

  describe('Test 1a: Lista zahteva', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/employee/credits/requests', {
        statusCode: 200,
        body: { requests: MOCK_REQUESTS },
      }).as('getRequests')

      setupAuth()
      cy.visit('/employee/krediti/zahtevi')
      cy.wait('@getRequests')
    })

    it('prikazuje sve zahteve', () => {
      cy.get('[data-cy="zahtev-card"]').should('have.length', 2)
    })

    it('sortiran po datumu podnošenja — najnoviji prvi', () => {
      // req id=2 datumPodnosenja is newer (March 12) → should appear first
      cy.get('[data-cy="zahtev-racun"]').first().should('contain', '222-0000000002-02')
    })

    it('prikazuje sve podatke zahteva na kartici', () => {
      cy.contains('Gotovinski kredit').should('be.visible')
      cy.contains('Fiksna').should('be.visible')
      cy.contains('500.000,00 RSD').should('be.visible')
      cy.contains('60 mes.').should('be.visible')
      cy.contains('Kupovina automobila').should('be.visible')
    })

    it('prikazuje badge "Na čekanju"', () => {
      cy.get('[data-cy="zahtev-card"]').first().contains('Na čekanju').should('be.visible')
    })
  })

  describe('Test 1b: Filtriranje zahteva', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/employee/credits/requests', {
        statusCode: 200,
        body: { requests: MOCK_REQUESTS },
      }).as('getRequests')

      setupAuth()
      cy.visit('/employee/krediti/zahtevi')
      cy.wait('@getRequests')
    })

    it('filtrira po vrsti kredita', () => {
      cy.get('[data-cy="filter-vrsta"]').select('GOTOVINSKI')
      cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
      cy.contains('Gotovinski kredit').should('be.visible')
    })

    it('filtrira po broju računa', () => {
      cy.get('[data-cy="filter-racun"]').type('111-0000000001')
      cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
      cy.get('[data-cy="zahtev-racun"]').should('contain', '111-0000000001-01')
    })

    it('prikazuje poruku kad nijedan zahtev ne odgovara filteru', () => {
      cy.get('[data-cy="filter-racun"]').type('999-9999999999')
      cy.contains('Nema zahteva koji odgovaraju zadatim filterima').should('be.visible')
    })
  })

  describe('Test 1c: Odobravanje zahteva', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/employee/credits/requests', {
        statusCode: 200,
        body: { requests: MOCK_REQUESTS },
      }).as('getRequests')

      setupAuth()
      cy.visit('/employee/krediti/zahtevi')
      cy.wait('@getRequests')
    })

    it('odobravanje uklanja karticu i prikazuje toast', () => {
      cy.intercept('POST', '/api/v1/employee/credits/requests/2/approve', {
        statusCode: 200,
        body: {},
      }).as('approveReq')

      cy.get('[data-cy="zahtev-card"]').should('have.length', 2)
      cy.get('[data-cy="zahtev-card"]').first().find('[data-cy="odobri-btn"]').click()
      cy.wait('@approveReq')

      cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
      cy.contains('Zahtev za kredit je odobren').should('be.visible')
    })

    it('odbijanje uklanja karticu i prikazuje toast', () => {
      cy.intercept('POST', '/api/v1/employee/credits/requests/2/reject', {
        statusCode: 200,
        body: {},
      }).as('rejectReq')

      cy.get('[data-cy="zahtev-card"]').should('have.length', 2)
      cy.get('[data-cy="zahtev-card"]').first().find('[data-cy="odbij-btn"]').click()
      cy.wait('@rejectReq')

      cy.get('[data-cy="zahtev-card"]').should('have.length', 1)
      cy.contains('Zahtev za kredit je odbijen').should('be.visible')
    })

    it('rollback pri grešci — kartica ostaje vidljiva', () => {
      cy.intercept('POST', '/api/v1/employee/credits/requests/2/approve', {
        statusCode: 500,
        body: { message: 'Internal server error' },
      }).as('approveErr')

      cy.get('[data-cy="zahtev-card"]').first().find('[data-cy="odobri-btn"]').click()
      cy.wait('@approveErr')

      cy.get('[data-cy="zahtev-card"]').should('have.length', 2)
    })
  })

  describe('Test 1d: Prazno stanje', () => {
    it('prikazuje poruku kad nema zahteva', () => {
      cy.intercept('GET', '/api/v1/employee/credits/requests', {
        statusCode: 200,
        body: { requests: [] },
      }).as('getRequests')

      setupAuth()
      cy.visit('/employee/krediti/zahtevi')
      cy.wait('@getRequests')

      cy.contains('Nema zahteva za kredit na čekanju').should('be.visible')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Svi krediti
// ─────────────────────────────────────────────────────────────────────────────

describe('Krediti — Zaposleni: Svi krediti', () => {

  describe('Test 2a: Tabela svih kredita', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/employee/credits', {
        statusCode: 200,
        body: { credits: MOCK_CREDITS },
      }).as('getCredits')

      setupAuth()
      cy.visit('/employee/krediti/svi')
      cy.wait('@getCredits')
    })

    it('prikazuje sve kredite u tabeli', () => {
      cy.get('[data-cy="kredit-row"]').should('have.length', 2)
    })

    it('sortiran po broju računa', () => {
      cy.get('[data-cy="kredit-row"]').first().contains('111-0000000001-01')
    })

    it('prikazuje ispravne podatke u redu', () => {
      cy.contains('Gotovinski').should('be.visible')
      cy.contains('Fiksna').should('be.visible')
      cy.contains('Aktivan').should('be.visible')
    })

    it('prikazuje badge statusa za U kašnjenju', () => {
      cy.contains('U kašnjenju').should('be.visible')
    })

    it('prikazuje ukupan broj u footer-u', () => {
      cy.contains('Prikazano 2 od 2 kredita').should('be.visible')
    })
  })

  describe('Test 2b: Filtriranje kredita', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/employee/credits', {
        statusCode: 200,
        body: { credits: MOCK_CREDITS },
      }).as('getCredits')

      setupAuth()
      cy.visit('/employee/krediti/svi')
      cy.wait('@getCredits')
    })

    it('filtrira po vrsti kredita', () => {
      cy.get('[data-cy="filter-vrsta"]').select('STAMBENI')
      cy.get('[data-cy="kredit-row"]').should('have.length', 1)
      cy.contains('Stambeni').should('be.visible')
    })

    it('filtrira po statusu', () => {
      cy.get('[data-cy="filter-status"]').select('U_KASNJENJU')
      cy.get('[data-cy="kredit-row"]').should('have.length', 1)
      cy.contains('U kašnjenju').should('be.visible')
    })

    it('filtrira po broju računa', () => {
      cy.get('[data-cy="filter-racun"]').type('222-0000000002')
      cy.get('[data-cy="kredit-row"]').should('have.length', 1)
    })

    it('kombinovani filteri — vrsta + status', () => {
      cy.get('[data-cy="filter-vrsta"]').select('GOTOVINSKI')
      cy.get('[data-cy="filter-status"]').select('U_KASNJENJU')
      cy.contains('Nema kredita koji odgovaraju zadatim filterima').should('be.visible')
    })
  })

  describe('Test 2c: Prazno stanje', () => {
    it('prikazuje poruku kad nema kredita', () => {
      cy.intercept('GET', '/api/v1/employee/credits', {
        statusCode: 200,
        body: { credits: [] },
      }).as('getCredits')

      setupAuth()
      cy.visit('/employee/krediti/svi')
      cy.wait('@getCredits')

      cy.contains('Nema evidentiranih kredita u sistemu').should('be.visible')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Varijabilna kamatna stopa modal
// ─────────────────────────────────────────────────────────────────────────────

describe('Krediti — Zaposleni: Varijabilna kamatna stopa', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/v1/employee/credits/requests', {
      statusCode: 200,
      body: { requests: [] },
    }).as('getRequests')

    setupAuth()
    cy.visit('/employee/krediti/zahtevi')
    cy.wait('@getRequests')
  })

  it('otvara modal klikom na dugme', () => {
    cy.get('[data-cy="kamata-btn"]').click()
    cy.contains('Unos varijabilne kamatne stope').should('be.visible')
  })

  it('input odbija slova — ostaje prazan', () => {
    cy.get('[data-cy="kamata-btn"]').click()
    cy.get('[data-cy="stopa-input"]').type('abc')
    cy.get('[data-cy="stopa-input"]').should('have.value', '')
  })

  it('prikazuje validacionu grešku za 0', () => {
    cy.get('[data-cy="kamata-btn"]').click()
    cy.get('[data-cy="stopa-input"]').type('0')
    cy.get('[data-cy="submit-kamata"]').click()
    cy.get('[data-cy="stopa-error"]').should('be.visible')
    cy.contains('mora biti pozitivna').should('be.visible')
  })

  it('prikazuje validacionu grešku za vrednost > 100', () => {
    cy.get('[data-cy="kamata-btn"]').click()
    cy.get('[data-cy="stopa-input"]').type('101')
    cy.get('[data-cy="submit-kamata"]').click()
    cy.get('[data-cy="stopa-error"]').should('be.visible')
    cy.contains('ne može biti veća od 100').should('be.visible')
  })

  it('uspešno ažurira kamatnu stopu i zatvara modal', () => {
    cy.intercept('POST', '/api/v1/employee/credits/variable-rate', {
      statusCode: 200,
      body: {},
    }).as('updateRate')

    cy.get('[data-cy="kamata-btn"]').click()
    cy.get('[data-cy="stopa-input"]').type('5.50')
    cy.get('[data-cy="submit-kamata"]').click()
    cy.wait('@updateRate')

    cy.contains('Varijabilna kamatna stopa je uspešno ažurirana').should('be.visible')
    cy.contains('Unos varijabilne kamatne stope').should('not.exist')
  })

  it('zatvara modal klikom na Otkaži bez slanja zahteva', () => {
    cy.get('[data-cy="kamata-btn"]').click()
    cy.get('[data-cy="stopa-input"]').type('5.50')
    cy.contains('Otkaži').click()
    cy.contains('Unos varijabilne kamatne stope').should('not.exist')
  })
})
