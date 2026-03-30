import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeAccessToken, isTokenExpired } from './tokenUtils'

// ─── Mock jwt-decode ──────────────────────────────────────────────────────────

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}))

import { jwtDecode } from 'jwt-decode'
const mockJwtDecode = vi.mocked(jwtDecode)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Unix timestamp N seconds from now */
function futureExp(offsetSec = 3600) {
  return Math.floor(Date.now() / 1000) + offsetSec
}

function expiredExp(offsetSec = 3600) {
  return Math.floor(Date.now() / 1000) - offsetSec
}

// ─── decodeAccessToken ────────────────────────────────────────────────────────

describe('decodeAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dekoduje validan token sa user_type kao string "ADMIN"', () => {
    mockJwtDecode.mockReturnValue({
      sub: '1',
      email: 'admin@test.com',
      user_type: 'ADMIN',
      permissions: ['READ'],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('valid.token.here')
    expect(user).not.toBeNull()
    expect(user!.id).toBe('1')
    expect(user!.email).toBe('admin@test.com')
    expect(user!.userType).toBe('ADMIN')
    expect(user!.permissions).toEqual(['READ'])
  })

  it('dekoduje validan token sa user_type kao string "USER_TYPE_EMPLOYEE"', () => {
    mockJwtDecode.mockReturnValue({
      sub: '2',
      email: 'emp@test.com',
      user_type: 'USER_TYPE_EMPLOYEE',
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('token')
    expect(user!.userType).toBe('EMPLOYEE')
  })

  it('dekoduje validan token sa user_type kao string "user_type_client" (lowercase)', () => {
    mockJwtDecode.mockReturnValue({
      sub: '3',
      email: 'client@test.com',
      user_type: 'user_type_client',
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('token')
    expect(user!.userType).toBe('CLIENT')
  })

  it('dekoduje validan token sa user_type kao broj 1 (ADMIN)', () => {
    mockJwtDecode.mockReturnValue({
      sub: '1',
      email: 'admin@test.com',
      user_type: 1,
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('token')
    expect(user!.userType).toBe('ADMIN')
  })

  it('dekoduje validan token sa user_type kao broj 2 (EMPLOYEE)', () => {
    mockJwtDecode.mockReturnValue({
      sub: '2',
      email: 'emp@test.com',
      user_type: 2,
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('token')
    expect(user!.userType).toBe('EMPLOYEE')
  })

  it('dekoduje validan token sa user_type kao broj 3 (CLIENT)', () => {
    mockJwtDecode.mockReturnValue({
      sub: '3',
      email: 'client@test.com',
      user_type: 3,
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('token')
    expect(user!.userType).toBe('CLIENT')
  })

  it('vraca null kada sub nedostaje', () => {
    mockJwtDecode.mockReturnValue({
      sub: '',
      email: 'test@test.com',
      user_type: 'ADMIN',
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    expect(decodeAccessToken('token')).toBeNull()
  })

  it('vraca null kada email nedostaje', () => {
    mockJwtDecode.mockReturnValue({
      sub: '1',
      email: '',
      user_type: 'ADMIN',
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    expect(decodeAccessToken('token')).toBeNull()
  })

  it('vraca null kada user_type nije prepoznat (nepoznat broj)', () => {
    mockJwtDecode.mockReturnValue({
      sub: '1',
      email: 'test@test.com',
      user_type: 99,
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    expect(decodeAccessToken('token')).toBeNull()
  })

  it('vraca null kada user_type nije prepoznat string', () => {
    mockJwtDecode.mockReturnValue({
      sub: '1',
      email: 'test@test.com',
      user_type: 'UNKNOWN',
      permissions: [],
      exp: futureExp(),
      iat: 0,
    })
    expect(decodeAccessToken('token')).toBeNull()
  })

  it('vraca praznu listu permissions kada permissions nisu array', () => {
    mockJwtDecode.mockReturnValue({
      sub: '1',
      email: 'test@test.com',
      user_type: 'ADMIN',
      permissions: null as unknown as string[],
      exp: futureExp(),
      iat: 0,
    })
    const user = decodeAccessToken('token')
    expect(user!.permissions).toEqual([])
  })

  it('vraca null kada jwtDecode baci gresku', () => {
    mockJwtDecode.mockImplementation(() => { throw new Error('invalid token') })
    expect(decodeAccessToken('invalid')).toBeNull()
  })
})

// ─── isTokenExpired ───────────────────────────────────────────────────────────

describe('isTokenExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vraca false za token koji jos nije istekao', () => {
    mockJwtDecode.mockReturnValue({ exp: futureExp(3600) })
    expect(isTokenExpired('token')).toBe(false)
  })

  it('vraca true za istekli token', () => {
    mockJwtDecode.mockReturnValue({ exp: expiredExp(3600) })
    expect(isTokenExpired('token')).toBe(true)
  })

  it('vraca true kada exp nedostaje', () => {
    mockJwtDecode.mockReturnValue({ exp: undefined })
    expect(isTokenExpired('token')).toBe(true)
  })

  it('vraca true kada jwtDecode baci gresku', () => {
    mockJwtDecode.mockImplementation(() => { throw new Error('malformed') })
    expect(isTokenExpired('badtoken')).toBe(true)
  })
})
