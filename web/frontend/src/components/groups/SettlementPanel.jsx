import { useCallback } from 'react'
import { getSettlementProposal } from '../../api/groupExpensesClient'
import { formatAmount } from '../../validation/expenseFormat'
import { moneyText } from '../../pages/groups/debtMoney'
import useGroupResource from '../../pages/groups/useGroupResource'
import ResourceState from './ResourceState'

export const NO_PROPOSAL_MESSAGE = 'No hay transferencias para proponer: todos están al día'
export const PROPOSAL_NOTE =
  'Es solo una propuesta para saldar el grupo con pocas transferencias: no genera pagos ni cambia las deudas.'
export const INFORMATIVE_LABEL = 'Informativa: la persona simulada no tiene cuenta para transferir'

// "Liquidación" tab: the advisory settlement proposal (read-only), one list per
// currency. Transfers that involve a simulated profile are marked as informative.
export default function SettlementPanel({ groupId, refreshKey }) {
  const loader = useCallback(() => getSettlementProposal(groupId), [groupId])
  const resource = useGroupResource(loader, refreshKey)
  const proposals = (Array.isArray(resource.data?.proposals) ? resource.data.proposals : [])
    .filter((proposal) => (proposal.transfers ?? []).length > 0)

  return (
    <ResourceState resource={resource} isEmpty={proposals.length === 0} emptyMessage={NO_PROPOSAL_MESSAGE}>
      <p className="group-debts__note">{PROPOSAL_NOTE}</p>
      {proposals.map((proposal) => (
        <section key={proposal.currency} className="group-card" aria-label={`Propuesta en ${proposal.currency}`}>
          <h3>Propuesta en {proposal.currency}</h3>
          <ol className="group-debts__list">
            {proposal.transfers.map((transfer, index) => (
              <li key={`${transfer.fromMemberType}-${transfer.fromMemberId}-${transfer.toMemberType}-${transfer.toMemberId}-${index}`}
                data-testid="transfer-row">
                <span>
                  {transfer.fromMemberName} le paga a {transfer.toMemberName}
                </span>
                <strong>
                  $ {formatAmount(moneyText(transfer.amount))} {proposal.currency}
                </strong>
                {transfer.informative && (
                  <small className="group-debts__informative" data-testid="informative-note">
                    {INFORMATIVE_LABEL}
                  </small>
                )}
              </li>
            ))}
          </ol>
          {proposal.summary && (
            <p className="group-debts__note">
              {proposal.summary.transferCount === 1
                ? '1 transferencia'
                : `${proposal.summary.transferCount} transferencias`}
            </p>
          )}
        </section>
      ))}
    </ResourceState>
  )
}
