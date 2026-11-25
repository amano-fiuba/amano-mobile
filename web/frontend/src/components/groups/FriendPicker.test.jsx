import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/friendsClient', async (importOriginal) => ({
  ...(await importOriginal()),
  listFriends: vi.fn(),
}))

const setUser = vi.fn()
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ setUser }) }))

import { listFriends } from '../../api/friendsClient'
import FriendPicker from './FriendPicker'

const JOSE = { id: 1, firstName: 'José', lastName: 'Pérez', email: 'jose@example.com', avatarUrl: '/api/users/1/avatar' }
const ANA = { id: 2, firstName: 'Ana', lastName: null, email: 'ana@example.com', avatarUrl: null }

function Harness() {
  const [selected, setSelected] = useState([])
  return (
    <MemoryRouter>
      <FriendPicker selected={selected} onChange={setSelected} />
      <output data-testid="selected">{selected.map(({ id }) => id).join(',')}</output>
    </MemoryRouter>
  )
}

beforeEach(() => {
  listFriends.mockReset()
  setUser.mockReset()
})

describe('FriendPicker (spec 023 US5)', () => {
  it('lista los amigos con su foto, o el avatar por defecto', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [JOSE, ANA] })
    const { container } = render(<Harness />)

    expect(await screen.findByRole('button', { name: 'Agregar a José Pérez' })).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(sources).toEqual(['/api/users/1/avatar', '/avatar-default.png'])
  })

  it('filtra sin distinguir mayúsculas ni acentos, y conserva la selección', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [JOSE, ANA] })
    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: /Agregar a Ana/ }))
    fireEvent.change(screen.getByLabelText('Buscar entre tus amigos'), { target: { value: 'JOSE' } })

    expect(screen.getByRole('button', { name: 'Agregar a José Pérez' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Agregar a Ana/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('selected')).toHaveTextContent('2')

    fireEvent.change(screen.getByLabelText('Buscar entre tus amigos'), { target: { value: '' } })
    expect(screen.getByText('Agregado')).toBeInTheDocument()
  })

  it('avisa si el filtro no encuentra a nadie', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [ANA] })
    render(<Harness />)

    fireEvent.change(await screen.findByLabelText('Buscar entre tus amigos'), { target: { value: 'zzz' } })

    expect(screen.getByText('Ningún amigo coincide con tu búsqueda')).toBeInTheDocument()
  })

  it('sin amigos ofrece buscar personas', async () => {
    listFriends.mockResolvedValue({ ok: true, friends: [] })
    render(<Harness />)

    expect(await screen.findByText(/Todavía no tenés amigos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buscar personas' })).toHaveAttribute('href', '/users/search')
  })

  it('ante un error permite reintentar', async () => {
    listFriends.mockResolvedValueOnce({ ok: false, network: true })
    listFriends.mockResolvedValueOnce({ ok: true, friends: [ANA] })
    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('button', { name: /Agregar a Ana/ })).toBeInTheDocument()
  })

  it('una sesión vencida cierra la sesión', async () => {
    listFriends.mockResolvedValue({ ok: false, status: 401 })
    render(<Harness />)

    await vi.waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})
