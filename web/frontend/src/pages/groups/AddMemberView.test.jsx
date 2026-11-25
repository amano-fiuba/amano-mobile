import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  addMember: vi.fn(),
  getMembers: vi.fn(),
}))
vi.mock('../../api/friendsClient', async (importOriginal) => ({
  ...await importOriginal(),
  listFriends: vi.fn(),
}))

import { addMember, getMembers } from '../../api/groupsClient'
import { listFriends } from '../../api/friendsClient'
import { SnackbarProvider } from '../../components/Snackbar'
import AddMemberView, { NO_FRIEND_MATCHES_MESSAGE } from './AddMemberView'

const GROUP = { id: 42, name: 'Amigos para viajar' }
const BETO = { id: 15, firstName: 'Beto', lastName: 'Pérez', email: 'beto@example.com', avatarUrl: null }
const JOSE = { id: 16, firstName: 'José', lastName: null, email: 'jose@correo.com', avatarUrl: '/api/users/16/avatar' }
const CARLA = { id: 17, firstName: 'Carla', lastName: 'Gómez', email: 'carla@example.com', avatarUrl: null }

beforeEach(() => {
  addMember.mockReset()
  getMembers.mockReset()
  listFriends.mockReset()
  listFriends.mockResolvedValue({ ok: true, friends: [BETO, JOSE, CARLA] })
  // Carla (17) ya es miembro.
  getMembers.mockResolvedValue({ ok: true, members: [{ userId: 17, name: 'Carla Gómez', role: 'MEMBER' }] })
})

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <SnackbarProvider>
        <AddMemberView group={GROUP} permissions={{ membersCannotInvite: false }} {...props} />
      </SnackbarProvider>
    </MemoryRouter>,
  )
}

const row = (friend) => screen.getByTestId(`add-friend-${friend.id}`)

describe('AddMemberView: modal "Agregar amigos a {grupo}"', () => {
  it('es un modal con el nombre del grupo que lista a todos los amigos', async () => {
    renderModal()

    expect(screen.getByRole('dialog', { name: 'Agregar amigos a Amigos para viajar' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
    const list = await screen.findByRole('list', { name: 'Tus amigos' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(row(BETO)).getByText('Beto Pérez')).toBeInTheDocument()
    expect(within(row(BETO)).getByText('beto@example.com')).toBeInTheDocument()
    expect(row(BETO).querySelector('img')).toHaveAttribute('src', '/avatar-default.png')
    expect(row(JOSE).querySelector('img')).toHaveAttribute('src', '/api/users/16/avatar')
    // El botón dice solo "Agregar", sin el mail.
    expect(within(row(BETO)).getByRole('button', { name: 'Agregar a Beto Pérez' })).toHaveTextContent(/^Agregar$/)
  })

  it('quien ya es miembro figura sombreado con "Agregado" y sin botón', async () => {
    renderModal()

    await screen.findByRole('list', { name: 'Tus amigos' })
    expect(row(CARLA)).toHaveClass('is-member')
    expect(within(row(CARLA)).getByText('Agregado')).toBeInTheDocument()
    expect(within(row(CARLA)).queryByRole('button')).not.toBeInTheDocument()
  })

  it('el buscador filtra por nombre o mail mientras se escribe, sin botón Buscar', async () => {
    const user = userEvent.setup()
    renderModal()

    const search = await screen.findByRole('searchbox', { name: 'Buscar entre tus amigos' })
    expect(search).toHaveAttribute('placeholder', 'Buscá por nombre o mail')
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()

    await user.type(search, 'jose')
    expect(within(screen.getByRole('list', { name: 'Tus amigos' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('José')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'carla@')
    expect(within(screen.getByRole('list', { name: 'Tus amigos' })).getAllByRole('listitem')).toHaveLength(1)

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(screen.getByText(NO_FRIEND_MATCHES_MESSAGE)).toBeInTheDocument()
  })

  it('agrega a un amigo: la fila pasa a "Agregado", avisa y el modal sigue abierto', async () => {
    const onAdded = vi.fn()
    const onClose = vi.fn()
    addMember.mockResolvedValue({ ok: true, member: { id: 15 } })
    renderModal({ onAdded, onClose })

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Beto Pérez' }))

    await waitFor(() =>
      expect(addMember).toHaveBeenCalledWith(42, { memberType: 'REGISTERED', identifier: 'beto@example.com' }),
    )
    expect(await within(row(BETO)).findByText('Agregado')).toBeInTheDocument()
    expect(row(BETO)).toHaveClass('is-member')
    expect(screen.getByTestId('snackbar')).toHaveTextContent('Miembro agregado: Beto Pérez')
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('muestra el motivo de rechazo dentro del modal y no avisa', async () => {
    const onAdded = vi.fn()
    addMember.mockResolvedValue({ ok: false, status: 400, detail: 'Esa persona ya es miembro del grupo' })
    renderModal({ onAdded })

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar a Beto Pérez' }))

    expect(await screen.findByTestId('add-member-error')).toHaveTextContent(/ya es miembro del grupo/i)
    expect(within(row(BETO)).getByRole('button', { name: 'Agregar a Beto Pérez' })).toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('la equis y Escape cierran el modal', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    await screen.findByRole('list', { name: 'Tus amigos' })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('sin permiso de invitar avisa y deshabilita "Agregar"', async () => {
    renderModal({ permissions: { membersCannotInvite: true } })

    expect(await screen.findByText('No podés invitar gente a este grupo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar a Beto Pérez' })).toBeDisabled()
  })

  it('sin amigos sugiere buscar usuarios', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [] })
    renderModal()

    expect(await screen.findByText(/Todavía no tenés amigos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buscar usuarios' })).toHaveAttribute('href', '/users/search')
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('si falla la carga de amigos permite reintentar', async () => {
    listFriends
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, friends: [BETO] })
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Beto Pérez')).toBeInTheDocument()
  })

  describe('perfil simulado al pie', () => {
    it('valida y envía el alta', async () => {
      const onAdded = vi.fn()
      addMember.mockResolvedValue({ ok: true, member: { id: 9 } })
      renderModal({ onAdded })

      await screen.findByRole('list', { name: 'Tus amigos' })
      fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil simulado' }))
      fireEvent.click(within(screen.getByTestId('simulated-form')).getByRole('button', { name: 'Agregar perfil simulado' }))
      expect(await screen.findByText(/Ingresá nombre y correo/i)).toBeInTheDocument()
      expect(addMember).not.toHaveBeenCalled()

      fireEvent.change(screen.getByLabelText('Nombre del perfil simulado'), { target: { value: 'Abuela' } })
      fireEvent.change(screen.getByLabelText('Correo del perfil simulado'), { target: { value: 'abuela@example.com' } })
      fireEvent.click(within(screen.getByTestId('simulated-form')).getByRole('button', { name: 'Agregar perfil simulado' }))

      await waitFor(() =>
        expect(addMember).toHaveBeenCalledWith(42, {
          memberType: 'SIMULATED',
          identifier: 'abuela@example.com',
          name: 'Abuela',
        }),
      )
      await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
      expect(screen.getByTestId('snackbar')).toHaveTextContent('Miembro agregado: Abuela')
    })
  })
})
