import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Calculator, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { getHomeForRole } from '@/router/helpers'
import Button from '@/components/common/Button'
import Dialog from '@/components/common/Dialog'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { getTaxUsers, calculateAndCollectTax } from '@/services/portfolioService'
import { getClients } from '@/services/clientService'
import { getAgents } from '@/services/actuaryService'
import type { TaxUserRecord } from '@/services/portfolioService'

// ─── Enriched record (adds display name) ─────────────────────────────────────

type UserType = 'CLIENT' | 'ACTUARY'
type UserTypeFilter = 'ALL' | UserType

interface TaxRecord {
  userId: string
  displayName: string
  userType: UserType
  taxDebt: number
}

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

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
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

// ─── User type badge ──────────────────────────────────────────────────────────

function UserTypeBadge({ type }: { type: UserType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        type === 'ACTUARY'
          ? 'bg-primary-100 text-primary-800'
          : 'bg-purple-100 text-purple-800'
      }`}
    >
      {type === 'ACTUARY' ? 'Aktuar' : 'Klijent'}
    </span>
  )
}

// ─── Debt cell ────────────────────────────────────────────────────────────────

function DebtCell({ amount }: { amount: number }) {
  const formatted = amount.toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return (
    <span className={amount === 0 ? 'text-gray-400' : 'font-semibold text-gray-900'}>
      {formatted} RSD
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaxTrackingPage() {
  const { user, hasPermission } = useAuthStore()

  // Guard: only SUPERVISOR employees or ADMIN
  const isSupervisor = hasPermission('SUPERVISOR')
  const isAdmin = user?.userType === 'ADMIN'
  if (!isSupervisor && !isAdmin) {
    return <Navigate to={getHomeForRole(user?.userType)} replace />
  }

  const [records, setRecords] = useState<TaxRecord[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)

  const [filterFirstName, setFilterFirstName] = useState('')
  const [filterLastName, setFilterLastName] = useState('')
  const [typeFilter, setTypeFilter] = useState<UserTypeFilter>('ALL')

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [calculating, setCalculating] = useState(false)

  // ─── Load data ──────────────────────────────────────────────────────────────

  async function loadData() {
    setLoading(true)
    try {
      const [taxRes, clientsRes, agentsRes] = await Promise.all([
        getTaxUsers({
          firstName: filterFirstName.trim() || undefined,
          lastName: filterLastName.trim() || undefined,
        }),
        getClients({ limit: 1000 }),
        getAgents({}),
      ])

      // Build name lookup maps keyed by string ID
      const clientMap = new Map<string, string>()
      for (const c of clientsRes.clients) {
        clientMap.set(c.id, `${c.first_name} ${c.last_name}`)
      }

      const agentMap = new Map<string, string>()
      for (const a of agentsRes.agents) {
        agentMap.set(a.employee_id, `${a.first_name} ${a.last_name}`)
      }

      const enriched: TaxRecord[] = taxRes.users.map((u: TaxUserRecord) => {
        const ut = u.userType as UserType
        const fromApi = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
        let displayName: string
        if (fromApi) {
          displayName = fromApi
        } else if (ut === 'CLIENT') {
          displayName = clientMap.get(u.userId) ?? `Klijent #${u.userId}`
        } else {
          displayName = agentMap.get(u.userId) ?? `Aktuar #${u.userId}`
        }
        return {
          userId: u.userId,
          displayName,
          userType: ut,
          taxDebt: u.taxDebt,
        }
      })

      setRecords(enriched)
      setTotalUsers(enriched.length)
    } catch {
      toast.error('Greška pri učitavanju poreskih dugovanja.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filterFirstName, filterLastName])

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== 'ALL' && r.userType !== typeFilter) return false
      return true
    })
  }, [records, typeFilter])

  const totalDebt = useMemo(
    () => filtered.reduce((sum, r) => sum + r.taxDebt, 0),
    [filtered]
  )

  // ─── Tax calculation ────────────────────────────────────────────────────────

  const handleConfirmCalculation = async () => {
    setCalculating(true)
    try {
      const result = await calculateAndCollectTax()
      setConfirmOpen(false)
      toast.success(
        result.message ||
          `Obračun završen. Obrađeno ${result.processedUsers} korisnika.`
      )
      // Reload to show updated debts
      await loadData()
    } catch {
      toast.error('Greška pri pokretanju obračuna poreza.')
    } finally {
      setCalculating(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Porez Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pregled poreskih dugovanja korisnika po osnovu trgovine hartijama od vrednosti
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Calculator className="h-4 w-4" />}
          onClick={() => setConfirmOpen(true)}
        >
          Pokreni obračun poreza
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Ime (server filter)"
            value={filterFirstName}
            onChange={(e) => setFilterFirstName(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          />
        </div>
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Prezime (server filter)"
            value={filterLastName}
            onChange={(e) => setFilterLastName(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as UserTypeFilter)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="ALL">Svi korisnici</option>
          <option value="CLIENT">Klijenti</option>
          <option value="ACTUARY">Aktuari</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {records.length === 0
              ? 'Nema evidentiranih poreskih dugovanja.'
              : 'Nema korisnika koji odgovaraju zadatom filteru.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <Th>Ime i prezime</Th>
                    <Th>Tip korisnika</Th>
                    <Th right>Trenutno dugovanje</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((record) => (
                    <tr key={record.userId} className="hover:bg-gray-50 transition-colors">
                      <Td>
                        <span className="font-medium text-gray-900">
                          {record.displayName}
                        </span>
                      </Td>
                      <Td>
                        <UserTypeBadge type={record.userType} />
                      </Td>
                      <Td right>
                        <DebtCell amount={record.taxDebt} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer: count + total */}
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center justify-between text-xs text-gray-500">
              <span>Prikazano {filtered.length} od {totalUsers} korisnika</span>
              <span>
                Ukupno dugovanje:{' '}
                <span className="font-semibold text-gray-800">
                  {totalDebt.toLocaleString('sr-RS', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  RSD
                </span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => !calculating && setConfirmOpen(false)}
        title="Pokreni obračun poreza"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {calculating ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-gray-600">Obračun poreza je u toku…</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Da li ste sigurni da želite da pokrenete obračun poreza za sve korisnike?
                Ova akcija će izračunati i primeniti poreska dugovanja na osnovu
                trenutnih transakcija.
              </p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <strong>Napomena:</strong> Ova akcija nije reverzibilna. Proverite da li su
                svi nalozi obrađeni pre pokretanja obračuna.
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmOpen(false)}
                >
                  Odustani
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Calculator className="h-4 w-4" />}
                  onClick={handleConfirmCalculation}
                >
                  Pokreni obračun
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  )
}
