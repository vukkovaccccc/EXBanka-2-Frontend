import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, UserCheck } from 'lucide-react'
import Dialog from '@/components/common/Dialog'
import {
  getPaymentRecipients,
  createPaymentRecipient,
  updatePaymentRecipient,
  deletePaymentRecipient,
} from '@/services/paymentService'
import type { PaymentRecipient } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateForm(naziv: string, brojRacuna: string): string | null {
  if (!naziv.trim()) return 'Naziv ne sme biti prazan.'
  if (brojRacuna.length < 10 || brojRacuna.length > 18) return 'Broj računa mora imati između 10 i 18 cifara.'
  if (!/^\d+$/.test(brojRacuna)) return 'Broj računa sme sadržati samo cifre.'
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrimaociPage() {
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createNaziv, setCreateNaziv] = useState('')
  const [createBroj, setCreateBroj] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<PaymentRecipient | null>(null)
  const [editNaziv, setEditNaziv] = useState('')
  const [editBroj, setEditBroj] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecipient | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    loadRecipients()
  }, [])

  function loadRecipients() {
    setLoading(true)
    setError(null)
    getPaymentRecipients()
      .then(setRecipients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  function openCreate() {
    setCreateNaziv('')
    setCreateBroj('')
    setCreateError(null)
    setCreateOpen(true)
  }

  async function handleCreate() {
    const err = validateForm(createNaziv, createBroj)
    if (err) { setCreateError(err); return }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const r = await createPaymentRecipient(createNaziv.trim(), createBroj.trim())
      setRecipients((prev) => [...prev, r])
      setCreateOpen(false)
    } catch (e: unknown) {
      setCreateError((e as Error).message)
    } finally {
      setCreateLoading(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(r: PaymentRecipient) {
    setEditTarget(r)
    setEditNaziv(r.naziv)
    setEditBroj(r.broj_racuna)
    setEditError(null)
  }

  async function handleEdit() {
    if (!editTarget) return
    const err = validateForm(editNaziv, editBroj)
    if (err) { setEditError(err); return }
    setEditLoading(true)
    setEditError(null)
    try {
      const updated = await updatePaymentRecipient(editTarget.id, editNaziv.trim(), editBroj.trim())
      setRecipients((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setEditTarget(null)
    } catch (e: unknown) {
      setEditError((e as Error).message)
    } finally {
      setEditLoading(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function openDelete(r: PaymentRecipient) {
    setDeleteTarget(r)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await deletePaymentRecipient(deleteTarget.id)
      setRecipients((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e: unknown) {
      setDeleteError((e as Error).message)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Primaoci plaćanja</h1>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> Dodaj primaoca
        </button>
      </div>

      {error && <div className="card bg-red-50 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="card text-center py-10 text-gray-400">Učitavanje…</div>
      ) : recipients.length === 0 ? (
        <div className="card text-center py-10">
          <UserCheck className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Nemate sačuvanih primalaca.</p>
          <p className="text-gray-400 text-xs mt-1">Dodajte primaoca klikom na dugme "Dodaj primaoca".</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 p-0">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{r.naziv}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{r.broj_racuna}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(r)}
                  className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                  title="Izmeni"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openDelete(r)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Obriši"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Dodaj primaoca" maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naziv primaoca</label>
            <input
              className="input w-full"
              value={createNaziv}
              onChange={(e) => setCreateNaziv(e.target.value)}
              placeholder="npr. Marko Marković"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Broj računa (10–18 cifara)</label>
            <input
              className="input w-full font-mono"
              value={createBroj}
              onChange={(e) => setCreateBroj(e.target.value.replace(/\D/g, '').slice(0, 18))}
              placeholder="npr. 1234567890123456"
              inputMode="numeric"
            />
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-secondary">Otkaži</button>
            <button type="button" onClick={handleCreate} disabled={createLoading} className="btn btn-primary">
              {createLoading ? 'Dodavanje…' : 'Dodaj'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Izmeni primaoca" maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naziv primaoca</label>
            <input
              className="input w-full"
              value={editNaziv}
              onChange={(e) => setEditNaziv(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Broj računa</label>
            <input
              className="input w-full font-mono"
              value={editBroj}
              onChange={(e) => setEditBroj(e.target.value.replace(/\D/g, '').slice(0, 18))}
              inputMode="numeric"
            />
          </div>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditTarget(null)} className="btn btn-secondary">Otkaži</button>
            <button type="button" onClick={handleEdit} disabled={editLoading} className="btn btn-primary">
              {editLoading ? 'Čuvanje…' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Obriši primaoca" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Da li ste sigurni da želite da obrišete primaoca{' '}
            <span className="font-semibold">{deleteTarget?.naziv}</span>?
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-secondary" disabled={deleteLoading}>
              Otkaži
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="btn bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? 'Brisanje…' : 'Obriši'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
