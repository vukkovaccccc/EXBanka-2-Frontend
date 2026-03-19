import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { getClients } from '@/services/clientService'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import ErrorMessage from '@/components/common/ErrorMessage'
import type { Client } from '@/types'

const PAGE_LIMIT = 20

export default function ClientListPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nameFilter, setNameFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')

  // Track the active filters that were last submitted — so "Load more" uses them
  const activeFilters = useRef({ name: '', email: '' })

  const fetchClients = useCallback(async (name: string, email: string, currentOffset: number, append: boolean) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const res = await getClients({ name, email, limit: PAGE_LIMIT, offset: currentOffset })
      setClients((prev) => (append ? [...prev, ...res.clients] : res.clients))
      setHasMore(res.has_more)
      setOffset(currentOffset + res.clients.length)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Greška pri učitavanju liste klijenata.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    activeFilters.current = { name: '', email: '' }
    fetchClients('', '', 0, false)
  }, [fetchClients])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    activeFilters.current = { name: nameFilter, email: emailFilter }
    fetchClients(nameFilter, emailFilter, 0, false)
  }

  function handleLoadMore() {
    const { name, email } = activeFilters.current
    fetchClients(name, email, offset, true)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lista klijenata</h1>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="card mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Ime"
            placeholder="Pretraži po imenu"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@primer.com"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            leftIcon={<Search className="h-4 w-4" />}
          >
            Pretraži
          </Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <p className="font-medium">Nema rezultata za traženi kriterijum</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ime</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Prezime</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Telefon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/employee/clients/${client.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{client.first_name}</td>
                  <td className="px-4 py-3 text-gray-700">{client.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{client.email}</td>
                  <td className="px-4 py-3 text-gray-600">{client.phone_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            loading={loadingMore}
            onClick={handleLoadMore}
          >
            Učitaj još
          </Button>
        </div>
      )}
    </div>
  )
}
