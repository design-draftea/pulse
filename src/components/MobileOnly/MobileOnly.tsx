import './MobileOnly.css'

export function MobileOnly() {
  return (
    <div className="mobile-only">
      <div className="mobile-only__content">
        <div className="mobile-only__icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="2"
              width="14"
              height="20"
              rx="2"
              stroke="#fbfbfb"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="12" cy="18" r="1" fill="#fbfbfb" />
          </svg>
        </div>

        <h1 className="mobile-only__title">Versão Mobile Only</h1>

        <p className="mobile-only__description">
          Esta aplicação foi desenhada exclusivamente para dispositivos móveis.
          Por favor, reduza a largura do seu navegador ou acesse através do seu
          celular.
        </p>

        <span className="mobile-only__hint">
          Largura máxima suportada: 499px
        </span>
      </div>
    </div>
  )
}
