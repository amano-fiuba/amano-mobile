import { Link } from 'react-router'

// Bienvenida de la app (amano-mobile specs/002-diseno-movil-y-notificaciones): en el celular la portada de
// la web (varias pantallas de scroll) se reduce a lo esencial y entra en una.
export default function MobileWelcome() {
  return (
    <main className="mobile-welcome">
      <div className="mobile-welcome__brand">
        <img src="/logo.png" alt="" width={118} height={64} />
        <span>A mano</span>
      </div>
      <h1>Compartí gastos sin fricción ni cuentas complicadas</h1>
      <ul className="mobile-welcome__points">
        <li>Gastos personales y grupales en un solo lugar</li>
        <li>Calculamos quién le debe a quién</li>
        <li>Menos transferencias para saldar las deudas</li>
      </ul>
      <div className="mobile-welcome__actions">
        <Link className="buttonLink" to="/register">
          Crear cuenta
        </Link>
        <Link className="mobile-welcome__secondary" to="/login">
          Ya tengo cuenta · Iniciar sesión
        </Link>
      </div>
    </main>
  )
}
