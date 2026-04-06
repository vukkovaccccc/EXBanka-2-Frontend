import type { UserType } from '@/types'

/** Kanonska baza ruta za hartije od vrednosti (klijenti i zaposleni). */
export const HARTIJE_BASE = '/hartije'

export function hartijeListPath(): string {
  return HARTIJE_BASE
}

export function hartijeDetailPath(id: string): string {
  return `${HARTIJE_BASE}/${id}`
}

export function hartijeKupovinaPath(id: string): string {
  return `${HARTIJE_BASE}/kupovina/${id}`
}

export function myTradingOrdersPath(): string {
  return `${HARTIJE_BASE}/my-orders`
}

export function supervisorOrdersPath(): string {
  return '/employee/trading/orders'
}

export function getHomeForRole(userType?: UserType): string {
  switch (userType) {
    case 'ADMIN':
      return '/admin'
    case 'EMPLOYEE':
      return '/employee'
    case 'CLIENT':
      return '/client'
    default:
      return '/login'
  }
}
