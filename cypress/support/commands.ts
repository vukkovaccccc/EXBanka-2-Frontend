// Custom Cypress commands
/* eslint-disable @typescript-eslint/no-namespace -- Cypress typings use namespace merging */

// ─── Seed admin credentials (ADMIN, id=1) ─────────────────────────────────────
export const ADMIN_EMAIL = 'admin@raf.rs'
export const ADMIN_PASS = 'Admin123'

// Backend activation secret (from docker-compose).
// Since the activation token is a plain JWT signed with this secret,
// we generate it inside the browser using SubtleCrypto.
export const ACTIVATION_SECRET = 'super_secret_jwt_activation_key'

// ─── Login via UI ─────────────────────────────────────────────────────────────

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').should('not.be.disabled').click()
})

// ─── Admin token via direct API ───────────────────────────────────────────────

Cypress.Commands.add('getAdminToken', () => {
  return cy
    .request({
      method: 'POST',
      url: '/api/login',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    })
    .its('body.accessToken')
})

// ─── base64url helpers ────────────────────────────────────────────────────────

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlFromUint8(u8: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Generates a signed activation JWT using WebCrypto HMAC-SHA256. */
Cypress.Commands.add('makeActivationJwt', (email: string) => {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url({
    sub: email,
    token_type: 'activation',
    iat: now,
    exp: now + 86400,
  })
  const data = `${header}.${payload}`

  return cy.wrap(
    (async () => {
      const enc = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(ACTIVATION_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sig = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, enc.encode(data))
      )
      return `${data}.${b64urlFromUint8(sig)}`
    })(),
    { log: false }
  )
})

// ─── High-level bootstrap commands ────────────────────────────────────────────

interface CreatedUser {
  id: string
  email: string
  password: string
}

/** Creates+activates a fresh EMPLOYEE and returns { id, email, password }. */
Cypress.Commands.add('createActivatedEmployee', (opts?: { permissions?: string[] }) => {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e.empl.${ts}@test.rs`
  const password = 'NovaLozinka12'

  return cy.getAdminToken().then((adminToken: string) => {
    return cy
      .request({
        method: 'POST',
        url: '/api/employee',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          email,
          first_name: 'E2E',
          last_name: 'Employee',
          birth_date: new Date('1990-01-01').getTime(),
          gender: 1,
          phone_number: '+381601111111',
          address: 'Test 1',
          username: `e2e.empl.${ts}`,
          position: 'Tester',
          department: 'IT',
          is_active: true,
          permissions: opts?.permissions ?? [],
          userType: 'USER_TYPE_EMPLOYEE',
        },
      })
      .then((resp) => {
        const id = String(resp.body.id)
        return cy.makeActivationJwt(email).then((jwt: string) => {
          return cy
            .request({
              method: 'POST',
              url: '/api/activate',
              body: {
                token: jwt,
                new_password: password,
                confirm_password: password,
              },
            })
            .then(() => {
              return cy.wrap<CreatedUser>({ id, email, password }, { log: false })
            })
        })
      })
  })
})

/**
 * Creates+activates a fresh CLIENT (via a fresh employee) and returns
 * { id, email, password }.
 *
 * Client creation requires an EMPLOYEE token (admin cannot create client).
 */
Cypress.Commands.add('createActivatedClient', () => {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e.cl.${ts}@test.rs`
  const password = 'KlijentLoz12'

  return cy.createActivatedEmployee().then((empl: CreatedUser) => {
    return cy
      .request({
        method: 'POST',
        url: '/api/login',
        body: { email: empl.email, password: empl.password },
      })
      .its('body.accessToken')
      .then((emplToken: string) => {
        return cy
          .request({
            method: 'POST',
            url: '/api/client',
            headers: { Authorization: `Bearer ${emplToken}` },
            body: {
              email,
              first_name: 'E2E',
              last_name: 'Client',
              birth_date: new Date('1990-01-01').getTime(),
              gender: 1,
              phone_number: '+381602222222',
              address: 'Klijent 1',
            },
          })
          .then((resp) => {
            const id = String(resp.body.id)
            return cy.makeActivationJwt(email).then((jwt: string) => {
              return cy
                .request({
                  method: 'POST',
                  url: '/api/activate',
                  body: {
                    token: jwt,
                    new_password: password,
                    confirm_password: password,
                  },
                })
                .then(() => {
                  return cy.wrap<CreatedUser>({ id, email, password }, { log: false })
                })
            })
          })
      })
  })
})

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Cypress.Chainable<void>
      getAdminToken(): Cypress.Chainable<string>
      makeActivationJwt(email: string): Cypress.Chainable<string>
      createActivatedEmployee(opts?: {
        permissions?: string[]
      }): Cypress.Chainable<{ id: string; email: string; password: string }>
      createActivatedClient(): Cypress.Chainable<{
        id: string
        email: string
        password: string
      }>
    }
  }
}

export {}
