import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendChooserDialog, { NO_FRIEND_MATCHES_MESSAGE } from './FriendChooserDialog'
import { NO_FRIENDS_MESSAGE } from './FriendsList'

const { listFriends } = vi.hoisted(() => ({ listFriends: vi.fn() }))
vi.mock('../api/friendsClient', async (importOriginal) => ({ ...(await importOriginal()), listFriends }))

const FRIENDS = [
  { id: 15, firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com', avatarUrl: '/api/users/15/avatar' },
  { id: 21, firstName: 'José', lastName: null, email: 'jose@example.com', avatarUrl: null },
]

function renderDialog() {
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FriendChooserDialog onClose={onClose} />} />
        <Route path="/friends/:friendId/expenses/new" element={<p>Gasto con amigo</p>} />
        <Route path="/users/search" element={<p>Buscar usuarios</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return onClose
}

beforeEach(() => {
  listFriends.mockReset()
  listFriends.mockResolvedValue({ ok: true, friends: FRIENDS })
})

describe('FriendChooserDialog (027, FR-030)', () => {
  it('lista los amigos con avatar, nombre, correo y flecha', async () => {
    renderDialog()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus amigos…')
    const juan = await screen.findByRole('link', { name: /Juan Pérez/ })
    expect(screen.getByRole('dialog', { name: '¿Con qué amigo?' })).toBeInTheDocument()
    expect(juan).toHaveAttribute('href', '/friends/15/expenses/new')
    expect(juan.querySelector('img')).toHaveAttribute('src', '/api/users/15/avatar')
    expect(juan).toHaveTextContent('juan@example.com')
    expect(juan).toHaveTextContent('›')
    expect(screen.getByRole('link', { name: /José/ }).querySelector('img')).toHaveAttribute('src', '/avatar-default.png')
  })

  it('el buscador filtra por nombre o correo, sin acentos', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('link', { name: /Juan Pérez/ })

    await user.type(screen.getByLabelText('Buscar amigo'), 'jose')
    expect(screen.queryByRole('link', { name: /Juan/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /José/ })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Buscar amigo'))
    await user.type(screen.getByLabelText('Buscar amigo'), 'zzz')
    expect(screen.getByText(NO_FRIEND_MATCHES_MESSAGE)).toBeInTheDocument()
  })

  it('elegir un amigo cierra el diálogo y lleva a su formulario', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()

    await user.click(await screen.findByRole('link', { name: /Juan Pérez/ }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('Gasto con amigo')).toBeInTheDocument()
  })

  it('sin amigos ofrece buscar usuarios', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [] })
    const user = userEvent.setup()
    const onClose = renderDialog()

    expect(await screen.findByText(NO_FRIENDS_MESSAGE)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Buscar usuarios' }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('Buscar usuarios', { selector: 'p' })).toBeInTheDocument()
  })

  it('un error de red muestra el mensaje y "Reintentar" vuelve a pedir', async () => {
    listFriends.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar tu lista de amigos')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('link', { name: /Juan Pérez/ })).toBeInTheDocument()
  })

  it('"Cancelar" y Escape cierran sin navegar', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()
    await screen.findByRole('link', { name: /Juan Pérez/ })

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
