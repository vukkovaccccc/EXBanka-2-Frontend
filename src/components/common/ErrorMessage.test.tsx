import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorMessage from './ErrorMessage'

describe('ErrorMessage', () => {
  it('prikazuje tekst greske', () => {
    render(<ErrorMessage message="Doslo je do greske" />)
    expect(screen.getByText('Doslo je do greske')).toBeInTheDocument()
  })

  it('ima role="alert" za pristupacnost', () => {
    render(<ErrorMessage message="Greska" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('prikazuje razlicite poruke greske', () => {
    const { rerender } = render(<ErrorMessage message="Prva greska" />)
    expect(screen.getByText('Prva greska')).toBeInTheDocument()

    rerender(<ErrorMessage message="Druga greska" />)
    expect(screen.getByText('Druga greska')).toBeInTheDocument()
    expect(screen.queryByText('Prva greska')).not.toBeInTheDocument()
  })
})
