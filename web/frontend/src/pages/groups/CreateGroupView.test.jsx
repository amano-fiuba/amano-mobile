import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...(await importOriginal()),
  createGroup: vi.fn(),
}))
vi.mock('../../api/friendsClient', async (importOriginal) => ({
  ...(await importOriginal()),
  listFriends: vi.fn(),
}))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ setUser: vi.fn() }) }))

import { listFriends } from '../../api/friendsClient'
import { createGroup } from '../../api/groupsClient'
import CreateGroupView from './CreateGroupView'

const ANA = { id: 1, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', avatarUrl: null }
const BRUNO = { id: 2, firstName: 'Bruno', lastName: null, email: 'bruno@example.com', avatarUrl: null }

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/groups/new']}>
      <Routes>
        <Route path="/groups/new" element={<CreateGroupView />} />
        <Route path="/groups/:id" element={<p>Pantalla del grupo</p>} />
        <Route path="/groups" element={<p>Mis grupos</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function typeName(value) {
  fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value } })
}

function typeProfile(name, email) {
  if (screen.queryByRole('button', { name: 'Sumar perfil simulado' })) {
    fireEvent.click(screen.getByRole('button', { name: 'Sumar perfil simulado' }))
  }
  fireEvent.change(screen.getByLabelText('Nombre del perfil simulado'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Correo del perfil simulado'), { target: { value: email } })
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

beforeEach(() => {
  createGroup.mockReset()
  listFriends.mockReset()
  listFriends.mockResolvedValue({ ok: true, friends: [ANA, BRUNO] })
})

describe('CreateGroupView (010 T031, 023 US5)', () => {
  it('no pide escribir el correo de un amigo', async () => {
    renderView()

    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })

    expect(screen.queryByLabelText('Correo del amigo')).not.toBeInTheDocument()
  })

  it('Crear queda deshabilitado sin nombre aunque haya personas elegidas', async () => {
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()
    expect(createGroup).not.toHaveBeenCalled()
  })

  it('Crear queda deshabilitado con nombre pero sin ninguna persona', async () => {
    renderView()
    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })
    typeName('Solo yo')

    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()
  })

  it('Crear se habilita con nombre y un perfil simulado completo aunque no esté agregado', async () => {
    renderView()
    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })
    typeName('Con invitado')
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()

    typeProfile('Invitado', 'invitado@example.com')

    expect(screen.getByRole('button', { name: 'Crear' })).toBeEnabled()
  })

  it('crea el grupo con varios amigos y abre el grupo', async () => {
    createGroup.mockResolvedValue({ ok: true, group: { id: 42, name: 'Viaje' } })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a Bruno' }))
    expect(screen.getByTestId('member-count')).toHaveTextContent('2 personas elegidas')
    typeName('Viaje')
    submit()

    await waitFor(() => expect(createGroup).toHaveBeenCalledWith({
      name: 'Viaje',
      description: '',
      primaryCurrency: 'ARS',
      members: [
        { memberType: 'REGISTERED', identifier: 'ana@example.com' },
        { memberType: 'REGISTERED', identifier: 'bruno@example.com' },
      ],
    }))
    expect(await screen.findByText('Pantalla del grupo')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Grupo creado: Viaje/)
  })

  it('combina amigos y perfiles simulados', async () => {
    createGroup.mockResolvedValue({ ok: true, group: { id: 43, name: 'Mixto' } })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeProfile('Invitado', 'invitado@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))
    expect(screen.getByTestId('member-count')).toHaveTextContent('2 personas elegidas')
    typeName('Mixto')
    submit()

    await waitFor(() => expect(createGroup).toHaveBeenCalledWith({
      name: 'Mixto',
      description: '',
      primaryCurrency: 'ARS',
      members: [
        { memberType: 'REGISTERED', identifier: 'ana@example.com' },
        { memberType: 'SIMULATED', identifier: 'invitado@example.com', name: 'Invitado' },
      ],
    }))
  })

  it('permite crear solo con perfiles simulados si no hay amigos', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [] })
    createGroup.mockResolvedValue({ ok: true, group: { id: 44, name: 'Depto' } })
    renderView()

    await screen.findByText(/Todavía no tenés amigos/)
    typeProfile('Abuela', 'abuela@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))
    typeName('Depto')
    submit()

    await screen.findByText('Pantalla del grupo')
  })

  it('un perfil escrito sin tocar Agregar perfil se suma al crear', async () => {
    createGroup.mockResolvedValue({ ok: true, group: { id: 45, name: 'Depto' } })
    renderView()

    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })
    typeProfile('Abuela', 'abuela@example.com')
    typeName('Depto')
    submit()

    await waitFor(() => expect(createGroup.mock.calls[0][0].members).toEqual([
      { memberType: 'SIMULATED', identifier: 'abuela@example.com', name: 'Abuela' },
    ]))
  })

  it('un perfil incompleto frena la creación', async () => {
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeProfile('Abuela', '')
    typeName('Depto')
    submit()

    expect(await screen.findByTestId('member-error')).toHaveTextContent(/Ingresá nombre y correo/)
    expect(createGroup).not.toHaveBeenCalled()
  })

  it('rechaza un correo de perfil repetido y permite quitar un perfil', async () => {
    renderView()
    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })

    typeProfile('Abuela', 'abuela@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))
    typeProfile('Otra', 'ABUELA@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))
    expect(await screen.findByTestId('member-error')).toHaveTextContent(/No podés repetir/)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar a Abuela' }))
    expect(screen.getByTestId('member-count')).toHaveTextContent('0 personas elegidas')
  })

  it('muestra amigos y perfiles simulados juntos en fichas, que se quitan con la ✕', async () => {
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeProfile('Abuela', 'abuela@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))

    const chips = screen.getByRole('list', { name: 'Personas elegidas' })
    expect(within(chips).getByText('Ana Pérez')).toBeInTheDocument()
    expect(within(chips).getByText('Abuela')).toBeInTheDocument()

    // La ficha sigue aunque el filtro saque a Ana de la lista.
    fireEvent.change(screen.getByLabelText('Buscar entre tus amigos'), { target: { value: 'bruno' } })
    expect(within(chips).getByText('Ana Pérez')).toBeInTheDocument()

    fireEvent.click(within(chips).getByRole('button', { name: 'Quitar a Ana Pérez' }))
    expect(screen.getByTestId('member-count')).toHaveTextContent('1 persona elegida')
  })

  it('muestra el rechazo del servidor y no abre ningún grupo', async () => {
    createGroup.mockResolvedValue({
      ok: false,
      status: 404,
      fields: { member: 'La persona que querés agregar no está entre tus amigos' },
    })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeName('Viaje')
    submit()

    expect(await screen.findByTestId('member-error')).toHaveTextContent(/no está entre tus amigos/)
    expect(screen.queryByText('Pantalla del grupo')).not.toBeInTheDocument()
  })

  it('informa un error de red', async () => {
    createGroup.mockResolvedValue({ ok: false, network: true })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeName('Viaje')
    submit()

    expect(await screen.findByTestId('member-error')).toHaveTextContent(/No se pudo conectar/)
  })


  it('Cancelar vuelve a Mis grupos sin crear nada, y queda a la izquierda de Crear', async () => {
    renderView()
    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })

    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const crear = screen.getByRole('button', { name: 'Crear' })
    expect(cancelar.compareDocumentPosition(crear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(cancelar)

    expect(await screen.findByText('Mis grupos')).toBeInTheDocument()
    expect(createGroup).not.toHaveBeenCalled()
})
  // 022 T068: moneda principal del grupo
  it('muestra el selector de moneda principal con ARS, USD y EUR y ARS por defecto', async () => {
    renderView()
    await screen.findByRole('button', { name: 'Agregar a Ana Pérez' })

    const select = screen.getByLabelText('Moneda principal')
    expect(select).toHaveValue('ARS')
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['ARS', 'USD', 'EUR'])
  })

  it('envía la moneda elegida al crear el grupo', async () => {
    createGroup.mockResolvedValue({ ok: true, group: { id: 50, name: 'Euro trip' } })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    fireEvent.change(screen.getByLabelText('Moneda principal'), { target: { value: 'EUR' } })
    typeName('Euro trip')
    submit()

    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1))
    expect(createGroup.mock.calls[0][0]).toMatchObject({ name: 'Euro trip', primaryCurrency: 'EUR' })
    await screen.findByText('Pantalla del grupo')
  })

  it('sin tocar el selector envía ARS', async () => {
    createGroup.mockResolvedValue({ ok: true, group: { id: 51, name: 'Local' } })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeName('Local')
    submit()

    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1))
    expect(createGroup.mock.calls[0][0].primaryCurrency).toBe('ARS')
  })

  it('muestra junto al selector el error de moneda que informe el servidor', async () => {
    createGroup.mockResolvedValue({
      ok: false,
      status: 400,
      fields: { primaryCurrency: 'La moneda no es válida' },
    })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))
    typeName('Rara')
    submit()

    expect(await screen.findByText('La moneda no es válida')).toBeInTheDocument()
    expect(screen.getByLabelText('Moneda principal')).toHaveAttribute('aria-invalid', 'true')

  })
})
