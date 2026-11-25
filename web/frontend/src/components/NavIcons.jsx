// Íconos de línea de la barra superior: heredan el color con currentColor.
function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function CameraIcon() {
  return (
    <Icon>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </Icon>
  )
}

export function PencilIcon() {
  return (
    <Icon>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 7.5 3 3" />
    </Icon>
  )
}

export function FriendsIcon() {
  return (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2" />
    </Icon>
  )
}

export function GroupsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="7.5" r="3.5" />
      <circle cx="5.5" cy="10" r="2.25" />
      <circle cx="18.5" cy="10" r="2.25" />
      <path d="M6 20c.4-3.6 2.6-5.5 6-5.5s5.6 1.9 6 5.5" />
      <path d="M1.5 18c.2-2.2 1.3-3.6 3-4M22.5 18c-.2-2.2-1.3-3.6-3-4" />
    </Icon>
  )
}

export function ActivityIcon() {
  return (
    <Icon>
      <path d="M5 20v-8M12 20V4M19 20v-5" />
    </Icon>
  )
}

// Torta con una porción separada: estadísticas (032).
export function StatisticsIcon() {
  return (
    <Icon>
      <path d="M11 4a8 8 0 1 0 8 8h-8z" />
      <path d="M14 2.5A8 8 0 0 1 21.5 10H14z" />
    </Icon>
  )
}

export function BellIcon() {
  return (
    <Icon>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </Icon>
  )
}

// Luna para pasar a modo oscuro y sol para volver al claro.
export function MoonIcon() {
  return (
    <Icon>
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
    </Icon>
  )
}

export function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  )
}

// Persona saliendo por una puerta: cierre de sesión.
export function LogoutIcon() {
  return (
    <Icon>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M17 12H9" />
      <path d="m12 9-3 3 3 3" />
      <circle cx="19" cy="7" r="1.8" />
      <path d="M16 20c.4-3 1.5-4.5 3-4.5s2.6 1.5 3 4.5" />
    </Icon>
  )
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  )
}


// Reloj con flecha hacia atrás: "Historial de actividad".
export function HistoryIcon() {
  return (
    <Icon>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Icon>
  )
}

// Dos engranajes chicos: la configuración de un grupo.
export function GroupSettingsIcon() {
  return (
    <Icon>
      <circle cx="8.5" cy="8.5" r="3.3" />
      <circle cx="8.5" cy="8.5" r="1" />
      <path d="M11.8 8.5h1.7M10.8 10.8l1.2 1.2M8.5 11.8v1.7M6.2 10.8 5 12M5.2 8.5H3.5M6.2 6.2 5 5M8.5 5.2V3.5M10.8 6.2 12 5" />
      <circle cx="16.5" cy="16" r="2.4" />
      <path d="m18.7 16.9 1.4.6M17.4 18.2l.6 1.4M15.6 18.2l-.6 1.4M14.3 16.9l-1.4.6M14.3 15.1l-1.4-.6M15.6 13.8l-.6-1.4M17.4 13.8l.6-1.4M18.7 15.1l1.4-.6" />
    </Icon>
  )
}

// Puerta con una flecha que sale: "Salir" del grupo.
export function ExitIcon() {
  return (
    <Icon>
      <path d="M13 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7" />
      <path d="M10 12h11" />
      <path d="m17 8 4 4-4 4" />
     </Icon>
  )
}

// Billete: marca a quien pagó un gasto.
export function PaidIcon() {
  return (
    <Icon>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v.01M18 14.5v.01" />

    </Icon>
  )
}

// Una persona: gasto personal (027, submenú "Registrar gasto").
export function PersonIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.8 3.1-5.8 7-5.8s6.4 2 7 5.8" />
    </Icon>
  )
}

// Dos personas: gasto con un amigo (027). El gasto grupal usa GroupsIcon.
export function FriendIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8.5" r="3" />
      <circle cx="16" cy="8.5" r="3" />
      <path d="M2.5 19.5c.5-3.2 2.6-5 5.5-5 1.6 0 2.9.5 3.9 1.5" />
      <path d="M21.5 19.5c-.5-3.2-2.6-5-5.5-5-1.6 0-2.9.5-3.9 1.5" />
    </Icon>
  )
}

// Flecha hacia la derecha: ítem que abre un submenú.
export function ChevronRightIcon() {
  return (
    <Icon>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  )
}

// Flecha hacia la izquierda: volver del submenú en móvil.
export function ChevronLeftIcon() {
  return (
    <Icon>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  )
}

// Barra inferior de la app móvil (mobile/MobileTabBar).
export function HomeIcon() {
  return (
    <Icon>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9h4.5v-5h3v5H18v-9" />
    </Icon>
  )
}

export function MoreIcon() {
  return (
    <Icon>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </Icon>
  )
}

export function ProfileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  )
}

export function FilterIcon() {
  return (
    <Icon>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Icon>
  )
}
