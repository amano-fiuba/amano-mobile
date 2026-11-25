import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useCurrentDate, {
  UPDATE_INTERVAL_MS,
  currentDateIn,
  deviceTimeZone,
} from './useCurrentDate'

const ZONE = 'America/Argentina/Buenos_Aires'

beforeEach(() => {
  vi.useFakeTimers()
  // 2026-10-21T02:59:30Z → 2026-10-20 23:59:30 in Buenos Aires (UTC-3).
  vi.setSystemTime(new Date('2026-10-21T02:59:30Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCurrentDate (T026)', () => {
  it('devuelve el día de la zona indicada y lo formatea dd/mm/aaaa', () => {
    const { result } = renderHook(() => useCurrentDate({ timeZone: ZONE }))

    expect(result.current.today).toBe('20/10/2026')
    expect(result.current.timeZone).toBe(ZONE)
    expect(currentDateIn(ZONE)).toBe('20/10/2026')
  })

  it('se actualiza al cruzar la medianoche con el intervalo de 30 s', () => {
    const { result } = renderHook(() => useCurrentDate({ timeZone: ZONE }))

    act(() => {
      vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    })

    expect(result.current.today).toBe('21/10/2026')
  })

  it('se actualiza al volver a la pestaña (visibilitychange)', () => {
    const { result } = renderHook(() => useCurrentDate({ timeZone: ZONE }))
    vi.setSystemTime(new Date('2026-10-22T03:00:00Z'))

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.today).toBe('22/10/2026')
  })

  it('solo reemplaza el valor si shouldUpdate lo permite', () => {
    let canUpdate = false
    const shouldUpdate = vi.fn(() => canUpdate)
    const { result } = renderHook(() => useCurrentDate({ timeZone: ZONE, shouldUpdate }))

    act(() => {
      vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    })
    expect(result.current.today).toBe('20/10/2026')

    canUpdate = true
    act(() => {
      vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    })
    expect(result.current.today).toBe('21/10/2026')
  })

  it('expone la zona del dispositivo con fallback no vacío', () => {
    expect(typeof deviceTimeZone()).toBe('string')
    expect(deviceTimeZone().length).toBeGreaterThan(0)
  })
})
