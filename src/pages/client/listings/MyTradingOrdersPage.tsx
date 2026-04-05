import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Ban, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { listTradingOrders, cancelTradingOrder } from '@/services/tradingService'
import type { TradingOrder, TradingOrderStatus } from '@/types'
import Button from '@/components/common/Button'
import Dialog from '@/components/common/Dialog'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { hartijeDetailPath } from '@/router/helpers'

// ─── Table helpers ────────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={[
        'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
        right ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  right,
  mono,
}: {
  children: React.ReactNode
  right?: boolean
  mono?: boolean
}) {
  return (
    <td
      className={[
        'px-4 py-3 text-sm text-gray-800',
        right ? 'text-right' : '',
        mono ? 'font-mono text-xs' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<TradingOrderStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  DECLINED: 'bg-red-100 text-red-700',
  DONE:     'bg-green-100 text-green-800',
  CANCELED: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<TradingOrderStatus, string> = {
  PENDING:  'Na čekanju',
  APPROVED: 'Odobreno',
  DECLINED: 'Odbijeno',
  DONE:     'Izvršeno',
  CANCELED: 'Otkazano',
}

function StatusBadge({ status }: { status: TradingOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function DirectionBadge({ direction }: { direction: 'BUY' | 'SELL' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        direction === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
      }`}
    >
      {direction === 'BUY' ? 'Kupi' : 'Prodaj'}
    </span>
  )
}

// ─── Status filter options ────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: { label: string; value: TradingOrderStatus | '' }[] = [
  { label: 'Svi',        value: '' },
  { label: 'Na čekanju', value: 'PENDING' },
  { label: 'Odobreno',   value: 'APPROVED' },
  { label: 'Odbijeno',   value: 'DECLINED' },
  { label: 'Izvršeno',   value: 'DONE' },
  { label: 'Otkazano',   value: 'CANCELED' },
]

// ─── Confirm cancel dialog ────────────────────────────────────────────────────

interface ConfirmCancelDialogProps {
  order: TradingOrder | null
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmCancelDialog({ order, loading, onConfirm, onClose }: ConfirmCancelDialogProps) {
  return (
    <Dialog open={!!order} onClose={onClose} title="Potvrda otkazivanja" maxWidth="sm">
      {order && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Da li ste sigurni da želite da otkažete ovaj nalog? Ova akcija se ne može poništiti.
          </p>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Nalog #</span>
              <span className="font-mono font-medium">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Hartija (ID)</span>
              <span className="font-medium">{order.listingId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Smer</span>
              <DirectionBadge direction={order.direction} />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tip</span>
              <span className="font-mono text-xs bg-gray-200 rounded px-1.5 py-0.5">
                {order.orderType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Količina</span>
              <span className="font-medium">{order.quantity}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Status</span>
              <StatusBadge status={order.status} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Odustani
            </Button>
            <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
              Otkaži nalog
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyTradingOrdersPage() {
  const [orders, setOrders] = useState<TradingOrder[]>([])
  const [statusFilter, setStatusFilter] = useState<TradingOrderStatus | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cancelTarget, setCancelTarget] = useState<TradingOrder | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listTradingOrders(statusFilter || undefined)
      setOrders(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Greška pri učitavanju naloga.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      await cancelTradingOrder(cancelTarget.id)
      toast.success(`Nalog #${cancelTarget.id} je uspešno otkazan.`)
      setCancelTarget(null)
      await fetchOrders()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Greška pri otkazivanju naloga.')
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moji nalozi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pregled i upravljanje vašim nalozima za hartije od vrednosti
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          loading={loading}
          onClick={fetchOrders}
        >
          Osveži
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Status:</span>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={[
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === value
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && orders.length === 0 ? (
          <div className="text-center py-16 text-red-600 text-sm">{error}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-gray-400 text-sm">Nemate naloga koji odgovaraju odabranom filteru.</p>
            <Link
              to="/hartije"
              className="text-primary-600 hover:underline text-sm font-medium"
            >
              Pregledajte hartije od vrednosti →
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <Th>ID</Th>
                    <Th>Hartija</Th>
                    <Th>Tip</Th>
                    <Th>Smer</Th>
                    <Th right>Količina</Th>
                    <Th right>Kontr. vel.</Th>
                    <Th right>Cena / jed.</Th>
                    <Th right>Stop cena</Th>
                    <Th right>Preostalo</Th>
                    <Th>Status</Th>
                    <Th>Kreirano</Th>
                    <Th right>Akcije</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const canCancel = order.status === 'PENDING' || order.status === 'APPROVED'
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <Td mono>#{order.id}</Td>
                        <Td>
                          <Link
                            to={hartijeDetailPath(order.listingId)}
                            className="inline-flex items-center gap-1 text-primary-700 hover:underline font-medium"
                          >
                            {order.listingId}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Td>
                        <Td>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-medium text-gray-700">
                            {order.orderType}
                          </span>
                        </Td>
                        <Td>
                          <DirectionBadge direction={order.direction} />
                        </Td>
                        <Td right>{order.quantity}</Td>
                        <Td right>{order.contractSize}</Td>
                        <Td right mono>
                          {order.pricePerUnit
                            ? `$${parseFloat(order.pricePerUnit).toFixed(4)}`
                            : '—'}
                        </Td>
                        <Td right mono>
                          {order.stopPrice
                            ? `$${parseFloat(order.stopPrice).toFixed(4)}`
                            : '—'}
                        </Td>
                        <Td right>{order.remainingPortions}</Td>
                        <Td>
                          <StatusBadge status={order.status} />
                        </Td>
                        <Td>
                          {new Date(order.createdAt).toLocaleString('sr-RS', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Td>
                        <Td right>
                          {canCancel ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Ban className="h-3.5 w-3.5 text-gray-500" />}
                              onClick={() => setCancelTarget(order)}
                            >
                              Otkaži
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400">
              Prikazano {orders.length} naloga
            </div>
          </>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <ConfirmCancelDialog
        order={cancelTarget}
        loading={cancelLoading}
        onConfirm={handleCancelConfirm}
        onClose={() => !cancelLoading && setCancelTarget(null)}
      />
    </div>
  )
}
