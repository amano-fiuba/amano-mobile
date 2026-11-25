import { Link } from 'react-router'

// Enlace de vuelta a la pantalla principal, arriba a la izquierda del título.
export default function HomeLink() {
  return (
    <Link className="home-link" to="/">
      Ir a Pantalla principal
    </Link>
  )
}
