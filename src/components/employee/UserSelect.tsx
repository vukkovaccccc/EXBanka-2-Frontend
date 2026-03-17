import React, { useState, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from 'react'
import { UserPlus, Search, X } from 'lucide-react'

import { searchClients } from '@/services/bankaService'
import type { ClientPreview } from '@/types'
import Dialog from '@/components/common/Dialog'
import CreateUserForm from './CreateUserForm'

const PAGE_SIZE = 20

interface UserSelectProps {
  value: ClientPreview | null
  onChange: (client: ClientPreview | null) => void
  label?: string
  error?: string
  required?: boolean
  onModalOpenChange?: (open: boolean) => void
}

export default function UserSelect({
  value,
  onChange,
  label = 'Klijent',
  error,
  required,
  onModalOpenChange,
}: UserSelectProps) {
  const inputRef      = useRef<HTMLInputElement>(null)
  const listRef       = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)
  const queryRef      = useRef('')
  const pageRef       = useRef(1)

  const [searchTerm, setSearchTerm] = useState('')
  const [options,    setOptions]    = useState<ClientPreview[]>([])
  const [hasMore,    setHasMore]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [isOpen,     setIsOpen]     = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // ── Core fetch ───────────────────────────────────────────────────────────────

  const doFetch = useCallback(async (query: string, page: number, replace: boolean) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    setLoading(true)
    try {
      const res = await searchClients({ query: query || undefined, page, limit: PAGE_SIZE })
      queryRef.current = query
      pageRef.current  = page
      setOptions((prev: ClientPreview[]) => (replace ? res.clients : [...prev, ...res.clients]))
      setHasMore(res.hasMore)
    } catch {
      // silently ignore search errors
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }, [])

  // ── Input handlers ───────────────────────────────────────────────────────────

  const handleFocus = () => {
    if (value) {
      onChange(null)
      if (inputRef.current) inputRef.current.value = ''
      setSearchTerm('')
      queryRef.current = ''
      pageRef.current  = 1
      setOptions([])
    }
    setIsOpen(true)
    // Auto-fetch all users when the dropdown opens
    doFetch('', 1, true)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Only update local state — API is NOT called until Enter or search button
    setSearchTerm(e.target.value)
    setIsOpen(true)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault() // prevent outer form submission
      doFetch(searchTerm, 1, true)
      setIsOpen(true)
    }
  }

  const handleSearchClick = () => {
    doFetch(searchTerm, 1, true)
    setIsOpen(true)
    inputRef.current?.focus()
  }

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 150)
  }

  // ── Selection / clear ────────────────────────────────────────────────────────

  const handleSelect = (client: ClientPreview) => {
    onChange(client)
    if (inputRef.current) {
      inputRef.current.value = `${client.first_name} ${client.last_name} (${client.email})`
    }
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
    setSearchTerm('')
    queryRef.current = ''
    pageRef.current  = 1
    setOptions([])
    setIsOpen(true)
    // Auto-fetch all users after clearing, same as on first open
    doFetch('', 1, true)
  }

  // ── Infinite scroll ──────────────────────────────────────────────────────────

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    if (nearBottom && hasMore && !isFetchingRef.current) {
      doFetch(queryRef.current, pageRef.current + 1, false)
    }
  }

  // ── Create user dialog ───────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setIsOpen(false)
    setCreateOpen(true)
    onModalOpenChange?.(true)
  }

  const closeCreateDialog = () => {
    setCreateOpen(false)
    onModalOpenChange?.(false)
  }

  const handleCreateSuccess = (newClient: ClientPreview) => {
    closeCreateDialog()
    handleSelect(newClient)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Pretraži klijenta..."
          autoComplete="off"
          className={`input-base pr-8 ${error ? 'input-error' : ''}`}
        />
        {value ? (
          <button
            type="button"
            onMouseDown={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Obriši izbor"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onMouseDown={handleSearchClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Pretraži"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Scrollable options list */}
          <div
            ref={listRef}
            onScroll={handleListScroll}
            className="max-h-56 overflow-y-auto"
          >
            {options.map((client) => (
              <button
                key={client.id}
                type="button"
                onMouseDown={() => handleSelect(client)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">
                  {client.first_name} {client.last_name}
                </span>
                <span className="text-gray-500 ml-1">({client.email})</span>
              </button>
            ))}

            {loading && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center animate-pulse">
                Učitavanje...
              </div>
            )}

            {!loading && options.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                Nema rezultata
              </div>
            )}
          </div>

          {/* "Create new user" action */}
          <div className="border-t border-gray-100">
            <button
              type="button"
              onMouseDown={openCreateDialog}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Kreiraj novog korisnika
            </button>
          </div>
        </div>
      )}

      {/* Create-user dialog (portal — outside main form DOM) */}
      <Dialog
        open={createOpen}
        onClose={closeCreateDialog}
        title="Kreiraj novog klijenta"
        maxWidth="md"
      >
        <CreateUserForm
          onSuccess={handleCreateSuccess}
          onCancel={closeCreateDialog}
        />
      </Dialog>
    </div>
  )
}
