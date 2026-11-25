import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SNACKBAR_VISIBLE_MS, SnackbarProvider, useSnackbar } from './Snackbar'

function Trigger() {
  const showSnackbar = useSnackbar()
  return (
    <>
      <button onClick={() => showSnackbar('Primero')}>primero</button>
      <button onClick={() => showSnackbar('Segundo')}>segundo</button>
    </>
  )
}

const renderTrigger = () =>
  render(
    <SnackbarProvider>
      <Trigger />
    </SnackbarProvider>,
  )

afterEach(() => {
  vi.useRealTimers()
})

describe('Snackbar', () => {
  it('no muestra nada hasta que se pide un aviso', () => {
    renderTrigger()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('se cierra sola al vencer el tiempo y un aviso nuevo lo reinicia', () => {
    vi.useFakeTimers()
    renderTrigger()

    act(() => screen.getByText('primero').click())
    act(() => {
      vi.advanceTimersByTime(SNACKBAR_VISIBLE_MS - 1)
    })
    act(() => screen.getByText('segundo').click())
    act(() => {
      vi.advanceTimersByTime(SNACKBAR_VISIBLE_MS - 1)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Segundo')
    expect(screen.queryByText('Primero')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('se puede cerrar a mano', async () => {
    const user = userEvent.setup()
    renderTrigger()

    await user.click(screen.getByText('primero'))
    await user.click(screen.getByRole('button', { name: 'Cerrar notificación' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sin provider pedir un aviso no falla', () => {
    function Probe() {
      useSnackbar()('Aviso')
      return <p>Montado</p>
    }

    render(<Probe />, { wrapper: undefined })

    expect(screen.getByText('Montado')).toBeInTheDocument()
  })
})
