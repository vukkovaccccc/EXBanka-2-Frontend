import { useAuthStore } from '@/store/authStore'
import { useCelina4Store } from '@/store/useCelina4Store'
import type { OTCOffer } from '@/types/celina4'
import PriceDeviationBadge from '@/components/shared/PriceDeviationBadge'

interface OTCTradeTableProps {
  offers: OTCOffer[]
  onView: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_LABELS: Record<OTCOffer['status'], string> = {
  ACTIVE: 'Aktivna',
  ACCEPTED: 'Prihvaćena',
  REJECTED: 'Odbijena',
  EXPIRED: 'Povučena/istekla',
}

export default function OTCTradeTable({ offers, onView }: OTCTradeTableProps) {
  const { user } = useAuthStore()
  const { acceptOffer, rejectOffer } = useCelina4Store()
  const callerID = String(user?.id ?? '')

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['#', 'Akcija', 'Strana', 'Količina', 'Cena', 'Premija', 'Poravnanje', 'Izmenio', 'Poslednja izmena', 'Status', 'Akcije'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {offers.length === 0 && (
            <tr>
              <td colSpan={11} className="py-10 text-center text-gray-400">
                Nema ponuda.
              </td>
            </tr>
          )}
          {offers.map(offer => {
            const isBuyer = offer.buyerId === callerID
            const isMyTurn = !!offer.needsReview && offer.status === 'ACTIVE'
            // Akcept iz tabele dozvoljen samo kupcu (prodavac često mora da bira
            // svoj račun za prijem premije — to ide preko detalja).
            const canQuickAccept = isMyTurn && isBuyer
            return (
              <tr
                key={offer.id}
                className={isMyTurn ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}
              >
                <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                  #{offer.id}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {offer.stock.ticker}
                  {offer.stock.exchange && (
                    <span className="ml-1 text-xs text-gray-500">({offer.stock.exchange})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {isBuyer ? 'Kupac' : 'Prodavac'}
                </td>
                <td className="px-4 py-3 text-gray-700">{offer.amount.toLocaleString('sr-RS')}</td>
                <td className="px-4 py-3">
                  <PriceDeviationBadge
                    currentPrice={offer.pricePerStock}
                    referencePrice={offer.stock.lastKnownMarketPrice ?? offer.pricePerStock}
                  />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {offer.premium.toLocaleString('sr-RS', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-gray-700">{formatDate(offer.settlementDate)}</td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  #{offer.modifiedBy}
                  {offer.modifiedBy === callerID && (
                    <span className="ml-1 text-gray-400">(vi)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(offer.lastModified)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    offer.status === 'ACTIVE'
                      ? 'bg-blue-100 text-blue-800'
                      : offer.status === 'ACCEPTED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {STATUS_LABELS[offer.status]}
                    {isMyTurn && <span className="ml-1">●</span>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => onView(offer.id)}
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Detalji
                    </button>
                    {canQuickAccept && (
                      <button
                        onClick={() => acceptOffer(offer.id)}
                        className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Prihvati
                      </button>
                    )}
                    {offer.status === 'ACTIVE' && (
                      <button
                        onClick={() => rejectOffer(offer.id)}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        title={isMyTurn ? 'Odbij' : 'Povuci sopstvenu ponudu'}
                      >
                        {isMyTurn ? 'Odbij' : 'Povuci'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
