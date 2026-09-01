import logoBTC from '../../assets/logoBTC.png'
import logoBTCBack from '../../assets/logoBTCBack.png'
import './SubHeader.css'

interface SubHeaderProps {
  isCompact: boolean
  date: string
  startTime: string
  endTime: string
  minutes: string
  seconds: string
}

export function SubHeader({
  isCompact,
  date,
  startTime,
  endTime,
  minutes,
  seconds,
}: SubHeaderProps) {
  return (
    <div
      className={`sub-header-slot${isCompact ? ' sub-header-slot--compact' : ''}`}
    >
      <section
        className={`sub-header${isCompact ? ' sub-header--sticky' : ''}`}
        aria-label="Ronda actual de Bitcoin"
        data-node-id={isCompact ? '198:3358' : '188:2920'}
      >
        <div className="sub-header__market">
          <span
            className="sub-header__coin"
            role="img"
            aria-label="Bitcoin"
          >
            <img
              className="sub-header__logo sub-header__logo--front"
              src={logoBTC}
              alt=""
              aria-hidden="true"
            />
            <img
              className="sub-header__logo sub-header__logo--back"
              src={logoBTCBack}
              alt=""
              aria-hidden="true"
            />
          </span>

          <div className="sub-header__details">
            <h1 className="sub-header__title">BTC / 15 Min</h1>
            <div className="sub-header__schedule">
              <span>{date}</span>
              <span className="sub-header__separator" aria-hidden="true" />
              <span>
                {startTime} - {endTime}
              </span>
            </div>
          </div>
        </div>

        <div
          className="sub-header__timer"
          aria-label={`${minutes} minutos y ${seconds} segundos restantes`}
        >
          <div className="sub-header__time-unit">
            <span className="sub-header__time-value">{minutes}</span>
            <span className="sub-header__time-label">MIN.</span>
          </div>
          <span className="sub-header__time-colon" aria-hidden="true">
            :
          </span>
          <div className="sub-header__time-unit">
            <span className="sub-header__time-value">{seconds}</span>
            <span className="sub-header__time-label">SEG.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
