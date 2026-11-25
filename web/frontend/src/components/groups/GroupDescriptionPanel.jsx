import { Fragment } from 'react'

/**
 * Group description (US7, T081): pure UI read of the description field that
 * GET /api/groups/{id} already returns (US1). A NULL or empty description
 * renders nothing; multi-line values keep their line breaks.
 */
export default function GroupDescriptionPanel({ description = null }) {
  const hasDescription = typeof description === 'string' && description.trim().length > 0

  if (!hasDescription) return null

  return (
    <section
      data-testid="group-description"
      className="group-description"
      aria-label="Descripción del grupo"
    >
      <p className="group-description__text" data-testid="group-description-text">
        {description.split('\n').map((line, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </p>
    </section>
  )
}
