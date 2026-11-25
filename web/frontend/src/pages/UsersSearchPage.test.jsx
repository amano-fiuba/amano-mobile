import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../auth/AuthContext'
import ProtectedRoute from '../auth/ProtectedRoute'
import UsersSearchPage, {
  FRIENDSHIP_REQUEST_SENT_MESSAGE,
  NO_RESULTS_MESSAGE,
  TOO_SHORT_MESSAGE,
} from './UsersSearchPage'

// The API clients are mocked so each backend outcome is driven explicitly;
// AuthProvider's session check goes through the global fetch (logged in).
vi.mock('../api/usersClient', () => ({
  SEARCH_NETWORK_ERROR_MESSAGE: 'No se pudo completar la búsqueda. Intenta nuevamente',
  searchUsers: vi.fn(),
}))

vi.mock('../api/friendsClient', () => ({
  SEND_NETWORK_ERROR_MESSAGE: 'No se pudo enviar la solicitud. Intentá nuevamente',
  sendFriendshipRequest: vi.fn(),
}))

const usersClient = await import('../api/usersClient')
const friendsClient = await import('../api/friendsClient')

const ME = { id: 1, firstName: 'Camila', email: 'camila@example.com', currencies: [] }
const ANA = { id: 3, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com' }
const JUAN = { id: 4, firstName: 'Juan', lastName: null, email: 'juan@example.com' }

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(ME) }),
  )
  usersClient.searchUsers.mockReset()
  friendsClient.sendFriendshipRequest.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage(entry = '/users/search') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/users/search"
            element={
              <ProtectedRoute>
                <UsersSearchPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>PANTALLA LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function search(user, text) {
  const input = await screen.findByLabelText('Buscar usuarios')
  await user.clear(input)
  if (text) {
    await user.type(input, text)
  }
  await user.keyboard('{Enter}')
}

describe('UsersSearchPage (feature 008)', () => {
  it('ejecuta la búsqueda indicada por ?q= (015, FR-006)', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    renderPage('/users/search?q=ana%20p')

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(usersClient.searchUsers).toHaveBeenCalledTimes(1)
    expect(usersClient.searchUsers).toHaveBeenCalledWith('ana p')
    expect(screen.getByLabelText('Buscar usuarios')).toHaveValue('ana p')
  })

  it('muestra el título y el campo, con el texto adentro y sin botón Buscar', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Buscar usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveClass('page', 'users-search-page')
    const input = screen.getByRole('searchbox', { name: 'Buscar usuarios' })
    expect(input).toHaveAttribute('placeholder', 'Buscá por nombre, apellido o correo')
    expect(screen.queryByText('Nombre, apellido o email')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()
    expect(screen.getByText('Mínimo 2 caracteres.')).toBeInTheDocument()
    expect(screen.getByTestId('search-initial')).toBeInTheDocument()
  })

  it('busca mientras se escribe, sin apretar nada', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Buscar usuarios'), 'ana')

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(usersClient.searchUsers).toHaveBeenCalledTimes(1)
    expect(usersClient.searchUsers).toHaveBeenCalledWith('ana')
  })

  it('mientras se escribe, con menos de 2 caracteres no busca ni muestra el aviso', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Buscar usuarios'), 'a')
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(usersClient.searchUsers).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-notice')).not.toBeInTheDocument()
    expect(screen.getByTestId('search-initial')).toBeInTheDocument()
  })

  it('al borrar el término vuelve al estado inicial', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    const user = userEvent.setup()
    renderPage()

    const input = await screen.findByLabelText('Buscar usuarios')
    await user.type(input, 'ana')
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()

    await user.clear(input)
    expect(await screen.findByTestId('search-initial')).toBeInTheDocument()
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument()
  })

  it.each([
    ['vacío', ''],
    ['un carácter', 'a'],
    ['solo espacios', '   '],
    ['un carácter con espacios', '  a  '],
  ])('término %s con Enter: muestra el aviso y no busca', async (_label, text) => {
    const user = userEvent.setup()
    renderPage()

    await search(user, text)

    const notice = await screen.findByTestId('search-notice')
    expect(notice).toHaveTextContent(TOO_SHORT_MESSAGE)
    expect(notice).toHaveClass('users-search-banner')
    expect(notice).toHaveAttribute('role', 'alert')
    expect(usersClient.searchUsers).not.toHaveBeenCalled()
  })

  it('busca con el término recortado y muestra nombre, email y avatar por defecto', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA, JUAN] })
    const user = userEvent.setup()
    renderPage()

    await search(user, '  an  ')

    expect(usersClient.searchUsers).toHaveBeenCalledWith('an')
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.queryByText(/null/)).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Resultados de la búsqueda' })
    const avatars = list.querySelectorAll('img')
    expect(avatars).toHaveLength(2)
    avatars.forEach((img) => expect(img).toHaveAttribute('src', '/avatar-default.png'))
  })

  it('muestra la foto si la API la envía', async () => {
    usersClient.searchUsers.mockResolvedValue({
      ok: true,
      users: [{ ...ANA, avatarUrl: '/api/users/3/avatar' }],
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')

    expect((await screen.findByTestId('user-card-3')).querySelector('img')).toHaveAttribute(
      'src',
      '/api/users/3/avatar',
    )
  })

  it('presenta cada resultado como tarjeta con su acción de agregar', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA, JUAN] })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')

    expect(await screen.findByTestId('user-card-3')).toHaveClass('user-card')
    expect(screen.getByTestId('user-card-4')).toHaveClass('user-card')
    expect(screen.getByText('2 resultados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar a Ana Pérez' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Agregar a Juan' })).toBeEnabled()
  })

  it('muestra Amigos, Pendiente o Agregar según la relación, sin acción en los dos primeros', async () => {
    usersClient.searchUsers.mockResolvedValue({
      ok: true,
      users: [
        { ...ANA, friendshipStatus: 'FRIENDS' },
        { ...JUAN, friendshipStatus: 'PENDING_RECEIVED' },
        { id: 5, firstName: 'Lola', lastName: null, email: 'lola@example.com', friendshipStatus: 'NONE' },
      ],
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')

    const friends = await screen.findByRole('button', { name: 'Ana Pérez ya es tu amigo' })
    expect(friends).toHaveTextContent('Amigos')
    expect(friends).toBeDisabled()
    const pending = screen.getByRole('button', { name: 'Solicitud pendiente de Juan' })
    expect(pending).toHaveTextContent('Pendiente')
    expect(pending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Agregar a Lola' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Agregar a Ana Pérez' })).not.toBeInTheDocument()
  })

  it('muestra Solicitud enviada si yo ya le envié una solicitud', async () => {
    usersClient.searchUsers.mockResolvedValue({
      ok: true,
      users: [{ ...ANA, friendshipStatus: 'PENDING_SENT' }],
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')

    const sent = await screen.findByRole('button', { name: 'Solicitud enviada a Ana Pérez' })
    expect(sent).toHaveTextContent('Solicitud enviada')
    expect(sent).toBeDisabled()
  })

  it('muestra el estado de carga mientras consulta', async () => {
    let resolveSearch
    usersClient.searchUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve
      }),
    )
    const user = userEvent.setup()
    renderPage()

    const input = await screen.findByLabelText('Buscar usuarios')
    await user.type(input, 'ana{Enter}')

    expect(await screen.findByTestId('search-loading')).toBeInTheDocument()
    expect(screen.getByRole('search')).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      resolveSearch({ ok: true, users: [ANA] })
    })

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.queryByTestId('search-loading')).not.toBeInTheDocument()
  })

  it('Enter busca enseguida, sin repetir la búsqueda automática', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Buscar usuarios'), 'ana{Enter}')

    expect(usersClient.searchUsers).toHaveBeenCalledWith('ana')
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(usersClient.searchUsers).toHaveBeenCalledTimes(1)
  })

  it('sin coincidencias muestra "No se encontraron usuarios"', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [] })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'zzz')

    const notice = await screen.findByTestId('search-notice')
    expect(notice).toHaveTextContent(NO_RESULTS_MESSAGE)
    expect(notice).toHaveClass('users-search-empty')
    expect(notice).toHaveAttribute('role', 'status')
    expect(screen.queryByTestId('search-initial')).not.toBeInTheDocument()
  })

  it('error de red: mensaje fijo, borra resultados previos y permite reintentar', async () => {
    usersClient.searchUsers
      .mockResolvedValueOnce({ ok: true, users: [ANA] })
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, users: [JUAN] })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()

    await search(user, 'an')
    const notice = await screen.findByTestId('search-notice')
    expect(notice).toHaveTextContent('No se pudo completar la búsqueda. Intenta nuevamente')
    expect(notice).toHaveClass('users-search-banner')
    expect(notice).toHaveAttribute('role', 'alert')
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument()

    await search(user, 'an')
    expect(await screen.findByText('Juan')).toBeInTheDocument()
    expect(usersClient.searchUsers).toHaveBeenCalledTimes(3)
  })

  it('400 del servidor muestra el mensaje del campo', async () => {
    usersClient.searchUsers.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { q: 'La búsqueda no puede superar los 100 caracteres' },
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'ab')

    expect(await screen.findByTestId('search-notice')).toHaveTextContent(
      'La búsqueda no puede superar los 100 caracteres',
    )
  })

  it('401 (sesión vencida): cierra la sesión y lleva al login', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: false, status: 401, detail: '', fields: {} })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')

    expect(await screen.findByText('PANTALLA LOGIN')).toBeInTheDocument()
  })
})

describe('UsersSearchPage envío de solicitudes (feature 011)', () => {
  it('envía la solicitud de la fila y muestra Enviando… y luego Solicitud enviada', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA, JUAN] })
    let resolveSend
    friendsClient.sendFriendshipRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    await user.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(friendsClient.sendFriendshipRequest).toHaveBeenCalledWith(3)
    expect(
      screen.getByRole('button', { name: 'Enviando solicitud a Ana Pérez' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Agregar a Juan' })).toBeEnabled()

    await act(async () => {
      resolveSend({ ok: true, request: { id: 9 } })
    })

    expect(await screen.findByTestId('snackbar')).toHaveTextContent(
      FRIENDSHIP_REQUEST_SENT_MESSAGE,
    )
    expect(
      screen.getByRole('button', { name: 'Solicitud enviada a Ana Pérez' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Agregar a Juan' })).toBeEnabled()
  })

  it.each([
    ['Ya existe una solicitud de amistad pendiente entre ambos usuarios'],
    ['Ya son amigos'],
  ])('409 muestra "%s" y no marca la fila como enviada', async (detail) => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    friendsClient.sendFriendshipRequest.mockResolvedValue({
      ok: false,
      status: 409,
      detail,
      fields: {},
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    await user.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(await screen.findByTestId('friendship-feedback')).toHaveTextContent(detail)
    expect(screen.getByTestId('friendship-feedback')).toHaveAttribute('role', 'alert')
    expect(screen.getByRole('button', { name: 'Agregar a Ana Pérez' })).toBeEnabled()
  })

  it('400 de auto-solicitud muestra el mensaje del campo recipientId', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    friendsClient.sendFriendshipRequest.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { recipientId: 'No podés enviarte una solicitud de amistad a vos mismo' },
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    await user.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(await screen.findByTestId('friendship-feedback')).toHaveTextContent(
      'No podés enviarte una solicitud de amistad a vos mismo',
    )
  })

  it('404 muestra "No se encontró el usuario" y no marca la fila como enviada', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    friendsClient.sendFriendshipRequest.mockResolvedValue({
      ok: false,
      status: 404,
      detail: 'No se encontró el usuario',
      fields: {},
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    await user.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(await screen.findByTestId('friendship-feedback')).toHaveTextContent(
      'No se encontró el usuario',
    )
    expect(screen.getByRole('button', { name: 'Agregar a Ana Pérez' })).toBeEnabled()
  })

  it('error de red muestra el mensaje fijo y permite reintentar', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    friendsClient.sendFriendshipRequest
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, request: { id: 9 } })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    await user.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(await screen.findByTestId('friendship-feedback')).toHaveTextContent(
      'No se pudo enviar la solicitud. Intentá nuevamente',
    )

    await user.click(screen.getByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(await screen.findByTestId('snackbar')).toHaveTextContent(
      FRIENDSHIP_REQUEST_SENT_MESSAGE,
    )
    expect(friendsClient.sendFriendshipRequest).toHaveBeenCalledTimes(2)
  })

  it('401 al enviar cierra la sesión y lleva al login', async () => {
    usersClient.searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
    friendsClient.sendFriendshipRequest.mockResolvedValue({
      ok: false,
      status: 401,
      detail: '',
      fields: {},
    })
    const user = userEvent.setup()
    renderPage()

    await search(user, 'an')
    await user.click(await screen.findByRole('button', { name: 'Agregar a Ana Pérez' }))

    expect(await screen.findByText('PANTALLA LOGIN')).toBeInTheDocument()
  })
})
