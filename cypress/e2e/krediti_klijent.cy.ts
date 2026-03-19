/**
 * E2E Tests — Krediti (Client Portal)
 *
 * Auth strategy: intercept POST /api/login to return a fake CLIENT JWT,
 * then use the existing cy.login() command. jwt-decode only decodes the
 * base64 payload; it does not verify signatures.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClientJwt(): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload = btoa(JSON.stringify({
    sub:         '42',
    email:       'klijent@test.com',
    user_type:   'CLIENT',
    permissions: [],
    exp:         9_999_999_999,
    iat:         1_000_000_000,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${payload}.fakesig`
}

const CLIENT_JWT = makeClientJwt()

const MOCK_CREDITS = [
  {
    id: '1',
    brojKredita:            'KR-2024-00001',
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
    id: '2',
    brojKredita:            'KR-2024-00002',
    vrstaKredita:           'STAMBENI',
    brojRacuna:             '111-0000000001-01',
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
    status:                 'ODOBREN',
    tipKamate:              'VARIJABILNA',
  },
]

const MOCK_CREDIT_DETAIL = {
  ...MOCK_CREDITS[0],
  rate: [
    {
      id: '101',
      brojKredita:           'KR-2024-00001',
      iznosRate:             22_500,
      iznosKamatneStoape:    5750,
      valuta:                'RSD',
      ocekivaniDatumDospeca: '2025-04-01T00:00:00Z',
      praviDatumDospeca:     null,
      statusPlacanja:        'NEPLACENO',
    },
  ],
}

const MOCK_ACCOUNTS = {
  accounts: [
    {
      id: '10',
      brojRacuna:           '111-0000000001-01',
      nazivRacuna:          'Moj tekući račun',
      kategorijaRacuna:     'TEKUCI',
      vrstaRacuna:          'LICNI',
      valutaOznaka:         'RSD',
      stanjeRacuna:         150_000,
      rezervisanaSredstva:  0,
      raspolozivoStanje:    150_000,
    },
    {
      id: '11',
      brojRacuna:           '222-0000000002-02',
      nazivRacuna:          'Devizni račun EUR',
      kategorijaRacuna:     'DEVIZNI',
      vrstaRacuna:          'LICNI',
      valutaOznaka:         'EUR',
      stanjeRacuna:         5_000,
      rezervisanaSredstva:  0,
      raspolozivoStanje:    5_000,
    },
  ],
}

// ─── Shared auth setup ────────────────────────────────────────────────────────

function setupAuth() {
  cy.intercept('POST', '/api/login', {
    statusCode: 200,
    body: { accessToken: CLIENT_JWT, refreshToken: 'fake-refresh-token' },
  }).as('loginReq')

  cy.login('klijent@test.com', 'TestPass12')
  cy.wait('@loginReq')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Krediti — Klijentski portal', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1a: Empty state
  // ──────────────────────────────────────────────────────────────────────────
  describe('Test 1a: Prazno stanje (nema kredita)', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/client/credits', {
        statusCode: 200,
        body: { credits: [] },
      }).as('getCredits')

      setupAuth()
      cy.visit('/client/krediti')
      cy.wait('@getCredits')
    })

    it('prikazuje empty state poruku i CTA dugme', () => {
      cy.contains('Nemate aktivnih kredita').should('be.visible')
      cy.contains('Podnesi zahtev za kredit').should('be.visible')
    })

    it('CTA dugme vodi na formu za kredit', () => {
      cy.get('[data-cy="empty-state-cta"]').click()
      cy.url().should('include', '/client/krediti/novo')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1b: Lista kredita i detalji
  // ──────────────────────────────────────────────────────────────────────────
  describe('Test 1b: Lista kredita i otvaranje detalja', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/client/credits', {
        statusCode: 200,
        body: { credits: MOCK_CREDITS },
      }).as('getCredits')

      cy.intercept('GET', '/api/v1/client/credits/1', {
        statusCode: 200,
        body: MOCK_CREDIT_DETAIL,
      }).as('getCreditDetail')

      setupAuth()
      cy.visit('/client/krediti')
      cy.wait('@getCredits')
    })

    it('prikazuje kartice kredita sortirane opadajuće po iznosu', () => {
      cy.get('[data-cy="kredit-card"]').should('have.length', 2)
      // Stambeni (8.5M) treba da bude na vrhu
      cy.get('[data-cy="kredit-card"]').first().contains('Stambeni')
    })

    it('prikazuje broj kredita i iznos na kartici', () => {
      cy.contains('KR-2024-00002').should('be.visible')
      cy.contains('KR-2024-00001').should('be.visible')
    })

    it('klikom na "Detalji" otvara modal sa svim poljima', () => {
      // Click on first card's details button (Stambeni is first after sort,
      // but we'll specifically click Gotovinski card's button)
      cy.get('[data-cy="kredit-card"]').last().find('[data-cy="detalji-btn"]').click()
      cy.wait('@getCreditDetail')

      cy.contains('Detalji kredita').should('be.visible')
      cy.contains('KR-2024-00001').should('be.visible')
      cy.contains('Gotovinski').should('be.visible')
      cy.contains('60 meseci').should('be.visible')
      cy.contains('Fiksna').should('be.visible')
    })

    it('zatvara modal klikom na X', () => {
      cy.get('[data-cy="kredit-card"]').last().find('[data-cy="detalji-btn"]').click()
      cy.wait('@getCreditDetail')
      cy.contains('Detalji kredita').should('be.visible')
      cy.get('button[aria-label="Zatvori"]').click()
      cy.contains('Detalji kredita').should('not.exist')
    })

    it('dugme "Zahtev za kredit" vodi na formu', () => {
      cy.contains('Zahtev za kredit').click()
      cy.url().should('include', '/client/krediti/novo')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Forma za zahtev
  // ──────────────────────────────────────────────────────────────────────────
  describe('Test 2: Forma za podnošenje zahteva', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/v1/client/accounts', {
        statusCode: 200,
        body: MOCK_ACCOUNTS,
      }).as('getAccounts')

      cy.intercept('GET', '/api/v1/currencies', {
        statusCode: 200,
        body: {
          valute: [
            { id: 1, naziv: 'Srpski dinar', oznaka: 'RSD' },
            { id: 2, naziv: 'Euro', oznaka: 'EUR' },
          ],
        },
      }).as('getCurrencies')

      setupAuth()
      cy.visit('/client/krediti/novo')
      cy.wait('@getAccounts')
      cy.wait('@getCurrencies')
    })

    it('prikazuje sva polja forme', () => {
      cy.get('select#vrsta_kredita').should('exist')
      cy.get('select#tip_kamate').should('exist')
      cy.get('input[placeholder*="iznos"]').should('exist')
      cy.get('select#valuta').should('exist')
      cy.get('select#rok_otplate').should('exist')
      cy.get('select#status_zaposlenja').should('exist')
      cy.get('select#broj_racuna').should('exist')
    })

    it('rok otplate ima opcije 12–84 za GOTOVINSKI', () => {
      cy.get('select#vrsta_kredita').select('GOTOVINSKI')
      cy.get('select#rok_otplate option').then(($opts) => {
        const values = [...$opts].map((o) => o.value).filter(Boolean)
        expect(values).to.deep.equal(['12', '24', '36', '48', '60', '72', '84'])
      })
    })

    it('rok otplate ima opcije 60–360 za STAMBENI', () => {
      cy.get('select#vrsta_kredita').select('STAMBENI')
      cy.get('select#rok_otplate option').then(($opts) => {
        const values = [...$opts].map((o) => o.value).filter(Boolean)
        expect(values).to.deep.equal(['60', '120', '180', '240', '300', '360'])
      })
    })

    it('resetuje rok otplate pri promeni vrste kredita', () => {
      cy.get('select#vrsta_kredita').select('GOTOVINSKI')
      cy.get('select#rok_otplate').select('84')
      cy.get('select#rok_otplate').should('have.value', '84')

      // Switch to Stambeni — 84 is not valid, should reset
      cy.get('select#vrsta_kredita').select('STAMBENI')
      cy.get('select#rok_otplate').should('not.have.value', '84')
    })

    it('prikazuje inline grešku ako se valute ne poklapaju', () => {
      // Select EUR for credit
      cy.get('select#valuta').select('EUR')
      // Select RSD account
      cy.get('select#broj_racuna').select('111-0000000001-01')
      cy.get('[data-cy="currency-mismatch-error"]').should('be.visible')
      cy.contains('Valute se ne poklapaju').should('be.visible')
    })

    it('submit dugme je disabled kad se valute ne poklapaju', () => {
      cy.get('select#valuta').select('EUR')
      cy.get('select#broj_racuna').select('111-0000000001-01')
      cy.get('[data-cy="submit-zahtev"]').should('be.disabled')
    })

    it('uklanja grešku o neusklađenosti valuta kad se poklope', () => {
      cy.get('select#valuta').select('EUR')
      cy.get('select#broj_racuna').select('111-0000000001-01')
      cy.get('[data-cy="currency-mismatch-error"]').should('be.visible')

      // Switch account to EUR account
      cy.get('select#broj_racuna').select('222-0000000002-02')
      cy.get('[data-cy="currency-mismatch-error"]').should('not.exist')
    })

    it('prikazuje validacione greške za prazna obavezna polja', () => {
      cy.get('[data-cy="submit-zahtev"]').click()
      cy.contains('Odaberite vrstu kredita').should('be.visible')
      cy.contains('Odaberite tip kamatne stope').should('be.visible')
    })

    it('uspešno podnosi zahtev i prikazuje success state', () => {
      cy.intercept('POST', '/api/v1/client/credits', {
        statusCode: 200,
        body: { id: '99' },
      }).as('postKredit')

      cy.get('select#vrsta_kredita').select('GOTOVINSKI')
      cy.get('select#tip_kamate').select('FIKSNA')
      cy.get('input[placeholder*="iznos"]').first().type('500000')
      cy.get('select#valuta').select('RSD')
      cy.get('select#rok_otplate').select('60')
      cy.get('input[placeholder*="stana"]').type('Kupovina automobila')
      cy.get('input[placeholder*="80000"]').type('100000')
      cy.get('select#status_zaposlenja').select('STALNO')
      cy.get('input[placeholder*="24"]').type('36')
      cy.get('input[type="tel"]').type('+381601234567')
      cy.get('select#broj_racuna').select('111-0000000001-01')

      cy.get('[data-cy="submit-zahtev"]').click()
      cy.wait('@postKredit')

      cy.contains('Zahtev je uspešno podnet!').should('be.visible')
      cy.contains('Vaš zahtev za kredit je primljen').should('be.visible')
    })

    it('dugme "Nazad" vraća na listu kredita', () => {
      cy.intercept('GET', '/api/v1/client/credits', {
        statusCode: 200,
        body: { credits: [] },
      }).as('getCredits')

      cy.contains('Nazad na kredite').click()
      cy.url().should('include', '/client/krediti')
    })
  })
})
