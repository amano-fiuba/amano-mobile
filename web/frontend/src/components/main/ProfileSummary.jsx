import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { userAvatarUrl } from '../../auth/userAvatar'
import CopyCbuButton from '../CopyCbuButton'
import ApiImage from '../ApiImage'

// Resumen de perfil: datos propios de la sesión (mismas reglas que ProfilePage).
export default function ProfileSummary() {
  const { user } = useAuth()
  const name = user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName
  const currencies = user.currencies?.length > 0 ? user.currencies : ['ARS']

  return (
    <section className="main-card main-profile" aria-labelledby="main-profile-name">
      <ApiImage src={userAvatarUrl(user)} alt="" width={84} height={84} />
      <h2 id="main-profile-name">{name}</h2>
      <dl>
        <div>
          <dt>Correo</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>CBU/CVU</dt>
          <dd>
            {user.cbuCvu ?? 'No informado'}
            <CopyCbuButton value={user.cbuCvu} iconOnly />
          </dd>
        </div>
        <div>
          <dt>Monedas</dt>
          <dd>{currencies.join(', ')}</dd>
        </div>
      </dl>
      <Link to="/profile">Ver perfil</Link>
    </section>
  )
}
