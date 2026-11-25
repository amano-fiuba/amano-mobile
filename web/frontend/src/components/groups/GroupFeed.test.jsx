import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...(await importOriginal()),
  getActivity: vi.fn(),
}))

import { getActivity } from '../../api/groupsClient'
import GroupFeed, { FEED_ERROR_MESSAGE } from './GroupFeed'

const ANA = { id: 7, firstName: 'Ana', lastName: 'López' }
const at = '2026-11-04T15:00:00Z'

function renderFeed() {
  return render(
    <MemoryRouter>
      <GroupFeed groupId="42" emptyMessage="Nada por acá" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getActivity.mockReset()
})

describe('GroupFeed (022 T076)', () => {
  it('muestra los eventos nuevos y enlaza solo los gastos que existen', async () => {
    getActivity.mockResolvedValue({
      ok: true,
      content: [
        { id: 4, eventType: 'EXPENSE_DELETED', actor: ANA, details: { expenseId: 12 }, createdAt: at },
        { id: 3, eventType: 'EXPENSE_EDITED', actor: ANA, details: { expenseId: 12 }, createdAt: at },
        { id: 2, eventType: 'EXPENSE_EDITED', actor: ANA, details: { expenseId: 13 }, createdAt: at },
        { id: 1, eventType: 'DEBT_OVERDUE', actor: null, details: { amount: '500', currency: 'ARS' }, createdAt: at },
      ],
    })
    renderFeed()

    const rows = await screen.findAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Ana López eliminó un gasto')
    expect(rows[1]).toHaveTextContent('Ana López editó un gasto')
    expect(rows[3]).toHaveTextContent('Sistema venció la deuda de')
    expect(screen.getAllByRole('link', { name: 'Ver gasto' })).toHaveLength(1)
    expect(within(rows[2]).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/42/expenses/13')
  })

  it('muestra el mensaje vacío y el de error', async () => {
    getActivity.mockResolvedValueOnce({ ok: true, content: [] })
    const { unmount } = renderFeed()
    expect(await screen.findByText('Nada por acá')).toBeInTheDocument()
    unmount()

    getActivity.mockResolvedValueOnce({ ok: false })
    renderFeed()
    expect(await screen.findByText(FEED_ERROR_MESSAGE)).toBeInTheDocument()
  })
})
