import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DatePickerField from './DatePickerField'

function Harness({ initial = '15/10/2026', max = '2026-11-08', onChange = () => {} }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DatePickerField
        label="Fecha"
        name="date"
        value={value}
        max={max}
        onChange={(text) => {
          setValue(text)
          onChange(text)
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

function openCalendar(user) {
  return user.click(screen.getByRole('button', { name: 'Abrir calendario' }))
}

describe('DatePickerField (027, FR-010)', () => {
  it('muestra el valor en dd/mm/aaaa y el calendario cerrado', () => {
    render(<Harness />)

    expect(screen.getByLabelText('Fecha')).toHaveValue('15/10/2026')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el ícono abre el calendario en el mes del valor, con el día elegido enfocado', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openCalendar(user)

    const dialog = screen.getByRole('dialog', { name: 'Elegir fecha' })
    expect(within(dialog).getByText('octubre 2026')).toBeInTheDocument()
    const selected = within(dialog).getByRole('button', { name: '15 de octubre de 2026' })
    expect(selected).toHaveFocus()
    expect(selected.closest('td')).toHaveAttribute('aria-selected', 'true')
    // La semana empieza el lunes: el 1/10/2026 es jueves (cuarta columna).
    const firstRow = within(dialog).getAllByRole('row')[1]
    expect(within(firstRow).getAllByRole('cell')[3]).toHaveTextContent('1')
  })

  it('las flechas de mes cambian de mes sin sacar el foco del botón', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openCalendar(user)
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))

    expect(screen.getByText('septiembre 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByText('noviembre 2026')).toBeInTheDocument()
  })

  it('no se puede ir más allá del mes de max ni elegir días posteriores', async () => {
    const user = userEvent.setup()
    render(<Harness initial="05/11/2026" />)

    await openCalendar(user)

    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '9 de noviembre de 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '8 de noviembre de 2026' })).toBeEnabled()
  })

  it('elegir un día completa el campo, cierra y devuelve el foco al ícono', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)

    await openCalendar(user)
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: '3 de septiembre de 2026' }))

    expect(onChange).toHaveBeenLastCalledWith('03/09/2026')
    expect(screen.getByTestId('value')).toHaveTextContent('03/09/2026')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toHaveFocus()
  })

  it('con teclado: flechas mueven el día, AvPág/RePág cambian de mes y Enter elige', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openCalendar(user)
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: '16 de octubre de 2026' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: '23 de octubre de 2026' })).toHaveFocus()

    await user.keyboard('{ArrowUp}{ArrowLeft}')
    expect(screen.getByRole('button', { name: '15 de octubre de 2026' })).toHaveFocus()

    await user.keyboard('{PageUp}')
    expect(screen.getByText('septiembre 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '15 de septiembre de 2026' })).toHaveFocus()

    await user.keyboard('{PageDown}{PageDown}')
    // Noviembre: el 15 es posterior a max (8/11), así que el foco queda en max.
    expect(screen.getByRole('button', { name: '8 de noviembre de 2026' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByTestId('value')).toHaveTextContent('08/11/2026')
  })

  it('Escape cierra el calendario sin cambiar el valor y devuelve el foco', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openCalendar(user)
    await user.keyboard('{ArrowRight}{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('value')).toHaveTextContent('15/10/2026')
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toHaveFocus()
  })

  it('un clic fuera o un segundo clic en el ícono cierra el calendario', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openCalendar(user)
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await openCalendar(user)
    await openCalendar(user)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('se puede seguir tipeando la fecha a mano', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Fecha'), '05/10/2026')

    expect(onChange).toHaveBeenLastCalledWith('05/10/2026')
  })

  it('con un valor inválido abre en el mes actual (acotado a max) y muestra el error recibido', async () => {
    const user = userEvent.setup()
    render(<DatePickerField label="Fecha" value="31/02/2026" max="2000-01-31" error="Fecha inválida" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Fecha inválida')
    expect(screen.getByLabelText('Fecha')).toHaveAttribute('aria-invalid', 'true')

    await openCalendar(user)
    expect(screen.getByText('enero 2000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '31 de enero de 2000' })).toHaveFocus()
  })
})
