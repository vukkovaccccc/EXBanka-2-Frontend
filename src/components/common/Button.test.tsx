import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from './Button'

describe('Button', () => {
  it('renderuje tekst dugmeta', () => {
    render(<Button>Klikni me</Button>)
    expect(screen.getByRole('button', { name: 'Klikni me' })).toBeInTheDocument()
  })

  it('poziva onClick kada se klikne', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Klikni</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled kada je disabled prop true', () => {
    render(<Button disabled>Dugme</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disabled kada je loading true', () => {
    render(<Button loading>Dugme</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('prikazuje loading spinner umesto leftIcon kada je loading=true', () => {
    const leftIcon = <span data-testid="left-icon">icon</span>
    render(<Button loading leftIcon={leftIcon}>Dugme</Button>)
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
  })

  it('prikazuje leftIcon kada loading=false', () => {
    const leftIcon = <span data-testid="left-icon">icon</span>
    render(<Button leftIcon={leftIcon}>Dugme</Button>)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('prikazuje rightIcon kada loading=false', () => {
    const rightIcon = <span data-testid="right-icon">icon</span>
    render(<Button rightIcon={rightIcon}>Dugme</Button>)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('ne prikazuje rightIcon kada loading=true', () => {
    const rightIcon = <span data-testid="right-icon">icon</span>
    render(<Button loading rightIcon={rightIcon}>Dugme</Button>)
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
  })

  it('primenjuje dodatnu className', () => {
    render(<Button className="test-class">Dugme</Button>)
    expect(screen.getByRole('button')).toHaveClass('test-class')
  })

  it('prosledjuje ostale HTML atribute dugmetu', () => {
    render(<Button type="submit" data-testid="submit-btn">Posalji</Button>)
    expect(screen.getByTestId('submit-btn')).toHaveAttribute('type', 'submit')
  })

  it('ne poziva onClick kada je disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Dugme</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
