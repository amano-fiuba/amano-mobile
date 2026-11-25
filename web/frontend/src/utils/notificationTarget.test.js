import { describe, expect, it, vi } from 'vitest'
import {
  MARK_READ_ERROR_MESSAGE,
  MISSING_TARGET_MESSAGE,
  openNotification,
  resolveNotificationTarget,
} from './notificationTarget'

const notice = (type, target) => ({ id: 3, type, target })

describe('resolveNotificationTarget (035 FR-017..FR-020)', () => {
  it('envía los avisos de grupo a la vista del grupo', () => {
    expect(resolveNotificationTarget(notice('GROUP_EXPENSE', { kind: 'GROUP', groupId: 42 })))
      .toEqual({ path: '/groups/42', missingTarget: false })
  })

  it('envía las deudas de grupo a la pestaña de deudas con el id de la deuda', () => {
    expect(resolveNotificationTarget(notice('DEBT_OVERDUE', { kind: 'DEBT', groupId: 42, debtId: 9 })))
      .toEqual({ path: '/groups/42/debts?debt=9', missingTarget: false })
  })

  it('usa la actividad personal para deudas sin grupo', () => {
    expect(resolveNotificationTarget(notice('PAYMENT_RECORDED', { kind: 'DEBT', debtId: 9 })))
      .toEqual({ path: '/activity?debt=9', missingTarget: false })
  })

  it('envía las solicitudes de amistad a /friends', () => {
    expect(resolveNotificationTarget(notice('FRIEND_REQUEST', { kind: 'FRIEND_REQUEST' })))
      .toEqual({ path: '/friends', missingTarget: false })
  })

  it('marca como faltantes los destinos NONE o incompletos y elige una sección general', () => {
    expect(resolveNotificationTarget(notice('FRIEND_ACTIVITY', { kind: 'NONE' })))
      .toEqual({ path: '/friends', missingTarget: true })
    expect(resolveNotificationTarget(notice('DEBT_WHISTLE', { kind: 'DEBT' })))
      .toEqual({ path: '/groups', missingTarget: true })
  })
})

describe('openNotification (035 FR-016, FR-019, FR-022)', () => {
  it('marca como leída antes de navegar', async () => {
    const markRead = vi.fn().mockResolvedValue({ ok: true })
    const navigate = vi.fn()
    const notify = vi.fn()

    const opened = await openNotification(
      notice('GROUP_EXPENSE', { kind: 'GROUP', groupId: 42 }),
      { navigate, markRead, notify },
    )

    expect(opened).toBe(true)
    expect(markRead).toHaveBeenCalledWith(3)
    expect(navigate).toHaveBeenCalledWith('/groups/42')
    expect(notify).not.toHaveBeenCalled()
  })

  it('no navega si falla el marcado y avisa en español', async () => {
    const navigate = vi.fn()
    const notify = vi.fn()

    const opened = await openNotification(notice('FRIEND_REQUEST', { kind: 'FRIEND_REQUEST' }), {
      navigate,
      markRead: vi.fn().mockResolvedValue({ ok: false }),
      notify,
    })

    expect(opened).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(MARK_READ_ERROR_MESSAGE, 4000)
  })

  it('navega a la sección general y avisa si el recurso ya no existe', async () => {
    const notify = vi.fn()
    const navigate = vi.fn()

    await openNotification(notice('GROUP_EXPENSE', { kind: 'NONE' }), {
      navigate,
      markRead: vi.fn().mockResolvedValue({ ok: true }),
      notify,
    })

    expect(navigate).toHaveBeenCalledWith('/groups')
    expect(notify).toHaveBeenCalledWith(MISSING_TARGET_MESSAGE, 4000)
  })
})
