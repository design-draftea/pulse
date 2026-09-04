import iconChevronRight from '../../assets/iconChevronRight.svg'
import './PulseFooter.css'

const FOOTER_LINKS = [
  { id: 'terms', label: 'Términos y condiciones' },
  { id: 'privacy', label: 'Aviso de privacidad' },
  { id: 'faq', label: 'Preguntas frecuentes' },
  { id: 'assistant', label: 'Pregúntale a Pulse' },
  { id: 'support', label: 'Hablar con alguien' },
]

interface PulseFooterProps {
  onAssistantOpen?: () => void
  onHelpOpen?: () => void
}

export function PulseFooter({ onAssistantOpen, onHelpOpen }: PulseFooterProps) {
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
          {FOOTER_LINKS.map((link) => (
            <button
              className="pulse-footer__link"
              type="button"
              key={link.id}
              onClick={link.id === 'faq'
                ? onHelpOpen
                : link.id === 'assistant' ? onAssistantOpen : undefined}
            >
              <img src={iconChevronRight} alt="" aria-hidden="true" />
              <span>{link.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </footer>
  )
}
