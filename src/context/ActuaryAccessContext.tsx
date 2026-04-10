import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getMyActuaryInfo } from '@/services/actuaryService'
import type { ActuaryType } from '@/types/actuary'
import { useAuthStore } from '@/store/authStore'

export type ActuaryAccessState = {
  loading: boolean
  /** ADMIN, CLIENT, ili zaposleni registrovan kao aktuar (agent/supervizor). */
  canAccessTradingPortals: boolean
  actuaryType: ActuaryType | null
}

const ActuaryAccessContext = createContext<ActuaryAccessState>({
  loading: true,
  canAccessTradingPortals: false,
  actuaryType: null,
})

export function ActuaryAccessProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [actuaryType, setActuaryType] = useState<ActuaryType | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setActuaryType(null)
      return
    }
    if (user.userType === 'ADMIN' || user.userType === 'CLIENT') {
      setActuaryType(null)
      setLoading(false)
      return
    }
    if (user.userType !== 'EMPLOYEE') {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    getMyActuaryInfo()
      .then((res) => {
        if (cancelled) return
        const t = res.actuary.actuary_type
        if (t === 'ACTUARY_TYPE_AGENT' || t === 'ACTUARY_TYPE_SUPERVISOR') {
          setActuaryType(t)
        } else {
          setActuaryType(null)
        }
      })
      .catch(() => {
        if (!cancelled) setActuaryType(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.userType])

  const canAccessTradingPortals = useMemo(() => {
    if (!user) return false
    if (user.userType === 'ADMIN') return true
    // Klijenti moraju imati TRADE_STOCKS permisiju da bi pristupili trading portalima
    if (user.userType === 'CLIENT') {
      return user.permissions.includes('TRADE_STOCKS')
    }
    if (user.userType === 'EMPLOYEE') {
      return (
        actuaryType === 'ACTUARY_TYPE_AGENT' ||
        actuaryType === 'ACTUARY_TYPE_SUPERVISOR'
      )
    }
    return false
  }, [user, actuaryType])

  const value = useMemo(
    () => ({ loading, canAccessTradingPortals, actuaryType }),
    [loading, canAccessTradingPortals, actuaryType]
  )

  return (
    <ActuaryAccessContext.Provider value={value}>
      {children}
    </ActuaryAccessContext.Provider>
  )
}

export function useActuaryAccess(): ActuaryAccessState {
  return useContext(ActuaryAccessContext)
}
