import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import './HomePage.scss'

const FEATURES = [
  {
    icon: 'control',
    title: 'Control personal y grupal',
    description:
      'Registrá tus consumos individuales o creá grupos para viajes, salidas o gastos del hogar.',
  },
  {
    icon: 'simplify',
    title: 'Simplificación inteligente de deudas',
    description:
      'Olvidate de hacer matemática a fin de mes. Nuestro algoritmo reduce la cantidad de transferencias al mínimo posible.',
  },
  {
    icon: 'guests',
    title: 'Perfiles Invitados (Sin registro obligatorio)',
    description:
      '¿Tus amigos no quieren bajar otra app? Incluilos mediante perfiles simulados/invitados para que nadie se quede afuera del reparto de gastos.',
  },
  {
    icon: 'currency',
    title: 'Múltiples monedas y transparencia',
    description:
      'Operá en pesos, dólares o euros con conversión automática de divisas a la fecha exacta de la transacción.',
  },
]

const STEPS = [
  'Creá un grupo o registrá tu gasto.',
  'Agregá a los participantes (usuarios o perfiles invitados).',
  'A mano calcula los saldos y te avisa cómo saldar cuentas.',
]

const USE_CASES = [
  {
    icon: 'trip',
    label: 'Viajes',
    title: 'Para viajes en grupo',
    description:
      'Coordinación sin planillas sueltas: cada gasto queda registrado y el cierre del viaje se resuelve en minutos.',
  },
  {
    icon: 'home',
    label: 'Hogar',
    title: 'Para convivientes y parejas',
    description:
      'Gastos compartidos del hogar y servicios, con un saldo claro de quién pagó qué y cuánto falta.',
  },
  {
    icon: 'friends',
    label: 'Salidas',
    title: 'Para salidas recurrentes entre amigos',
    description:
      'Meriendas, cenas o suscripciones: repartí cada salida sin hacer cuentas a mano ni perseguir transferencias.',
  },
]

const SIMPLIFIED_TRANSFERS = [
  { from: 'Sofi', to: 'Ana', amount: '$28.000' },
  { from: 'Martín', to: 'Ana', amount: '$43.000' },
]

const DETAILED_TRANSFERS = [
  { from: 'Sofi', to: 'Ana', amount: '$40.000' },
  { from: 'Martín', to: 'Ana', amount: '$40.000' },
  { from: 'Ana', to: 'Sofi', amount: '$15.000' },
  { from: 'Martín', to: 'Sofi', amount: '$15.000' },
  { from: 'Ana', to: 'Martín', amount: '$10.000' },
  { from: 'Sofi', to: 'Martín', amount: '$10.000' },
  { from: 'Sofi', to: 'Ana', amount: '$8.000' },
  { from: 'Martín', to: 'Ana', amount: '$8.000' },
]

const PARTICIPANTS = [
  { name: 'Ana', initials: 'A', balance: '+$71.000', positive: true },
  { name: 'Sofi', initials: 'S', balance: '−$28.000', positive: false },
  { name: 'Martín', initials: 'M', balance: '−$43.000', positive: false },
]

const CURRENT_YEAR = new Date().getFullYear()

function FeatureIcon({ name }) {
  const shared = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'control') {
    return (
      <svg {...shared}>
        <path d="M4 19V5m0 14h16" />
        <path d="m7 15 3-4 3 2 4-6" />
      </svg>
    )
  }

  if (name === 'simplify') {
    return (
      <svg {...shared}>
        <path d="M4 7h11l-3-3m3 3-3 3" />
        <path d="M20 17H9l3-3m-3 3 3 3" />
      </svg>
    )
  }

  if (name === 'guests') {
    return (
      <svg {...shared}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.5-3.3 2.5-5 5.5-5s5 1.7 5.5 5" />
        <path d="M18 8v6m-3-3h6" />
      </svg>
    )
  }

  return (
    <svg {...shared}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9m2.5-6.8c-.5-1-1.4-1.5-2.5-1.5-1.6 0-2.7.8-2.7 2.1 0 1.5 1.2 2 2.8 2.4 1.7.4 2.8 1 2.8 2.4 0 1.4-1.2 2.2-2.9 2.2-1.3 0-2.3-.5-2.9-1.6" />
    </svg>
  )
}

function UseCaseIcon({ name }) {
  const shared = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'trip') {
    return (
      <svg {...shared}>
        <path d="M4 8.5h16v10H4zM8 8.5V6h8v2.5" />
        <path d="M9 13h.01M15 13h.01M8 18.5V21m8-2.5V21" />
      </svg>
    )
  }

  if (name === 'home') {
    return (
      <svg {...shared}>
        <path d="m4 11 8-7 8 7" />
        <path d="M6.5 9.5V20h11V9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    )
  }

  return (
    <svg {...shared}>
      <path d="M5 10h11v5.5A3.5 3.5 0 0 1 12.5 19h-4A3.5 3.5 0 0 1 5 15.5z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 6.5c0-1 1-1.5 1-2.5M12 6.5c0-1 1-1.5 1-2.5" />
    </svg>
  )
}

function DebtMockup() {
  const [simplified, setSimplified] = useState(true)
  const transfers = simplified ? SIMPLIFIED_TRANSFERS : DETAILED_TRANSFERS
  const visibleTransfers = simplified ? transfers : transfers.slice(0, 4)

  return (
    <div className="home-mockup" aria-label="Ejemplo de resumen de deudas de un grupo">
      <div className="home-mockup__chip home-mockup__chip--top" aria-hidden="true">
        Sin planillas
      </div>

      <div className="debt-card">
        <div className="debt-card__header">
          <div>
            <p className="debt-card__kicker">Grupo compartido</p>
            <h2 className="debt-card__title">Viaje a Bariloche</h2>
          </div>
          <span className="debt-card__status">Activo</span>
        </div>

        <div className="debt-card__summary">
          <div>
            <span className="debt-card__label">Total del viaje</span>
            <strong>$219.000</strong>
          </div>
          <div>
            <span className="debt-card__label">Participantes</span>
            <strong>3 personas</strong>
          </div>
        </div>

        <ul className="debt-card__participants" aria-label="Saldos por participante">
          {PARTICIPANTS.map((participant) => (
            <li key={participant.name}>
              <div className="debt-card__participant">
                <span className="debt-card__avatar" aria-hidden="true">
                  {participant.initials}
                </span>
                <span>{participant.name}</span>
              </div>
              <span
                className={
                  participant.positive
                    ? 'debt-card__balance debt-card__balance--positive'
                    : 'debt-card__balance'
                }
              >
                {participant.balance}
              </span>
            </li>
          ))}
        </ul>

        <div className="debt-card__result" aria-live="polite">
          <div className="debt-card__result-heading">
            <div>
              <p className="debt-card__label">
                {simplified ? 'Ruta optimizada' : 'Deudas originales'}
              </p>
              <strong>
                {simplified
                  ? `${SIMPLIFIED_TRANSFERS.length} transferencias`
                  : `${DETAILED_TRANSFERS.length} transferencias`}
              </strong>
            </div>
            <span className="debt-card__savings">
              {simplified ? '−6 movimientos' : 'Sin optimizar'}
            </span>
          </div>

          <ul className="debt-card__transfers">
            {visibleTransfers.map((transfer, index) => (
              <li key={`${transfer.from}-${transfer.to}-${index}`}>
                <span>
                  <strong>{transfer.from}</strong> → <strong>{transfer.to}</strong>
                </span>
                <span>{transfer.amount}</span>
              </li>
            ))}
          </ul>

          {!simplified && (
            <p className="debt-card__more">+4 movimientos más en el desglose completo</p>
          )}
        </div>

        <button
          type="button"
          className="debt-card__toggle"
          aria-pressed={!simplified}
          onClick={() => setSimplified((current) => !current)}
        >
          {simplified ? 'Ver desglose original' : 'Ver versión simplificada'}
        </button>
      </div>

      <div className="home-mockup__chip home-mockup__chip--bottom" aria-hidden="true">
        <span className="home-mockup__dot" />
        Cálculo automático
      </div>
    </div>
  )
}

function HeroActions({ user, variant = 'hero', showSecondary = true }) {
  const primaryLabel = user
    ? variant === 'hero'
      ? 'Ir a mis Grupos'
      : 'Abrir mis grupos'
    : variant === 'hero'
      ? 'Empezar gratis'
      : 'Crear mi cuenta'
  const primaryDestination = user ? '/groups' : '/register'

  return (
    <div className={`home-actions home-actions--${variant}`}>
      <Link className="home-cta" to={primaryDestination}>
        {primaryLabel}
        <span aria-hidden="true">→</span>
      </Link>
      {!user && showSecondary && (
        <Link className="home-cta home-cta--secondary" to="/login">
          Iniciar sesión
        </Link>
      )}
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth() ?? {}

  return (
    <div className="home-page">
      <main className="home">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero__copy">
            <p className="home-eyebrow">Gastos compartidos, sin vueltas</p>
            <h1 id="home-hero-title">
              Compartí gastos sin fricción ni cuentas complicadas
            </h1>
            <p className="home-hero__subtitle">
              Gestioná tus gastos personales y grupales. Calculamos automáticamente
              quién le debe a quién y minimizamos las transferencias necesarias
              para saldar deudas.
            </p>

            <HeroActions user={user} />

            <ul className="home-trust" aria-label="Beneficios principales">
              <li>
                <span aria-hidden="true">✓</span>
                Sin planillas
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                Sin registro para invitados
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                Pesos, dólares y euros
              </li>
            </ul>
          </div>

          <div className="home-hero__visual">
            <div className="home-hero__glow" aria-hidden="true" />
            <DebtMockup />
          </div>
        </section>

        <section
          className="home-section home-features"
          id="beneficios"
          aria-labelledby="home-features-title"
        >
          <div className="home-section__heading">
            <p className="home-eyebrow">Todo en un mismo lugar</p>
            <h2 id="home-features-title">Menos cuentas pendientes, más tiempo para disfrutar</h2>
            <p>
              A mano reúne lo que hoy vive entre chats, planillas y tickets sueltos.
              Vos cargás los gastos; nosotros ordenamos el resto.
            </p>
          </div>

          <ul className="home-feature-grid">
            {FEATURES.map((feature) => (
              <li className="home-feature-card" key={feature.title}>
                <span className="home-feature-card__icon">
                  <FeatureIcon name={feature.icon} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-band" aria-labelledby="home-how-title">
          <div className="home-section home-how">
            <div className="home-section__heading">
              <p className="home-eyebrow">Cómo funciona</p>
              <h2 id="home-how-title">Tres pasos y listo</h2>
              <p>Sin configuraciones eternas ni manuales. Empezás a usarlo en el momento.</p>
            </div>

            <ol className="home-steps">
              {STEPS.map((step, index) => (
                <li className="home-step" key={step}>
                  <span className="home-step__number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="home-section home-use-cases"
          aria-labelledby="home-use-cases-title"
        >
          <div className="home-section__heading">
            <p className="home-eyebrow">Para tu día a día</p>
            <h2 id="home-use-cases-title">Pensado para la vida real</h2>
            <p>
              Cada grupo tiene su propia dinámica. A mano se adapta a la forma en que
              ya compartís gastos.
            </p>
          </div>

          <ul className="home-usecase-grid">
            {USE_CASES.map((useCase) => (
              <li className="home-usecase" key={useCase.title}>
                <div className="home-usecase__top">
                  <span className="home-usecase__icon">
                    <UseCaseIcon name={useCase.icon} />
                  </span>
                  <span className="home-usecase__label">{useCase.label}</span>
                </div>
                <h3>{useCase.title}</h3>
                <p>{useCase.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-section home-final" aria-labelledby="home-final-title">
          <div className="home-final__card">
            <div>
              <p className="home-eyebrow">Empezá hoy</p>
              <h2 id="home-final-title">Dejá de perseguir transferencias</h2>
              <p>
                Creá tu primer grupo o registrá un gasto personal. A mano hace las
                cuentas para que vos te ocupes de lo importante.
              </p>
            </div>
            <HeroActions user={user} variant="final" showSecondary={false} />
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__brand">
            <Link className="home-footer__logo" to="/">
              <img
                className="home-footer__mark"
                src="/logo.png"
                alt=""
                aria-hidden="true"
              />
              A mano
            </Link>
            <p>
              Gastos compartidos simples, claros y sin fricción. Hecho para grupos
              que quieren resolver cuentas sin complicarse.
            </p>
          </div>

          <nav className="home-footer__links" aria-label="Navegación del pie de página">
            <Link to="/">Inicio</Link>
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/register">Registrarse</Link>
          </nav>

          <div className="home-footer__meta">
            <a
              href="https://github.com/amano-fiuba/amano"
              target="_blank"
              rel="noreferrer"
            >
              Repositorio en GitHub
            </a>
            <p>© {CURRENT_YEAR} A mano. Todos los derechos reservados.</p>
            <p>
              Términos de uso: usá A mano de buena fe, cuidá los datos de tu grupo y
              resolvé las cuentas con transparencia.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
