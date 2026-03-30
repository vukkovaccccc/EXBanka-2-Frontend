/**
 * Feature 1: Autentifikacija korisnika
 * Scenarios 8–10: Aktivacija naloga
 *
 * PRAVI end-to-end test — bez mock-ova, komunicira sa pravim backendom.
 *
 * ─── Napomena o aktivacionim tokenima ────────────────────────────────────────
 * Backend generiše aktivacioni token kao potpisani JWT (HS256) sa secretom
 * "change-me-activation-secret" (default iz docker-compose.yml).
 * Token NIJE čuvan u bazi — možemo ga generisati direktno u testu.
 * Endpoint: POST /api/activate
 *
 * ─── Preduslovi ───────────────────────────────────────────────────────────────
 * 1. docker-compose up -d  (u EXBanka-2-Backend)
 * 2. npm run dev           (u EXBanka-2-Frontend, port 3000)
 *
 * ─── Korisnici u bazi ─────────────────────────────────────────────────────────
 *   admin@raf.rs / Test1234  (ADMIN)
 */

const ADMIN_EMAIL = 'admin@raf.rs'
const ADMIN_PASS  = 'Test1234'

// ─── JWT token generator ──────────────────────────────────────────────────────

/**
 * Generiše valjani aktivacioni JWT za dati email, koristeći isti algoritam
 * i secret kao backend (default: "change-me-activation-secret").
 *
 * Payload: { sub: email, token_type: "activation", iat, exp: +24h }
 * Algoritam: HMAC-SHA256, potpisan Node.js crypto modulom.
 */
function generateActivationJwt(email: string): Cypress.Chainable<string> {
  // Skript je base64-enkodiran da bi se izbegli problemi sa shell kvotiranjem
  const script =
    `const c=require('crypto');` +
    `const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');` +
    `const now=Math.floor(Date.now()/1000);` +
    `const p=Buffer.from(JSON.stringify({sub:'${email}',token_type:'activation',iat:now,exp:now+86400})).toString('base64url');` +
    `const s=c.createHmac('sha256','change-me-activation-secret').update(h+'.'+p).digest('base64url');` +
    `process.stdout.write(h+'.'+p+'.'+s);`

  const encoded = btoa(script)
  return cy
    .exec(`node -e "eval(Buffer.from('${encoded}','base64').toString())"`, { timeout: 10_000 })
    .its('stdout')
    .then((out) => out.trim())
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Feature 1: Aktivacija naloga', () => {

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  // ── Scenario 8: Uspešna aktivacija naloga ─────────────────────────────────
  it('S8: zaposleni aktivira nalog validnim tokenom i postavlja lozinku', () => {
    cy.intercept('POST', '/api/activate').as('activateReq')

    const ts    = Date.now()
    const email = `aktivacija.s8.${ts}@testbanka.rs`

    // Given: admin kreira novog zaposlenog (password_hash je prazan — jedino tada aktivacija prolazi)
    cy.request({ method: 'POST', url: '/api/login', body: { email: ADMIN_EMAIL, password: ADMIN_PASS } })
      .its('body.accessToken')
      .then((adminToken: string) => {
        cy.request({
          method: 'POST',
          url: '/api/employee',
          headers: { Authorization: `Bearer ${adminToken}` },
          body: {
            email,
            first_name:   'Aktivacija',
            last_name:    'Test',
            birth_date:   new Date('1990-06-15').getTime(),
            gender:       1,
            phone_number: '+381601234567',
            address:      'Testna ulica 1',
            username:     `akt.s8.${ts}`,
            position:     'Tester',
            department:   'IT',
            is_active:    true,
            permissions:  [],
            userType:     'USER_TYPE_EMPLOYEE',
          },
        })
      })

    // Generišemo aktivacioni JWT za email novog zaposlenog
    generateActivationJwt(email).then((activationToken) => {
      // When: zaposleni poseti aktivacioni link
      cy.visit(`/activate?token=${activationToken}`)
      cy.contains('Aktivacija naloga').should('be.visible')

      // And: unese validnu lozinku
      cy.get('#new-password').type('NovaLozinka12')
      cy.get('#confirm-password').type('NovaLozinka12')

      cy.get('button[type="submit"]').should('not.be.disabled').click()

      // Then: sistem aktivira nalog
      cy.wait('@activateReq', { timeout: 10_000 }).then((interception) => {
        expect(interception.response?.statusCode, 'API vratio 200').to.equal(200)
      })

      // And: korisnik se preusmerava na login stranicu
      cy.url({ timeout: 8_000 }).should('include', '/login')
    })
  })

  // ── Scenario 9: Aktivacija sa nevažećim tokenom ───────────────────────────
  it('S9: sistem odbija aktivaciju sa nevažećim tokenom i prikazuje grešku', () => {
    cy.intercept('POST', '/api/activate').as('activateReq')

    // Given: korisnik poseti aktivacioni link sa neispravnim tokenom
    // (format validnog JWT-a ali pogrešan potpis / nepostojući email)
    cy.visit('/activate?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJuZS5wb3N0b2ppQGJhbmthLnJzIiwidG9rZW5fdHlwZSI6ImFjdGl2YXRpb24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.invalid_signature')
    cy.contains('Aktivacija naloga').should('be.visible')

    // When: unese validnu lozinku
    cy.get('#new-password').type('ValidLozinka12')
    cy.get('#confirm-password').type('ValidLozinka12')

    cy.get('button[type="submit"]').should('not.be.disabled').click()

    // Then: backend odbija zahtev (nevažeći potpis ili nepostojeći nalog)
    cy.wait('@activateReq', { timeout: 10_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.not.equal(200)
    })

    // And: prikazuje poruku o grešci
    cy.contains('Link je nevažeći ili je istekao', { timeout: 8_000 }).should('be.visible')
    cy.url().should('include', '/activate')
  })

  // ── Scenario 10: Klijentska validacija — slaba lozinka ───────────────────
  it('S10: sistem ne dozvoljava slabe lozinke — dugme ostaje disabled', () => {
    // Given: korisnik poseti aktivacioni link (token je neprazan — Zod validacija
    // se izvršava pre API poziva; backend ovde nije ni potreban)
    cy.visit('/activate?token=fake-token-for-client-validation')
    cy.contains('Aktivacija naloga').should('be.visible')

    // When: unese lozinku koja ne ispunjava uslove (< 8 karaktera, nema 2 cifre)
    cy.get('#new-password').type('slaba')
    cy.get('#confirm-password').type('slaba')

    // Then: prikazuje se validaciona greška
    cy.get('[role="alert"]', { timeout: 6_000 }).should('be.visible')

    // And: dugme ostaje disabled — API poziv se ne šalje
    cy.get('button[type="submit"]').should('be.disabled')
  })
})

export {}
