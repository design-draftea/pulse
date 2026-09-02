import iconChevronRight from '../../assets/iconChevronRight.svg'
import './PulseFooter.css'

const FOOTER_LINKS = [
  'Términos y condiciones',
  'Aviso de privacidad',
  'Preguntas frecuentes',
  'Soporte',
]

export function PulseFooter() {
  return (
    <footer className="pulse-footer" data-node-id="188:3060">
      <div className="pulse-footer__base">
        <div className="pulse-footer__about">
          <h2 className="pulse-footer__title">¿Qué es Draftea Pulse?</h2>

          <p className="pulse-footer__description">
            Elige si el precio del activo terminará por encima o por debajo del
            valor inicial de la ronda. Cuando termine el tiempo, el precio final
            define el resultado.
          </p>
        </div>

        <nav className="pulse-footer__links" aria-label="Enlaces de Pulse">
          {FOOTER_LINKS.map((label) => (
            <button className="pulse-footer__link" type="button" key={label}>
              <img src={iconChevronRight} alt="" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </footer>
  )
}
