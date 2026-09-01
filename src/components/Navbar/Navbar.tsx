import iconEntradas from '../../assets/iconEntradas.svg'
import iconHomeActive from '../../assets/iconHomeActive.svg'
import iconMovimientos from '../../assets/iconMovimientos.svg'
import './Navbar.css'

const NAV_ITEMS = [
  { label: 'Home', icon: iconHomeActive, active: true },
  { label: 'Movimientos', icon: iconMovimientos, active: false },
  { label: 'Entradas', icon: iconEntradas, active: false },
]

interface NavbarProps {
  hasActiveEntry?: boolean
}

export function Navbar({ hasActiveEntry = false }: NavbarProps) {
  return (
    <nav
      className="navbar-container"
      aria-label="Navegación principal"
      data-node-id="188:3113"
      data-has-active-entry={hasActiveEntry}
    >
      <div className="navbar">
        {NAV_ITEMS.map((item) => {
          const showsLiveIndicator = item.label === 'Entradas' && hasActiveEntry

          return (
            <button
              className={`navbar__item${item.active ? ' navbar__item--active' : ''}`}
              type="button"
              aria-current={item.active ? 'page' : undefined}
              aria-label={showsLiveIndicator
                ? 'Entradas, participación activa'
                : undefined}
              key={item.label}
            >
              <span className="navbar__icon-wrap">
                <img className="navbar__icon" src={item.icon} alt="" aria-hidden="true" />
                {showsLiveIndicator && (
                  <span className="navbar__live-indicator" aria-hidden="true" />
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
