import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getCurrencies, getDelatnosti } from '@/services/bankaService'
import type { Currency, Delatnost } from '@/types'

interface Dictionaries {
  currencies: Currency[]
  delatnosti: Delatnost[]
}

const DictionaryContext = createContext<Dictionaries>({
  currencies: [],
  delatnosti: [],
})

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const userType    = useAuthStore((s) => s.user?.userType)
  const [data, setData] = useState<Dictionaries>({ currencies: [], delatnosti: [] })
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Fetch once when an EMPLOYEE logs in
    if (!accessToken || userType !== 'EMPLOYEE') return
    if (fetchedRef.current) return
    fetchedRef.current = true

    Promise.all([getCurrencies(), getDelatnosti()])
      .then(([currencies, delatnosti]) => setData({ currencies, delatnosti }))
      .catch(() => {
        // Allow retry on next render cycle if fetch fails
        fetchedRef.current = false
      })
  }, [accessToken, userType])

  // Reset on logout
  useEffect(() => {
    if (!accessToken) {
      fetchedRef.current = false
      setData({ currencies: [], delatnosti: [] })
    }
  }, [accessToken])

  return (
    <DictionaryContext.Provider value={data}>
      {children}
    </DictionaryContext.Provider>
  )
}

export function useDictionaries(): Dictionaries {
  return useContext(DictionaryContext)
}
