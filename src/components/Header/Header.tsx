import logoPulse from '../../assets/logoPulse.svg'
import iconBalanceHeader from '../../assets/iconBalanceHeader.svg'
import iconPerfilHeader from '../../assets/iconPerfilHeader.svg'
import './Header.css'

interface HeaderProps {
  balance: string
  balanceCents?: number
  isProfileOpen: boolean
  onProfileOpen: () => void
}

export function Header({
  balance,
  balanceCents,
  isProfileOpen,
  onProfileOpen,
}: HeaderProps) {
  return (
    <header
      className="header"
      data-node-id="188:2914"
      data-balance-cents={balanceCents}
    >
      <div className="header__brand">
        <img className="header__logo" src={logoPulse} alt="Pulse" />
      </div>

      <div className="header__actions">
        <button className="header__balance" type="button" aria-label={`Saldo: ${balance}`}>
          <span className="header__balance-copy">
            <span className="header__balance-value">{balance}</span>
            <span className="header__balance-label">BALANCE</span>
          </span>
          <span className="header__balance-icon" aria-hidden="true">
            <img src={iconBalanceHeader} alt="" />
          </span>
        </button>

        <button
          className="header__profile"
          type="button"
          aria-label="Abrir mi perfil"
          aria-haspopup="dialog"
          aria-expanded={isProfileOpen}
          onClick={onProfileOpen}
        >
          <img src={iconPerfilHeader} alt="" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
