import { describe, it, expect, beforeEach } from 'vitest'
import {
  useAuthStore,
  saveRefreshToken,
  getRefreshToken,
  removeRefreshToken,
  REFRESH_TOKEN_KEY,
} from './authStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const adminUser = {
  id: '1',
  email: 'admin@test.com',
  userType: 'ADMIN' as const,
  permissions: [],
}

const employeeUser = {
  id: '2',
  email: 'emp@test.com',
  userType: 'EMPLOYEE' as const,
  permissions: ['CAN_VIEW_CLIENTS', 'CAN_EDIT_CLIENTS'],
}

const clientUser = {
  id: '3',
  email: 'client@test.com',
  userType: 'CLIENT' as const,
  permissions: ['CAN_VIEW_ACCOUNTS'],
}

function resetStore() {
  useAuthStore.setState({
    accessToken: null,
    user: null,
    permissionsCodebook: [],
  })
}

// ─── State setters ────────────────────────────────────────────────────────────

describe('useAuthStore – state setters', () => {
  beforeEach(resetStore)

  it('setAccessToken cuva token u memoriji', () => {
    useAuthStore.getState().setAccessToken('jwt.token.here')
    expect(useAuthStore.getState().accessToken).toBe('jwt.token.here')
  })

  it('setUser cuva korisnika u store', () => {
    useAuthStore.getState().setUser(adminUser)
    expect(useAuthStore.getState().user).toEqual(adminUser)
  })

  it('setPermissionsCodebook cuva sifarnik permisija', () => {
    const codebook = [
      { id: '1', name: 'CAN_VIEW_CLIENTS', description: 'Pregled klijenata' },
    ]
    useAuthStore.getState().setPermissionsCodebook(codebook)
    expect(useAuthStore.getState().permissionsCodebook).toEqual(codebook)
  })

  it('clearAuth resetuje token, korisnika i sifarnik', () => {
    useAuthStore.getState().setAccessToken('token')
    useAuthStore.getState().setUser(adminUser)
    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
    expect(state.permissionsCodebook).toEqual([])
  })

  it('clearAuth brise refresh token iz sessionStorage', () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh.token')
    useAuthStore.getState().clearAuth()
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
  })
})

// ─── isAuthenticated ──────────────────────────────────────────────────────────

describe('useAuthStore – isAuthenticated', () => {
  beforeEach(resetStore)

  it('vraca false kada nema tokena ni korisnika', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('vraca false kada ima token ali nema korisnika', () => {
    useAuthStore.getState().setAccessToken('token')
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('vraca false kada ima korisnika ali nema tokena', () => {
    useAuthStore.getState().setUser(adminUser)
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('vraca true kada su i token i korisnik postavljeni', () => {
    useAuthStore.getState().setAccessToken('token')
    useAuthStore.getState().setUser(adminUser)
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  })
})

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('useAuthStore – hasPermission', () => {
  beforeEach(resetStore)

  it('vraca false kada nema prijavljenog korisnika', () => {
    expect(useAuthStore.getState().hasPermission('CAN_VIEW_CLIENTS')).toBe(false)
  })

  it('ADMIN uvek ima sve permisije', () => {
    useAuthStore.getState().setUser(adminUser)
    expect(useAuthStore.getState().hasPermission('CAN_VIEW_CLIENTS')).toBe(true)
    expect(useAuthStore.getState().hasPermission('BILO_KOJA_PERMISIJA')).toBe(true)
  })

  it('EMPLOYEE ima permisiju koja mu je dodeljena', () => {
    useAuthStore.getState().setUser(employeeUser)
    expect(useAuthStore.getState().hasPermission('CAN_VIEW_CLIENTS')).toBe(true)
    expect(useAuthStore.getState().hasPermission('CAN_EDIT_CLIENTS')).toBe(true)
  })

  it('EMPLOYEE nema permisiju koja mu nije dodeljena', () => {
    useAuthStore.getState().setUser(employeeUser)
    expect(useAuthStore.getState().hasPermission('CAN_VIEW_ACCOUNTS')).toBe(false)
  })

  it('CLIENT ima svoju permisiju', () => {
    useAuthStore.getState().setUser(clientUser)
    expect(useAuthStore.getState().hasPermission('CAN_VIEW_ACCOUNTS')).toBe(true)
  })

  it('CLIENT nema permisiju zaposlenog', () => {
    useAuthStore.getState().setUser(clientUser)
    expect(useAuthStore.getState().hasPermission('CAN_EDIT_CLIENTS')).toBe(false)
  })
})

// ─── sessionStorage helpers ───────────────────────────────────────────────────

describe('sessionStorage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('saveRefreshToken cuva token u sessionStorage', () => {
    saveRefreshToken('my.refresh.token')
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('my.refresh.token')
  })

  it('getRefreshToken vraca sacuvani token', () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'stored.token')
    expect(getRefreshToken()).toBe('stored.token')
  })

  it('getRefreshToken vraca null kada token ne postoji', () => {
    expect(getRefreshToken()).toBeNull()
  })

  it('removeRefreshToken brise token iz sessionStorage', () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'to.remove')
    removeRefreshToken()
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
  })
})
