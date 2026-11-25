import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GroupChooserDialog, {
  CANNOT_CREATE_IN_GROUP,
  NO_GROUP_MATCHES_MESSAGE,
  NO_GROUPS_MESSAGE,
} from './GroupChooserDialog'

const { listGroups } = vi.hoisted(() => ({ listGroups: vi.fn() }))
vi.mock('../api/groupsClient', async (importOriginal) => ({ ...(await importOriginal()), listGroups }))

const GROUPS = [
  { id: 3, name: 'Depto Palermo', photo: '/api/groups/3/photo', memberCount: 4, canCreateExpenses: true },
  { id: 8, name: 'Viaje a Córdoba', photo: null, memberCount: 1, canCreateExpenses: true },
  { id: 9, name: 'Consorcio', photo: null, memberCount: 12, canCreateExpenses: false },
]

function renderDialog() {
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<GroupChooserDialog onClose={onClose} />} />
        <Route path="/groups/:id/expenses/new" element={<p>Nuevo gasto del grupo</p>} />
        <Route path="/groups/new" element={<p>Crear grupo</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return onClose
}

beforeEach(() => {
  listGroups.mockReset()
  listGroups.mockResolvedValue({ ok: true, groups: GROUPS })
})

describe('GroupChooserDialog (027, FR-021)', () => {
  it('muestra cada grupo como en "Mis grupos": foto o inicial, miembros y flecha', async () => {
    renderDialog()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando grupos…')
    const depto = await screen.findByRole('link', { name: /Depto Palermo/ })
    expect(screen.getByRole('dialog', { name: '¿En qué grupo?' })).toBeInTheDocument()
    expect(depto).toHaveAttribute('href', '/groups/3/expenses/new')
    expect(depto.querySelector('img')).toHaveAttribute('src', '/api/groups/3/photo')
    expect(depto).toHaveTextContent('4 miembros')
    expect(depto).toHaveTextContent('›')

    const viaje = screen.getByRole('link', { name: /Viaje a Córdoba/ })
    expect(viaje).toHaveTextContent('V')
    expect(viaje).toHaveTextContent('1 miembro')
  })

  it('un grupo donde no se puede registrar gastos queda grisado, sin flecha ni enlace', async () => {
    renderDialog()
    await screen.findByRole('link', { name: /Depto Palermo/ })

    expect(screen.queryByRole('link', { name: /Consorcio/ })).not.toBeInTheDocument()
    const row = screen.getByText('Consorcio').closest('.group-chooser__row')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(row).toHaveClass('is-disabled')
    // Members and the reason go on separate lines.
    expect(within(row).getByText('12 miembros')).toBeInTheDocument()
    expect(within(row).getByText(CANNOT_CREATE_IN_GROUP)).toHaveClass('group-chooser__blocked')
    expect(row).not.toHaveTextContent('›')
  })

  it('elegir un grupo cierra el diálogo y lleva a su nuevo gasto', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()

    await user.click(await screen.findByRole('link', { name: /Viaje a Córdoba/ }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('Nuevo gasto del grupo')).toBeInTheDocument()
  })

  it('el buscador filtra sin acentos', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('link', { name: /Depto Palermo/ })

    await user.type(screen.getByLabelText('Buscar grupo'), 'cordoba')
    expect(screen.queryByRole('link', { name: /Depto Palermo/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Viaje a Córdoba/ })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Buscar grupo'))
    await user.type(screen.getByLabelText('Buscar grupo'), 'zzz')
    expect(screen.getByText(NO_GROUP_MATCHES_MESSAGE)).toBeInTheDocument()
  })

  it('sin grupos ofrece crear uno', async () => {
    listGroups.mockResolvedValue({ ok: true, groups: [] })
    const user = userEvent.setup()
    const onClose = renderDialog()

    expect(await screen.findByText(NO_GROUPS_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar grupo')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Crear grupo' }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('Crear grupo', { selector: 'p' })).toBeInTheDocument()
  })

  it('un error de red muestra el mensaje y "Reintentar" vuelve a pedir', async () => {
    listGroups.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('link', { name: /Depto Palermo/ })).toBeInTheDocument()
    expect(listGroups).toHaveBeenCalledTimes(2)
  })

  it('"Cancelar" y Escape cierran sin navegar', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()
    await screen.findByRole('link', { name: /Depto Palermo/ })

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Nuevo gasto del grupo')).not.toBeInTheDocument()
  })
})
