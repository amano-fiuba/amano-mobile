import ApiImage from '../ApiImage'
const DEFAULT_AVATAR = '/avatar-default.png'

/**
 * Fichas de las personas elegidas al crear un grupo: amigos y perfiles
 * simulados juntos, cada una con una ✕ para quitarla (el grupo todavía no
 * existe). `people` trae { key, name, avatarUrl?, simulated?, onRemove }.
 */
export default function PeopleChips({ people }) {
  if (people.length === 0) return null

  return (
    <ul className="people-chips" aria-label="Personas elegidas">
      {people.map(({ key, name, detail, avatarUrl, simulated, onRemove }) => (
        <li
          key={key}
          className={simulated ? 'people-chip people-chip--simulated' : 'people-chip'}
          title={detail}
        >
          <ApiImage src={avatarUrl || DEFAULT_AVATAR} alt="" width={24} height={24} />
          <span>{name}</span>
          {/* Se distingue por el borde punteado; el texto queda solo para lectores de pantalla. */}
          {simulated && <span className="visually-hidden"> (perfil simulado)</span>}
          <button type="button" aria-label={`Quitar a ${name}`} title="Quitar" onClick={onRemove}>
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
