import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import closeIcon from '../../assets/iconClose.svg'
import type { ProfileInfoDefinition } from './profileInfoContent'
import './ProfileInfoModal.css'

const MODAL_MOTION_MS = 300
const OVERLAY_BLUR_STYLE = {
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
} satisfies CSSProperties

interface ProfileInfoModalProps {
  info: ProfileInfoDefinition
  onClose: () => void
}

export function ProfileInfoModal({ info, onClose }: ProfileInfoModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const isClosingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)

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
      className={`profile-info-modal__container${isClosing ? ' profile-info-modal__container--closing' : ''}`}
    >
      <button
        className="profile-info-modal__overlay"
        style={OVERLAY_BLUR_STYLE}
        type="button"
        aria-label={`Cerrar información sobre ${info.title}`}
        onClick={requestClose}
      />

      <section
        ref={dialogRef}
        className="profile-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-info-modal-title"
        data-node-id={info.nodeId}
        tabIndex={-1}
      >
        <header className="profile-info-modal__header">
          <h2 id="profile-info-modal-title">{info.title}</h2>
          <button
            className="profile-info-modal__close"
            type="button"
            aria-label={`Cerrar información sobre ${info.title}`}
            onClick={requestClose}
          >
            <img src={closeIcon} alt="" aria-hidden="true" />
          </button>
        </header>

        <div
          className={`profile-info-modal__content${info.summary ? ' profile-info-modal__content--with-summary' : ''}`}
        >
          <div className="profile-info-modal__paragraphs">
            {info.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {info.summary ? (
            <p className="profile-info-modal__summary">{info.summary}</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
