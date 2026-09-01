import iconEntradas from '../../assets/iconEntradas.svg'
import iconEntradasActive from '../../assets/iconEntradasActive.svg'
import iconHome from '../../assets/iconHome.svg'
import iconHomeActive from '../../assets/iconHomeActive.svg'
import iconMovimientos from '../../assets/iconMovimientos.svg'
import iconMovimientosActive from '../../assets/iconMovimientosActive.svg'
import { LiveIndicator } from '../LiveIndicator/LiveIndicator'
import './Navbar.css'

export type NavbarItemId = 'home' | 'movements' | 'entries'

const NAV_ITEMS: Array<{
  id: NavbarItemId
  label: string
  icon: string
  activeIcon: string
}> = [
  {
    id: 'home',
    label: 'Home',
    icon: iconHome,
    activeIcon: iconHomeActive,
  },
  {
    id: 'movements',
    label: 'Movimientos',
    icon: iconMovimientos,
    activeIcon: iconMovimientosActive,
  },
  {
    id: 'entries',
    label: 'Entradas',
    icon: iconEntradas,
    activeIcon: iconEntradasActive,
  },
]

interface NavbarProps {
  hasActiveEntry?: boolean
  activeItem?: NavbarItemId
  onNavigate?: (item: NavbarItemId) => void
}

export function Navbar({
  hasActiveEntry = false,
  activeItem = 'home',
  onNavigate,
}: NavbarProps) {
  return (
    <nav
      className="navbar-container"
      aria-label="Navegación principal"
      data-node-id="188:3113"
      data-has-active-entry={hasActiveEntry}
    >
      <div className="navbar" data-active-item={activeItem}>
        <span className="navbar__active-pill" aria-hidden="true" />
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeItem
          const showsLiveIndicator = item.label === 'Entradas' && hasActiveEntry

          return (
            <button
              className={`navbar__item${isActive ? ' navbar__item--active' : ''}`}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={showsLiveIndicator
                ? 'Entradas, participación activa'
                : undefined}
              onClick={() => onNavigate?.(item.id)}
              key={item.label}
            >
              <span className="navbar__icon-wrap">
                <img
                  className="navbar__icon navbar__icon--default"
                  src={item.icon}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className="navbar__icon navbar__icon--active"
                  src={item.activeIcon}
                  alt=""
                  aria-hidden="true"
                />
                {showsLiveIndicator && (
                  <LiveIndicator className="navbar__live-indicator" />
                )}
              </span>
              <span className="navbar__label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
