import { describe, it, expect } from 'vitest'
import { getHomeForRole } from './helpers'

describe('getHomeForRole', () => {
  it('vraca /admin za ADMIN rolu', () => {
    expect(getHomeForRole('ADMIN')).toBe('/admin')
  })

  it('vraca /employee za EMPLOYEE rolu', () => {
    expect(getHomeForRole('EMPLOYEE')).toBe('/employee')
  })

  it('vraca /client za CLIENT rolu', () => {
    expect(getHomeForRole('CLIENT')).toBe('/client')
  })

  it('vraca /login kada userType nije prosledjen (undefined)', () => {
    expect(getHomeForRole(undefined)).toBe('/login')
  })

  it('vraca /login za nepoznatu vrednost', () => {
    // @ts-expect-error — namerno testiramo nevalidan unos
    expect(getHomeForRole('UNKNOWN_ROLE')).toBe('/login')
  })
})
