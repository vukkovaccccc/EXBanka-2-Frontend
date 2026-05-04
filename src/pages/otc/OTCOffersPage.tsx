import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCelina4Store } from '@/store/useCelina4Store'
import OTCTradeTable from '@/components/otc/OTCTradeTable'
import SAGAStatusToast from '@/components/shared/SAGAStatusToast'

export default function OTCOffersPage() {
  const navigate = useNavigate()
  const { offers, offersLoading, offersError, fetchOffers, unreadCount } = useCelina4Store()

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500">
        <span className="hover:text-gray-700 cursor-pointer" onClick={() => navigate(-1)}>← Nazad</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          OTC Ponude
          {unreadCount > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </h1>
      </div>

      {offersLoading && (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {offersError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {offersError}
        </div>
      )}

      {!offersLoading && !offersError && (
        <OTCTradeTable offers={offers} onView={id => navigate(`/otc/offers/${id}`)} />
      )}

      <SAGAStatusToast />
    </div>
  )
}
