import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import closeIcon from '../../assets/iconClose.svg'
import './InfoModal.css'

const MODAL_MOTION_MS = 300
const OVERLAY_BLUR_STYLE = {
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
} satisfies CSSProperties

export interface InfoModalContent {
  nodeId?: string
  title: string
  paragraphs: string[]
  summary?: string
}

interface InfoModalProps {
  containerClassName?: string
  info: InfoModalContent
  onClose: () => void
}

export function InfoModal({ containerClassName, info, onClose }: InfoModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const isClosingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return

    isClosingRef.current = true
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(onClose, MODAL_MOTION_MS)
  }, [onClose])

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true })
    })

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopImmediatePropagation()
      requestClose()
    }

    window.addEventListener('keydown', handleEscape, true)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleEscape, true)
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [requestClose])

  return (
    <div
      className={`info-modal__container${isClosing ? ' info-modal__container--closing' : ''}${containerClassName ? ` ${containerClassName}` : ''}`}
    >
      <button
        className="info-modal__overlay"
        style={OVERLAY_BLUR_STYLE}
        type="button"
        aria-label={`Cerrar información sobre ${info.title}`}
        onClick={requestClose}
      />

      <section
        ref={dialogRef}
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-node-id={info.nodeId}
        tabIndex={-1}
      >
        <header className="info-modal__header">
          <h2 id={titleId}>{info.title}</h2>
          <button
            className="info-modal__close"
            type="button"
            aria-label={`Cerrar información sobre ${info.title}`}
            onClick={requestClose}
          >
            <img src={closeIcon} alt="" aria-hidden="true" />
          </button>
        </header>

        <div
          className={`info-modal__content${info.summary ? ' info-modal__content--with-summary' : ''}`}
        >
          <div className="info-modal__paragraphs">
            {info.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {info.summary ? (
            <p className="info-modal__summary">{info.summary}</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
