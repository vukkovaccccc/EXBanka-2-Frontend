import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getHomeForRole } from '@/router/helpers'

/**
 * Dozvoljava decu samo ako korisnik ima navedenu permisiju (npr. SUPERVISOR).
 * ADMIN uvek prolazi (hasPermission je true za sve).
 */
export default function PermissionRoute({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { hasPermission, user } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!hasPermission(permission)) {
    return <Navigate to={getHomeForRole(user.userType)} replace />
  }

  return <>{children}</>
}
