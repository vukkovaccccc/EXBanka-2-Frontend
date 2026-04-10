import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useActuaryAccess } from '@/context/ActuaryAccessContext'
import { getHomeForRole } from '@/router/helpers'
import MojPortfolioPage from '@/pages/client/portfolio/MojPortfolioPage'

/**
 * Portfolio: klijenti i admini uvek; zaposleni samo ako su aktuari.
 */
export default function PortfolioRoute() {
  const user = useAuthStore((s) => s.user)
  const { loading, canAccessTradingPortals } = useActuaryAccess()

  if (!user) return null
  if (user.userType === 'CLIENT' || user.userType === 'ADMIN') {
    return <MojPortfolioPage />
  }
  if (user.userType === 'EMPLOYEE' && loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">
        Učitavanje...
      </div>
    )
  }
  if (user.userType === 'EMPLOYEE' && !canAccessTradingPortals) {
    return <Navigate to={getHomeForRole(user.userType)} replace />
  }
  if (user.userType === 'EMPLOYEE') {
    return <MojPortfolioPage />
  }
  return <Navigate to={getHomeForRole(user.userType)} replace />
}
