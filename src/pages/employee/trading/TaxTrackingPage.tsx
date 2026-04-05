import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Calculator, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { getHomeForRole } from '@/router/helpers'
import Button from '@/components/common/Button'
import Dialog from '@/components/common/Dialog'
import LoadingSpinner from '@/components/common/LoadingSpinner'

// ─── Mock data ────────────────────────────────────────────────────────────────

type UserType = 'CLIENT' | 'ACTUARY'

interface TaxRecord {
  id: string
  firstName: string
  lastName: string
  userType: UserType
  taxDebt: number  // RSD
}

const MOCK_TAX_RECORDS: TaxRecord[] = [
  { id: '1',  firstName: 'Marko',    lastName: 'Petrović',  userType: 'CLIENT',  taxDebt: 142_500 },
  { id: '2',  firstName: 'Jelena',   lastName: 'Nikolić',   userType: 'CLIENT',  taxDebt: 87_300 },
  { id: '3',  firstName: 'Stefan',   lastName: 'Jovanović', userType: 'ACTUARY', taxDebt: 315_200 },
  { id: '4',  firstName: 'Ana',      lastName: 'Đorđević',  userType: 'CLIENT',  taxDebt: 0 },
  { id: '5',  firstName: 'Nikola',   lastName: 'Stanković', userType: 'ACTUARY', taxDebt: 229_750 },
  { id: '6',  firstName: 'Milica',   lastName: 'Popović',   userType: 'CLIENT',  taxDebt: 56_000 },
  { id: '7',  firstName: 'Aleksandar', lastName: 'Ilić',    userType: 'ACTUARY', taxDebt: 478_900 },
  { id: '8',  firstName: 'Ivana',    lastName: 'Marković',  userType: 'CLIENT',  taxDebt: 193_600 },
  { id: '9',  firstName: 'Luka',     lastName: 'Lazarević', userType: 'CLIENT',  taxDebt: 11_250 },
  { id: '10', firstName: 'Maja',     lastName: 'Savić',     userType: 'ACTUARY', taxDebt: 0 },
]

// ─── Simulated tax calculation API ───────────────────────────────────────────

// TODO: Wire up to real Tax API
async function runTaxCalculation(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2000))
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

type UserTypeFilter = 'ALL' | UserType

export default function TaxTrackingPage() {
  const { user, hasPermission } = useAuthStore()

  // Guard: only SUPERVISOR employees or ADMIN
  const isSupervisor = hasPermission('SUPERVISOR')
  const isAdmin = user?.userType === 'ADMIN'
  if (!isSupervisor && !isAdmin) {
    return <Navigate to={getHomeForRole(user?.userType)} replace />
  }

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<UserTypeFilter>('ALL')

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return MOCK_TAX_RECORDS.filter((r) => {
      if (typeFilter !== 'ALL' && r.userType !== typeFilter) return false
      if (term) {
        const full = `${r.firstName} ${r.lastName}`.toLowerCase()
        if (!full.includes(term)) return false
      }
      return true
    })
  }, [search, typeFilter])

  const totalDebt = useMemo(
    () => filtered.reduce((sum, r) => sum + r.taxDebt, 0),
    [filtered]
  )

  const handleConfirmCalculation = async () => {
    setCalculating(true)
    try {
      await runTaxCalculation()
      setConfirmOpen(false)
      toast.success('Obračun poreza uspešno pokrenut.')
    } catch {
      toast.error('Greška pri pokretanju obračuna poreza.')
    } finally {
      setCalculating(false)
    }
  }

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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Pretraži po imenu ili prezimenu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Nema korisnika koji odgovaraju zadatom filteru.
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
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <Td>
                        <span className="font-medium text-gray-900">
                          {record.firstName} {record.lastName}
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
              <span>Prikazano {filtered.length} od {MOCK_TAX_RECORDS.length} korisnika</span>
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
