import { describe, it, expect } from 'vitest'
import { mapGrpcError } from './grpcErrorMapper'
import { GrpcStatus } from '@/types'

describe('mapGrpcError', () => {
  it('UNAUTHENTICATED: vraca poruku o istekloj sesiji i isUnauthenticated=true', () => {
    const result = mapGrpcError(GrpcStatus.UNAUTHENTICATED)
    expect(result.isUnauthenticated).toBe(true)
    expect(result.isUnavailable).toBe(false)
    expect(result.message).toMatch(/sesija.*istekla/i)
  })

  it('UNAVAILABLE: vraca poruku o nedostupnom sistemu i isUnavailable=true', () => {
    const result = mapGrpcError(GrpcStatus.UNAVAILABLE)
    expect(result.isUnavailable).toBe(true)
    expect(result.isUnauthenticated).toBe(false)
    expect(result.message).toMatch(/nedostupan/i)
  })

  it('DEADLINE_EXCEEDED: takodje vraca isUnavailable=true', () => {
    const result = mapGrpcError(GrpcStatus.DEADLINE_EXCEEDED)
    expect(result.isUnavailable).toBe(true)
    expect(result.isUnauthenticated).toBe(false)
    expect(result.message).toMatch(/nedostupan/i)
  })

  it('PERMISSION_DENIED: vraca poruku o nedostatku ovlascenja', () => {
    const result = mapGrpcError(GrpcStatus.PERMISSION_DENIED)
    expect(result.isUnauthenticated).toBe(false)
    expect(result.isUnavailable).toBe(false)
    expect(result.message).toMatch(/ovla/i)
  })

  it('NOT_FOUND: vraca poruku o nepronadjenom resursu', () => {
    const result = mapGrpcError(GrpcStatus.NOT_FOUND)
    expect(result.message).toMatch(/pronađen|pronadjen/i)
  })

  it('ALREADY_EXISTS: vraca poruku o vec postojecem resursu', () => {
    const result = mapGrpcError(GrpcStatus.ALREADY_EXISTS)
    expect(result.message).toMatch(/već postoji|vec postoji/i)
  })

  it('INVALID_ARGUMENT: vraca rawMessage ako je prosledjen', () => {
    const result = mapGrpcError(GrpcStatus.INVALID_ARGUMENT, '  Pogrešan format JMBG  ')
    expect(result.message).toBe('Pogrešan format JMBG')
  })

  it('INVALID_ARGUMENT: vraca default poruku kada rawMessage nije prosledjen', () => {
    const result = mapGrpcError(GrpcStatus.INVALID_ARGUMENT)
    expect(result.message).toMatch(/podaci.*ispravni|uneseni/i)
  })

  it('INVALID_ARGUMENT: vraca default poruku kada je rawMessage prazan string', () => {
    const result = mapGrpcError(GrpcStatus.INVALID_ARGUMENT, '   ')
    expect(result.message).toMatch(/podaci.*ispravni|uneseni/i)
  })

  it('FAILED_PRECONDITION: vraca rawMessage ako je prosledjen', () => {
    const result = mapGrpcError(GrpcStatus.FAILED_PRECONDITION, 'Racun je blokiran')
    expect(result.message).toBe('Racun je blokiran')
  })

  it('FAILED_PRECONDITION: vraca default poruku bez rawMessage', () => {
    const result = mapGrpcError(GrpcStatus.FAILED_PRECONDITION)
    expect(result.message).toMatch(/zahtev|trenutnom stanju/i)
  })

  it('nepoznati kod: vraca genericku poruku o gresci', () => {
    const result = mapGrpcError(999)
    expect(result.isUnauthenticated).toBe(false)
    expect(result.isUnavailable).toBe(false)
    expect(result.message).toMatch(/greška|pokušajte/i)
  })

  it('OK (0): vraca genericku poruku (nije greska, ali se mapira)', () => {
    const result = mapGrpcError(GrpcStatus.OK)
    expect(result.isUnauthenticated).toBe(false)
    expect(result.isUnavailable).toBe(false)
  })
})
