import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GlobalSearch, { NO_RESULTS_MESSAGE, PEOPLE_ERROR_MESSAGE } from './GlobalSearch'

const { searchUsers, listGroups } = vi.hoisted(() => ({
  searchUsers: vi.fn(),
  listGroups: vi.fn(),
}))

vi.mock('../api/usersClient', () => ({ searchUsers }))
vi.mock('../api/groupsClient', () => ({ listGroups }))

const GROUPS = [
  { id: 1, name: 'Viaje a Córdoba', memberCount: 3 },
  { id: 2, name: 'Casa', memberCount: 1 },
]
const ANA = { id: 5, firstName: 'Ana', lastName: 'Cordero', email: 'ana@example.com' }

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderSearch() {
  return render(
    <MemoryRouter>
      <GlobalSearch />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const input = () => screen.getByRole('searchbox', { name: 'Buscar personas y grupos' })

beforeEach(() => {
  searchUsers.mockReset()
  listGroups.mockReset()
  searchUsers.mockResolvedValue({ ok: true, users: [ANA] })
  listGroups.mockResolvedValue({ ok: true, groups: GROUPS })
})

describe('GlobalSearch (015, US3)', () => {
  it('con menos de 2 caracteres no busca ni despliega resultados', async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'a')
    await new Promise((resolve) => setTimeout(resolve, 350))

    expect(searchUsers).not.toHaveBeenCalled()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('separa personas y grupos propios, sin distinguir acentos', async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'cord')

    expect(await screen.findByRole('heading', { name: 'Personas' })).toBeInTheDocument()
    expect(screen.getByText('Ana Cordero')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Grupos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /viaje a córdoba/i })).toHaveAttribute('href', '/groups/1')
    expect(screen.queryByText('Casa')).not.toBeInTheDocument()
    expect(searchUsers).toHaveBeenCalledTimes(1)
    expect(searchUsers).toHaveBeenCalledWith('cord')
  })

  it('muestra la foto de la persona y, sin foto, el avatar por defecto', async () => {
    searchUsers.mockResolvedValue({
      ok: true,
      users: [{ ...ANA, avatarUrl: '/api/users/5/avatar' }, { ...ANA, id: 6, avatarUrl: null }],
    })
    const user = userEvent.setup()
    const { container } = renderSearch()

    await user.type(input(), 'an')
    await screen.findAllByText('Ana Cordero')

    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(sources).toEqual(['/api/users/5/avatar', '/avatar-default.png'])
  })

  it('muestra la foto del grupo y, sin foto, su inicial', async () => {
    listGroups.mockResolvedValue({
      ok: true,
      groups: [
        { id: 1, name: 'Casa nueva', memberCount: 2, photo: '/api/groups/1/photo' },
        { id: 2, name: 'Casa vieja', memberCount: 2, photo: null },
      ],
    })
    searchUsers.mockResolvedValue({ ok: true, users: [] })
    const user = userEvent.setup()
    const { container } = renderSearch()

    await user.type(input(), 'casa')
    await screen.findByText('Casa nueva')

    expect(container.querySelector('img.global-search__mark')).toHaveAttribute('src', '/api/groups/1/photo')
    expect(screen.getByTestId('group-avatar-default')).toHaveTextContent('C')
  })

  it('al elegir una persona va al buscador con el término y limpia el campo', async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'ana c')
    await user.click(await screen.findByRole('link', { name: /ana cordero/i }))

    expect(screen.getByTestId('location')).toHaveTextContent('/users/search?q=ana%20c')
    expect(input()).toHaveValue('')
  })

  it('Enter va al buscador de personas', async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'ana{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent('/users/search?q=ana')
  })

  it('Enter con un término corto no navega', async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'a{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })

  it('un error al buscar personas no oculta los grupos', async () => {
    searchUsers.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'casa')

    expect(await screen.findByRole('alert')).toHaveTextContent(PEOPLE_ERROR_MESSAGE)
    expect(screen.getByRole('link', { name: /casa/i })).toBeInTheDocument()
  })

  it('informa cuando no hay resultados', async () => {
    searchUsers.mockResolvedValue({ ok: true, users: [] })
    listGroups.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'zzz')

    expect(await screen.findByText(NO_RESULTS_MESSAGE)).toBeInTheDocument()
  })

  it('ignora la respuesta de un término anterior', async () => {
    let resolveFirst
    searchUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    searchUsers.mockResolvedValueOnce({ ok: true, users: [] })
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'ana')
    await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('ana'))
    await user.type(input(), 'x')
    await screen.findByText(NO_RESULTS_MESSAGE)
    resolveFirst({ ok: true, users: [ANA] })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('Ana Cordero')).not.toBeInTheDocument()
  })

  describe('hasta 3 por sección y "Ver más"', () => {
    const person = (id) => ({ id, firstName: `Persona${id}`, lastName: null, email: `p${id}@example.com` })
    const group = (id) => ({ id, name: `Grupo viaje ${id}`, memberCount: 2 })
    const results = () => screen.getByRole('region', { name: 'Resultados de la búsqueda' })

    it('con 3 o menos muestra todos y no muestra "Ver más"', async () => {
      searchUsers.mockResolvedValue({ ok: true, users: [person(1), person(2), person(3)] })
      listGroups.mockResolvedValue({ ok: true, groups: [group(1), group(2), group(3)] })
      const user = userEvent.setup()
      renderSearch()

      await user.type(input(), 'viaje')
      expect(await screen.findByText('Persona3')).toBeInTheDocument()
      expect(within(results()).getAllByRole('listitem')).toHaveLength(6)
      expect(screen.queryByRole('link', { name: /Ver más/ })).not.toBeInTheDocument()
    })

    it('con más de 3 personas muestra 3 y "Ver más" lleva al buscador de usuarios', async () => {
      searchUsers.mockResolvedValue({ ok: true, users: [person(1), person(2), person(3), person(4)] })
      listGroups.mockResolvedValue({ ok: true, groups: [] })
      const user = userEvent.setup()
      renderSearch()

      await user.type(input(), 'per')
      expect(await screen.findByText('Persona3')).toBeInTheDocument()
      expect(screen.queryByText('Persona4')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Ver más en grupos' })).not.toBeInTheDocument()

      const more = screen.getByRole('link', { name: 'Ver más en personas' })
      await user.click(more)
      expect(screen.getByTestId('location')).toHaveTextContent('/users/search?q=per')
      expect(input()).toHaveValue('')
    })

    it('con más de 3 grupos muestra 3 y "Ver más" lleva a Mis grupos con el término', async () => {
      searchUsers.mockResolvedValue({ ok: true, users: [] })
      listGroups.mockResolvedValue({ ok: true, groups: [group(1), group(2), group(3), group(4)] })
      const user = userEvent.setup()
      renderSearch()

      await user.type(input(), 'viaje')
      expect(await screen.findByText('Grupo viaje 3')).toBeInTheDocument()
      expect(screen.queryByText('Grupo viaje 4')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Ver más en personas' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Ver más en grupos' }))
      expect(screen.getByTestId('location')).toHaveTextContent('/groups?q=viaje')
    })
  })

  it('se cierra con Escape', async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(input(), 'cord')
    await screen.findByRole('region')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
