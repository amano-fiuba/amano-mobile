import { Link } from 'react-router'
import { formatMoney } from '../../pages/groups/activityDescriptions'

/**
 * Saldo de un miembro con la persona logueada. Por ahora no se ve: el backend
 * todavía no lo envía. Para activarlo alcanza con que cada miembro de
 * GET /api/groups/{id}/members traiga `balances`, también los perfiles simulados:
 *
 *   balances: [{ amount: '500.00', currency: 'ARS' }]
 *
 * `amount` positivo: te debe; negativo: le debés. Es una lista para admitir un
 * saldo por moneda, y `payUrl` (opcional) habilita el botón Pagar. El cálculo,
 * incluidos saldos cruzados y cotizaciones, queda del lado del backend.
 */
export default function MemberBalance({ balances, payUrl }) {
  const pending = (balances ?? []).filter(({ amount }) => Number(amount) !== 0)
  if (pending.length === 0) return null

  return (
    <div className="member-balance">
      <ul>
        {pending.map(({ amount, currency }) => {
          const value = Number(amount)
          return (
            <li key={currency}>
              {value > 0 ? 'Te debe' : 'Le debés'}{' '}
              <strong>{formatMoney(Math.abs(value), currency)}</strong>
            </li>
          )
        })}
      </ul>
      {payUrl && (
        <Link className="group-action" to={payUrl}>
          Pagar
        </Link>
      )}
    </div>
  )
}
