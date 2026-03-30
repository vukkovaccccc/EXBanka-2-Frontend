import { describe, it, expect } from 'vitest'
import {
  convertLocally,
  formatRate,
  formatNum,
  FALLBACK_RATES,
} from './exchangeRatesFallback'

// ─── convertLocally ────────────────────────────────────────────────────────────

describe('convertLocally', () => {
  it('vraca isti iznos bez provizije kada su valute iste', () => {
    const result = convertLocally(100, 'EUR', 'EUR')
    expect(result).not.toBeNull()
    expect(result!.result).toBe(100)
    expect(result!.provizija).toBe(0)
    expect(result!.bruto).toBe(100)
    expect(result!.viaRSD).toBe(false)
  })

  it('konvertuje RSD u stranu valutu po prodajnom kursu', () => {
    const eurRate = FALLBACK_RATES.find((r) => r.oznaka === 'EUR')!
    const result = convertLocally(1000, 'RSD', 'EUR')
    expect(result).not.toBeNull()
    const bruto = 1000 / eurRate.prodajni
    const provizija = bruto * 0.005
    expect(result!.bruto).toBeCloseTo(bruto, 10)
    expect(result!.provizija).toBeCloseTo(provizija, 10)
    expect(result!.result).toBeCloseTo(bruto - provizija, 10)
    expect(result!.viaRSD).toBe(false)
  })

  it('konvertuje stranu valutu u RSD po kupovnom kursu', () => {
    const eurRate = FALLBACK_RATES.find((r) => r.oznaka === 'EUR')!
    const result = convertLocally(100, 'EUR', 'RSD')
    expect(result).not.toBeNull()
    const bruto = 100 * eurRate.kupovni
    const provizija = bruto * 0.005
    expect(result!.bruto).toBeCloseTo(bruto, 10)
    expect(result!.provizija).toBeCloseTo(provizija, 10)
    expect(result!.result).toBeCloseTo(bruto - provizija, 10)
    expect(result!.viaRSD).toBe(false)
  })

  it('konvertuje stranu valutu u drugu stranu valutu via RSD', () => {
    const eurRate = FALLBACK_RATES.find((r) => r.oznaka === 'EUR')!
    const usdRate = FALLBACK_RATES.find((r) => r.oznaka === 'USD')!
    const result = convertLocally(100, 'EUR', 'USD')
    expect(result).not.toBeNull()
    const rsdAmount = 100 * eurRate.kupovni
    const bruto = rsdAmount / usdRate.prodajni
    const provizija = bruto * 0.005
    expect(result!.viaRSD).toBe(true)
    expect(result!.bruto).toBeCloseTo(bruto, 10)
    expect(result!.provizija).toBeCloseTo(provizija, 10)
    expect(result!.result).toBeCloseTo(bruto - provizija, 10)
  })

  it('vraca null kada izlazna valuta nije u listi (RSD->nepostojeca)', () => {
    const result = convertLocally(100, 'RSD', 'XYZ')
    expect(result).toBeNull()
  })

  it('vraca null kada ulazna valuta nije u listi (nepostojeca->RSD)', () => {
    const result = convertLocally(100, 'XYZ', 'RSD')
    expect(result).toBeNull()
  })

  it('vraca null kada ni jedna od kriznih valuta nije u listi', () => {
    const result = convertLocally(100, 'ABC', 'XYZ')
    expect(result).toBeNull()
  })

  it('vraca null kada je fromOznaka u kriznoj konverziji nepoznata', () => {
    // EUR->CHF ali CHF je valida; testiramo ABC->CHF
    const result = convertLocally(100, 'ABC', 'CHF')
    expect(result).toBeNull()
  })

  it('koristi prosledjene rates umesto FALLBACK_RATES', () => {
    const customRates = [
      { oznaka: 'EUR', naziv: 'Euro', kupovni: 100, srednji: 100, prodajni: 100 },
      { oznaka: 'USD', naziv: 'Dolar', kupovni: 50, srednji: 50, prodajni: 50 },
    ]
    const result = convertLocally(100, 'RSD', 'USD', customRates)
    expect(result).not.toBeNull()
    // bruto = 100 / 50 = 2; provizija = 2 * 0.005 = 0.01
    expect(result!.bruto).toBeCloseTo(2, 10)
  })

  it('result je 0 (ne negativan) kada je iznos 0', () => {
    const result = convertLocally(0, 'EUR', 'RSD')
    expect(result).not.toBeNull()
    expect(result!.result).toBeGreaterThanOrEqual(0)
  })
})

// ─── formatRate ───────────────────────────────────────────────────────────────

describe('formatRate', () => {
  it('formatuje vrednost >= 1 sa 2 decimale', () => {
    const formatted = formatRate(117.5)
    expect(formatted).toContain('117')
    // Serbian locale uses comma
    expect(formatted.replace(',', '.')).toMatch(/117\.50$/)
  })

  it('formatuje vrednost < 1 sa 4 decimale (npr. JPY)', () => {
    const formatted = formatRate(0.69)
    // Should have 4 decimal places
    expect(formatted.replace(',', '.')).toMatch(/0\.6900$/)
  })

  it('formatuje vrednost tacno 1 sa 2 decimale', () => {
    const formatted = formatRate(1)
    expect(formatted.replace(',', '.')).toMatch(/1\.00$/)
  })
})

// ─── formatNum ────────────────────────────────────────────────────────────────

describe('formatNum', () => {
  it('vraca "0,00" za 0', () => {
    expect(formatNum(0)).toBe('0,00')
  })

  it('formatuje obican broj sa 2 decimale', () => {
    const formatted = formatNum(1234.56)
    expect(formatted).toContain('1')
    expect(formatted.replace(/\./g, '').replace(',', '.')).toMatch(/1234\.56$/)
  })

  it('formatuje mali broj (< 0.1) sa 4 decimale', () => {
    const formatted = formatNum(0.05)
    expect(formatted.replace(',', '.')).toMatch(/0\.0500$/)
  })

  it('formatuje veoma mali broj (< 0.001) sa 6 decimala', () => {
    const formatted = formatNum(0.0005)
    expect(formatted.replace(',', '.')).toMatch(/0\.000500$/)
  })

  it('formatuje negativan broj', () => {
    const formatted = formatNum(-100.5)
    expect(formatted).toContain('-')
    expect(formatted).toContain('100')
  })
})
