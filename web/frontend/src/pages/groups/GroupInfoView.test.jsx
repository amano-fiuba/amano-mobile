import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../../api/friendsClient', async (importOriginal) => ({
  ...await importOriginal(),
  listFriends: vi.fn().mockResolvedValue({ ok: true, friends: [] }),
}))
vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  getGroup: vi.fn(),
  leaveGroup: vi.fn(),
  getMembers: vi.fn(),
  addMember: vi.fn(),
  getActivity: vi.fn(),
  getReminderSettings: vi.fn(),
  updateGroup: vi.fn(),
}))

import {
  addMember,
  getActivity,
  getGroup,
  getMembers,
  getReminderSettings,
  leaveGroup,
  updateGroup,
} from '../../api/groupsClient'
import GroupInfoView from './GroupInfoView'
import { AuthProvider } from '../../auth/AuthContext'

beforeEach(() => {
  getGroup.mockReset()
  leaveGroup.mockReset()
  getMembers.mockReset()
  addMember.mockReset()
  getMembers.mockResolvedValue({ ok: true, members: [] })
  getActivity.mockReset()
  getActivity.mockResolvedValue({ ok: true, content: [] })
  getReminderSettings.mockReset()
  getReminderSettings.mockResolvedValue({
    ok: true,
    settings: { sendDays: 2, message: null, defaultSendDays: 5, allowedSendDays: [7, 5, 3, 2, 1] },
  })
})

const GROUP = {
  id: 3,
  name: 'Departamento 2026',
  description: 'Gastos compartidos del depto',
  memberCount: 4,
  currentUserRole: 'ADMIN',
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/groups/3']}>
      <AuthProvider>
        <Routes>
          <Route path="/groups/:id" element={<GroupInfoView />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('GroupInfoView (US6 read view + US5 panel)', () => {
  it('muestra el nombre, la descripción y el rol del usuario', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    expect(await screen.findByText('Departamento 2026')).toBeInTheDocument()
    expect(screen.getByText(/Gastos compartidos del depto/)).toBeInTheDocument()
    expect(screen.getByTestId('group-role')).toHaveTextContent(/Administrador/)
  })

  it('muestra la moneda principal del grupo (022 T068)', async () => {
    getGroup.mockResolvedValue({ ok: true, group: { ...GROUP, primaryCurrency: 'USD' } })

    renderView()

    expect(await screen.findByTestId('group-currency')).toHaveTextContent('Moneda: USD')
  })

  it('enlaza a la pantalla de deudas y saldos (022 T074)', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    expect(await screen.findByTestId('group-debts-link')).toHaveAttribute('href', '/groups/3/debts')
    expect(screen.getByTestId('group-debts-link')).toHaveTextContent('Deudas y saldos')
  })

  it('sin moneda en la respuesta no muestra la línea de moneda', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    await screen.findByText('Departamento 2026')
    expect(screen.queryByTestId('group-currency')).not.toBeInTheDocument()
  })

  it('muestra la actividad reciente y los últimos gastos con su enlace', async () => {
    getGroup.mockResolvedValue({ ok: true, group: { ...GROUP, expensesCount: 1 } })
    getActivity.mockResolvedValue({
      ok: true,
      content: [
        {
          id: 9,
          eventType: 'EXPENSE_CREATED',
          actor: { id: 7, firstName: 'Ana', lastName: 'Paz' },
          details: { expenseId: 44, description: 'Pizza', amount: '100.00', currency: 'ARS' },
          createdAt: '2026-11-05T12:00:00Z',
        },
      ],
    })

    renderView()

    // La pantalla monta varias tarjetas con sus propias consultas: en máquinas
    // lentas tarda más que el segundo por defecto de findAll.
    const links = await screen.findAllByRole('link', { name: 'Ver gasto' }, { timeout: 5000 })
    expect(links[0]).toHaveAttribute('href', '/groups/3/expenses/44')
    expect(getActivity).toHaveBeenCalledWith('3', expect.objectContaining({ eventTypes: ['EXPENSE_CREATED'] }))
    expect(screen.getByRole('link', { name: 'Ver todo' })).toHaveAttribute('href', '/groups/3/history')
  })

  it('si falla la actividad el resto de la pantalla sigue funcionando', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })
    getActivity.mockResolvedValue({ ok: false, network: true })

    renderView()

    expect(await screen.findByText('No se pudo cargar esta información')).toBeInTheDocument()
    expect(screen.getByTestId('members-list')).toBeInTheDocument()
  })

  it('muestra el error de grupo inexistente con el motivo 404', async () => {
    getGroup.mockResolvedValue({
      ok: false,
      status: 404,
      detail: 'No existe el grupo solicitado o no sos miembro',
    })

    renderView()

    expect(await screen.findByTestId('group-error')).toHaveTextContent(
      /No existe el grupo solicitado o no sos miembro/,
    )
  })

  it('muestra el mensaje de red cuando no hay conexión', async () => {
    getGroup.mockResolvedValue({ ok: false, network: true })

    renderView()

    expect(await screen.findByTestId('group-error')).toHaveTextContent(
      /No se pudo conectar con el servidor/,
    )
  })

  it('incluye el panel para abandonar el grupo cuando el usuario no es último admin', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })
    leaveGroup.mockResolvedValue({ ok: true, groupLeft: true })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Se abandonó el grupo/i)
  })

  it('avisa al único admin aunque haya otros miembros (isLastAdmin del servidor)', async () => {
    getGroup.mockResolvedValue({
      ok: true,
      group: { ...GROUP, memberCount: 4, isLastAdmin: true, isLastMember: false },
    })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Salir' }))

    expect(
      await screen.findByText(
        /Sos el último administrador: asigná otro administrador antes de salir/i,
      ),
    ).toBeInTheDocument()
  })

  it('siendo admin muestra agregar miembro y la configuración del grupo', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
    fireEvent.click(screen.getByRole('button', { name: /^Agregar miembro$/i }))

    expect(screen.getByRole('dialog', { name: /Agregar amigos a/ })).toBeInTheDocument()
    const closeSettings = screen.getByRole('button', { name: 'Cerrar configuración' })
    expect(closeSettings).toHaveTextContent(/^Cerrar$/)
    // fix 2026-11-04: no manual refresh button anymore
    expect(screen.queryByRole('button', { name: /Actualizar lista/i })).not.toBeInTheDocument()
  })

  it('Editar abre el formulario debajo sin ocultar la cabecera y pasa a "Cerrar"', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('heading', { level: 1, name: GROUP.name })).toBeInTheDocument()
    expect(screen.getByTestId('edit-panel')).toBeInTheDocument()
    const closeEdit = screen.getByRole('button', { name: 'Cerrar edición' })
    expect(closeEdit).toHaveTextContent(/^Cerrar$/)

    fireEvent.click(closeEdit)

    expect(screen.queryByTestId('edit-panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  it('abre el modal de deudas y recordatorios debajo de los permisos', async () => {
    getGroup.mockResolvedValue({ ok: true, group: { ...GROUP, debtDueDays: 7 } })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
    expect(screen.getByRole('heading', { name: 'Permisos de los miembros' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('debt-settings-button'))

    expect(await screen.findByRole('dialog', { name: 'Deudas y recordatorios' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Días para el vencimiento de las deudas')).toHaveValue('7')
    expect(screen.getByLabelText('Cuándo enviar el recordatorio')).toHaveValue('2')
  })

  it('Editar y Configuración no pueden estar abiertos a la vez', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(screen.getByTestId('edit-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Configuración' }))
    expect(screen.queryByTestId('edit-panel')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('permissions-panel')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.queryAllByTestId('permissions-panel')).toHaveLength(0)
    expect(screen.getByTestId('edit-panel')).toBeInTheDocument()
  })

  it('al guardar la configuración se cierra sola y vuelve a consultar el grupo', async () => {
    getGroup.mockResolvedValue({ ok: true, group: GROUP })
    updateGroup.mockResolvedValue({ ok: true, group: GROUP })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
    expect(screen.getByRole('heading', { name: 'Permisos de los miembros' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryAllByTestId('permissions-panel')).toHaveLength(0))
    expect(screen.getByRole('button', { name: 'Configuración' })).toBeInTheDocument()
    await waitFor(() => expect(getGroup).toHaveBeenCalledTimes(2))
  })

  it('tras agregar un miembro actualiza la lista y el contador sin recargar (fix 2026-11-04)', async () => {
    getGroup
      .mockResolvedValueOnce({ ok: true, group: GROUP })
      .mockResolvedValueOnce({ ok: true, group: { ...GROUP, memberCount: 5 } })
    getMembers
      .mockResolvedValueOnce({ ok: true, members: [] }) // lista de miembros
      .mockResolvedValueOnce({ ok: true, members: [] }) // el modal, para marcar "Agregado"
      .mockResolvedValueOnce({
        ok: true,
        members: [{ userId: null, simulatedProfileId: 9, name: 'Abuela', avatar: null, role: 'MEMBER' }],
      })
    addMember.mockResolvedValue({ ok: true, member: { id: 9 } })

    renderView()

    fireEvent.click(await screen.findByRole('button', { name: /^Agregar miembro$/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar perfil simulado' }))
    fireEvent.change(screen.getByLabelText('Nombre del perfil simulado'), { target: { value: 'Abuela' } })
    fireEvent.change(screen.getByLabelText('Correo del perfil simulado'), { target: { value: 'abuela@example.com' } })
    fireEvent.click(within(screen.getByTestId('simulated-form')).getByRole('button', { name: 'Agregar perfil simulado' }))

    expect(await screen.findByText('Abuela')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('group-role')).toHaveTextContent('5 miembros'))
    expect(getMembers).toHaveBeenCalledTimes(3)
    expect(getGroup).toHaveBeenCalledTimes(2)
  })

  it('siendo miembro no ve los controles de administración del grupo', async () => {
    getGroup.mockResolvedValue({ ok: true, group: { ...GROUP, currentUserRole: 'MEMBER' } })

    renderView()

    await waitFor(() => expect(screen.getByTestId('members-list')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Configuración' }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Agregar miembro$/i })).not.toBeInTheDocument()
  })

  it('muestra la tarjeta "Gastos" con la cantidad y "Nuevo gasto" (017 FR-021)', async () => {
    getGroup.mockResolvedValue({ ok: true, group: { ...GROUP, expensesCount: 2, permissions: {} } })

    renderView()

    const card = await screen.findByRole('region', { name: 'Gastos del grupo' })
    expect(within(card).getByTestId('group-expenses-count')).toHaveTextContent('2 gastos registrados')
    expect(within(card).getByRole('link', { name: 'Nuevo gasto' })).toBeInTheDocument()
  })
})
