import { useEffect, useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Users, RotateCcw, Pencil, Plus, SearchX } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import {
  getAgents,
  setAgentLimit,
  resetAgentUsedLimit,
  setAgentNeedApproval,
  createActuary,
} from '@/services/actuaryService'
import { listEmployees, getEmployeeById } from '@/services/employeeService'
import type { AgentListItem } from '@/types/actuary'
import type { Employee } from '@/types'
import Button from '@/components/common/Button'
import Dialog from '@/components/common/Dialog'

// ─── Enriched type ─────────────────────────────────────────────────────────────

interface EnrichedAgent extends AgentListItem {
  first_name: string
  last_name: string
  email: string
  position: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
        'whitespace-nowrap px-4 py-3 text-sm text-gray-800',
        right ? 'text-right' : '',
        mono ? 'font-mono text-xs' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}

// ─── Set Limit Dialog ──────────────────────────────────────────────────────────

interface SetLimitDialogProps {
  agent: EnrichedAgent | null
  onClose: () => void
  onSaved: (employeeId: string, newLimit: string) => void
}

function SetLimitDialog({ agent, onClose, onSaved }: SetLimitDialogProps) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(agent ? agent.limit : '')
  }, [agent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agent) return
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Unesite validan iznos limita (≥ 0).')
      return
    }
    setSaving(true)
    try {
      await setAgentLimit({ employee_id: agent.employee_id, limit: parsed })
      toast.success('Limit je uspešno ažuriran.')
      onSaved(agent.employee_id, String(parsed))
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Greška pri ažuriranju limita.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={agent !== null} onClose={onClose} title="Postavi limit agenta" maxWidth="sm">
      {agent && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Agent:{' '}
            <span className="font-medium text-gray-800">
              {agent.first_name} {agent.last_name}
            </span>
          </p>
          <div>
            <label className="form-label" htmlFor="limit-input">
              Novi dnevni limit (RSD)
            </label>
            <input
              id="limit-input"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input-base"
              placeholder="npr. 100000"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Otkaži
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Sačuvaj
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// ─── Create Actuary Dialog ─────────────────────────────────────────────────────

interface CreateActuaryDialogProps {
  open: boolean
  employees: Employee[]
  existingAgentIds: Set<string>
  onClose: () => void
  onCreated: () => void
}

function CreateActuaryDialog({
  open,
  employees,
  existingAgentIds,
  onClose,
  onCreated,
}: CreateActuaryDialogProps) {
  const [selectedId, setSelectedId] = useState('')
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedId('')
      setLimit('')
    }
  }, [open])

  const available = employees.filter(
    (e) => e.is_active && !existingAgentIds.has(e.id)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) {
      toast.error('Odaberite zaposlenog.')
      return
    }
    const parsedLimit = parseFloat(limit)
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      toast.error('Unesite validan iznos limita (≥ 0).')
      return
    }
    setSaving(true)
    try {
      await createActuary({ employee_id: selectedId, limit: parsedLimit })
      toast.success('Aktuar je uspešno kreiran.')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Greška pri kreiranju aktuara.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Novi aktuar" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label" htmlFor="employee-select">
            Zaposleni
          </label>
          <select
            id="employee-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input-base"
          >
            <option value="">— Odaberite zaposlenog —</option>
            {available.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} · {emp.email}
              </option>
            ))}
          </select>
          {available.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Nema dostupnih zaposlenih za dodavanje.
            </p>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="create-limit-input">
            Početni dnevni limit (RSD)
          </label>
          <input
            id="create-limit-input"
            type="number"
            min="0"
            step="0.01"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="input-base"
            placeholder="npr. 100000"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Otkaži
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={available.length === 0}>
            Kreiraj
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ActuaryManagement() {
  const { hasPermission } = useAuthStore()

  const [agents, setAgents]       = useState<EnrichedAgent[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Local filters
  const [filterEmail,     setFilterEmail]     = useState('')
  const [filterFirstName, setFilterFirstName] = useState('')
  const [filterLastName,  setFilterLastName]  = useState('')
  const [filterPosition,  setFilterPosition]  = useState('')

  // Pending action ids
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [togglingId,  setTogglingId]  = useState<string | null>(null)

  // Dialogs
  const [limitAgent,          setLimitAgent]          = useState<EnrichedAgent | null>(null)
  const [createDialogOpen,    setCreateDialogOpen]    = useState(false)
  const [employeesLoading,    setEmployeesLoading]    = useState(false)
  const [employeesLoaded,     setEmployeesLoaded]     = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const agentsRes = await getAgents()
      console.log('Actuary API Response:', agentsRes)

      // Enrich each agent with user-service data via GET /employee/{id}.
      // Supervisor now has permission for this endpoint; bank-service data is the
      // primary source — user-service fills in any fields left empty by bank-service.
      const enriched = await Promise.all(
        agentsRes.agents.map(async (agent): Promise<EnrichedAgent> => {
          if (agent.first_name && agent.email) {
            // bank-service already returned full data — no extra call needed
            return { ...agent }
          }
          try {
            const emp = await getEmployeeById({ id: agent.employee_id })
            return {
              ...agent,
              first_name: emp.first_name,
              last_name:  emp.last_name,
              email:      emp.email,
              position:   emp.position || agent.position,
            }
          } catch {
            // user-service lookup failed — render with whatever bank-service returned
            return { ...agent }
          }
        })
      )

      setAgents(enriched)
    } catch (err: unknown) {
      setError((err as Error).message || 'Greška pri učitavanju podataka.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasPermission('SUPERVISOR')) loadData()
  }, [])

  // Loaded lazily — only when the "Novi aktuar" modal is first opened.
  // listEmployees requires ADMIN; a 403 is caught and results in an empty dropdown.
  async function loadEmployeesOnce() {
    if (employeesLoaded || employeesLoading) return
    setEmployeesLoading(true)
    try {
      const res = await listEmployees({ page: 1, size: 1000 })
      setEmployees(res.employees)
    } catch {
      // 403 or other error — leave employees as [] so the dialog shows an empty list
    } finally {
      setEmployeesLoading(false)
      setEmployeesLoaded(true)
    }
  }

  function openCreateDialog() {
    setCreateDialogOpen(true)
    loadEmployeesOnce()
  }

  // ── Local filtering ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const email    = filterEmail.trim().toLowerCase()
    const first    = filterFirstName.trim().toLowerCase()
    const last     = filterLastName.trim().toLowerCase()
    const position = filterPosition.trim().toLowerCase()

    return agents.filter((a) => {
      if (email    && !a.email.toLowerCase().includes(email))         return false
      if (first    && !a.first_name.toLowerCase().includes(first))    return false
      if (last     && !a.last_name.toLowerCase().includes(last))      return false
      if (position && !a.position.toLowerCase().includes(position))   return false
      return true
    })
  }, [agents, filterEmail, filterFirstName, filterLastName, filterPosition])

  const existingAgentIds = useMemo(
    () => new Set(agents.map((a) => a.employee_id)),
    [agents]
  )

  // ── Permission guard (after all hooks) ────────────────────────────────────────

  if (!hasPermission('SUPERVISOR')) {
    return <Navigate to="/employee" replace />
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  function handleLimitSaved(employeeId: string, newLimit: string) {
    setAgents((prev) =>
      prev.map((a) => (a.employee_id === employeeId ? { ...a, limit: newLimit } : a))
    )
  }

  async function handleResetUsedLimit(agent: EnrichedAgent) {
    setResettingId(agent.employee_id)
    try {
      await resetAgentUsedLimit({ employee_id: agent.employee_id })
      setAgents((prev) =>
        prev.map((a) => (a.employee_id === agent.employee_id ? { ...a, used_limit: '0' } : a))
      )
      toast.success(`Utrošeni limit je resetovan za ${agent.first_name} ${agent.last_name}.`)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Greška pri resetovanju limita.')
    } finally {
      setResettingId(null)
    }
  }

  async function handleToggleNeedApproval(agent: EnrichedAgent) {
    const newValue = !agent.need_approval
    setTogglingId(agent.employee_id)
    try {
      await setAgentNeedApproval({ employee_id: agent.employee_id, need_approval: newValue })
      setAgents((prev) =>
        prev.map((a) =>
          a.employee_id === agent.employee_id ? { ...a, need_approval: newValue } : a
        )
      )
      toast.success(
        newValue
          ? 'Agent sada zahteva odobrenje supervizora.'
          : 'Agent više ne zahteva odobrenje supervizora.'
      )
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Greška pri promeni zastavice odobrenja.')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary-600 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900">Upravljanje aktuarima</h1>
          {!loading && (
            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-semibold">
              {agents.length} {agents.length === 1 ? 'agent' : 'agenata'}
            </span>
          )}
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={openCreateDialog}
          disabled={loading}
        >
          Novi aktuar
        </Button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="form-label">Email</label>
            <input
              type="text"
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              placeholder="Pretraži po email-u…"
              className="input-base"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="form-label">Ime</label>
            <input
              type="text"
              value={filterFirstName}
              onChange={(e) => setFilterFirstName(e.target.value)}
              placeholder="Pretraži po imenu…"
              className="input-base"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="form-label">Prezime</label>
            <input
              type="text"
              value={filterLastName}
              onChange={(e) => setFilterLastName(e.target.value)}
              placeholder="Pretraži po prezimenu…"
              className="input-base"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="form-label">Pozicija</label>
            <input
              type="text"
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              placeholder="Pretraži po poziciji…"
              className="input-base"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">Učitavanje agenata…</div>

      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-14 gap-3 text-center">
          <SearchX className="h-10 w-10 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {agents.length === 0
              ? 'Nema registrovanih agenata u sistemu.'
              : 'Nema agenata koji odgovaraju zadatim filterima.'}
          </p>
        </div>

      ) : (
        /* Table */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <Th>Ime</Th>
                  <Th>Prezime</Th>
                  <Th>Email</Th>
                  <Th>Pozicija</Th>
                  <Th right>Limit (RSD)</Th>
                  <Th right>Utrošeno (RSD)</Th>
                  <Th>Zahteva odobrenje</Th>
                  <Th right>Akcije</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((agent) => {
                  const busy = resettingId === agent.employee_id || togglingId === agent.employee_id
                  return (
                    <tr key={agent.employee_id} className="hover:bg-gray-50 transition-colors">
                      <Td>{agent.first_name || <span className="text-gray-400">—</span>}</Td>
                      <Td>{agent.last_name  || <span className="text-gray-400">—</span>}</Td>
                      <Td mono>{agent.email || <span className="text-gray-400">—</span>}</Td>
                      <Td>{agent.position   || <span className="text-gray-400">—</span>}</Td>
                      <Td right>
                        <span className="font-semibold text-primary-700">
                          {parseFloat(agent.limit).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}
                        </span>
                      </Td>
                      <Td right>
                        {parseFloat(agent.used_limit).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            agent.need_approval
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {agent.need_approval ? 'Da' : 'Ne'}
                        </span>
                      </Td>
                      <Td right>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => setLimitAgent(agent)}
                            leftIcon={<Pencil className="h-3.5 w-3.5" />}
                          >
                            Limit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={resettingId === agent.employee_id}
                            disabled={busy}
                            onClick={() => handleResetUsedLimit(agent)}
                            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                          >
                            Resetuj
                          </Button>
                          <Button
                            variant={agent.need_approval ? 'primary' : 'ghost'}
                            size="sm"
                            loading={togglingId === agent.employee_id}
                            disabled={busy}
                            onClick={() => handleToggleNeedApproval(agent)}
                          >
                            {agent.need_approval ? 'Ukini odobrenje' : 'Zahtevaj odobrenje'}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400">
            Prikazano {filtered.length} od {agents.length} agenata
          </div>
        </div>
      )}

      {/* Set Limit Dialog */}
      <SetLimitDialog
        agent={limitAgent}
        onClose={() => setLimitAgent(null)}
        onSaved={handleLimitSaved}
      />

      {/* Create Actuary Dialog */}
      <CreateActuaryDialog
        open={createDialogOpen}
        employees={employees}
        existingAgentIds={existingAgentIds}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={loadData}
      />

    </div>
  )
}
