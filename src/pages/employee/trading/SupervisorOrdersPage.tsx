import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { RefreshCw, CheckCircle, XCircle, Ban, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import {
  listTradingOrders,
  approveTradingOrder,
  declineTradingOrder,
  cancelTradingOrder,
} from '@/services/tradingService'
import { getClientById } from '@/services/clientService'
import { getEmployeeById } from '@/services/employeeService'
import type { TradingOrder, TradingOrderStatus } from '@/types'
import Button from '@/components/common/Button'
import Dialog from '@/components/common/Dialog'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getHomeForRole, hartijeDetailPath } from '@/router/helpers'

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

// ─── Direction badge ──────────────────────────────────────────────────────────

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
  { label: 'Svi',           value: '' },
  { label: 'Na čekanju',    value: 'PENDING' },
  { label: 'Odobreno',      value: 'APPROVED' },
  { label: 'Odbijeno',      value: 'DECLINED' },
  { label: 'Izvršeno',      value: 'DONE' },
  { label: 'Otkazano',      value: 'CANCELED' },
]

// ─── Confirm cancel dialog ────────────────────────────────────────────────────

interface ConfirmCancelDialogProps {
  order: TradingOrder | null
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmCancelDialog({
  order,
  loading,
  onConfirm,
  onClose,
}: ConfirmCancelDialogProps) {
  return (
    <Dialog open={!!order} onClose={onClose} title="Otkaži nalog" maxWidth="sm">
      {order && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Da li ste sigurni da želite da otkažete nalog{' '}
            <span className="font-semibold">#{order.id}</span>?
          </p>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Hartija</span>
              <span className="font-medium">ID {order.listingId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Smer</span>
              <DirectionBadge direction={order.direction} />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Količina</span>
              <span className="font-medium">{order.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Nazad
            </Button>
            <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
              Potvrdi otkazivanje
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupervisorOrdersPage() {
  const { user, hasPermission } = useAuthStore()

  // Guard: only SUPERVISOR employees or ADMIN
  const isSupervisor = hasPermission('SUPERVISOR')
  const isAdmin = user?.userType === 'ADMIN'
  if (!isSupervisor && !isAdmin) {
    return <Navigate to={getHomeForRole(user?.userType)} replace />
  }

  const [orders, setOrders] = useState<TradingOrder[]>([])
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<TradingOrderStatus | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-row action loading
  const [actionLoading, setActionLoading] = useState<Record<string, 'approve' | 'decline' | 'cancel' | null>>({})

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<TradingOrder | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Track which user IDs we've already fetched to avoid redundant calls
  const fetchedUserIds = useRef<Set<string>>(new Set())

  const enrichUserNames = useCallback(async (newOrders: TradingOrder[]) => {
    const missing = [...new Set(newOrders.map((o) => String(o.userId)))].filter(
      (id) => !fetchedUserIds.current.has(id),
    )
    if (missing.length === 0) return

    const results = await Promise.allSettled(
      missing.map(async (id) => {
        try {
          const c = await getClientById(id)
          return { id, name: `${c.first_name} ${c.last_name}` }
        } catch {
          const e = await getEmployeeById({ id })
          return { id, name: `${e.first_name} ${e.last_name}` }
        }
      }),
    )

    const map: Record<string, string> = {}
    results.forEach((r, i) => {
      const id = missing[i]
      fetchedUserIds.current.add(id)
      if (r.status === 'fulfilled') {
        map[id] = r.value.name
      } else {
        map[id] = `#${id}`
      }
    })
    setUserNames((prev) => ({ ...prev, ...map }))
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listTradingOrders(statusFilter || undefined)
      setOrders(result)
      enrichUserNames(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Greška pri učitavanju naloga.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, enrichUserNames])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 10_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const handleApprove = async (order: TradingOrder) => {
    setActionLoading((prev) => ({ ...prev, [order.id]: 'approve' }))
    try {
      await approveTradingOrder(order.id)
      toast.success(`Nalog #${order.id} je odobren.`)
      await fetchOrders()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Greška pri odobravanju.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: null }))
    }
  }

  const handleDecline = async (order: TradingOrder) => {
    setActionLoading((prev) => ({ ...prev, [order.id]: 'decline' }))
    try {
      await declineTradingOrder(order.id)
      toast.success(`Nalog #${order.id} je odbijen.`)
      await fetchOrders()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Greška pri odbijanju.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: null }))
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      await cancelTradingOrder(cancelTarget.id)
      toast.success(`Nalog #${cancelTarget.id} je otkazan.`)
      setCancelTarget(null)
      await fetchOrders()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Greška pri otkazivanju.')
    } finally {
      setCancelLoading(false)
    }
  }

  const isRowBusy = (id: string) => !!actionLoading[id]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pregled naloga</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pregled, odobravanje i odbijanje naloga za hartije od vrednosti
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
          <div className="text-center py-16 text-gray-400 text-sm">
            Nema naloga koji odgovaraju odabranom filteru.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <Th>ID</Th>
                    <Th>Korisnik</Th>
                    <Th>Hartija</Th>
                    <Th>Tip</Th>
                    <Th>Smer</Th>
                    <Th right>Količina</Th>
                    <Th right>Kontr. veličina</Th>
                    <Th right>Cena / jed.</Th>
                    <Th right>Preostalo</Th>
                    <Th>Status</Th>
                    <Th>Poslednja izmena</Th>
                    <Th right>Akcije</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const busy = isRowBusy(order.id)
                    const canApproveDecline = order.status === 'PENDING'
                    const canCancel = order.status === 'PENDING' || order.status === 'APPROVED'
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <Td mono>#{order.id}</Td>
                        <Td>{userNames[String(order.userId)] ?? <span className="text-gray-400 font-mono text-xs">#{order.userId}</span>}</Td>
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
                        <Td right>{order.remainingPortions}</Td>
                        <Td>
                          <StatusBadge status={order.status} />
                        </Td>
                        <Td>
                          {new Date(order.lastModified).toLocaleString('sr-RS', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Td>
                        <Td right>
                          <div className="flex items-center justify-end gap-1.5">
                            {canApproveDecline && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  loading={actionLoading[order.id] === 'approve'}
                                  disabled={busy}
                                  leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                                  onClick={() => handleApprove(order)}
                                >
                                  Odobri
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  loading={actionLoading[order.id] === 'decline'}
                                  disabled={busy}
                                  leftIcon={<XCircle className="h-3.5 w-3.5" />}
                                  onClick={() => handleDecline(order)}
                                >
                                  Odbij
                                </Button>
                              </>
                            )}
                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                leftIcon={<Ban className="h-3.5 w-3.5 text-gray-500" />}
                                onClick={() => setCancelTarget(order)}
                              >
                                Otkaži
                              </Button>
                            )}
                          </div>
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
