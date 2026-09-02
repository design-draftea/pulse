import { useEffect } from 'react'

import bgHeaderBS from '../assets/bgHeaderBS.webp'
import bgToasterSucesso from '../assets/bgToasterSucesso.webp'
import ilustraSucesso from '../assets/ilustraSucesso.webp'
import {
  createBrowserImageWarmer,
  warmImageSources,
} from '../services/assetWarmup'

/**
 * Imagens pesadas que não pertencem à primeira tela: o fundo e a ilustração do
 * toaster de sucesso e o fundo compartilhado pelo betslip e pelo bottom sheet
 * de perfil. As demais imagens já são pedidas na abertura, pelo `App.css` ou
 * pelo `SubHeader`.
 */
const DEFERRED_IMAGE_SOURCES = [bgToasterSucesso, ilustraSucesso, bgHeaderBS]

/** Compartilhado entre montagens para o efeito duplo do StrictMode não repetir a busca. */
const warmedSources = new Set<string>()

const IDLE_TIMEOUT_MS = 2000
const FALLBACK_DELAY_MS = 1200

/**
 * Aquece as imagens diferidas depois que a aplicação já renderizou, em tempo
 * ocioso, para não disputar banda com o feed de preço nem atrasar a primeira
 * pintura.
 */
export function useDeferredAssetWarmup(): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let cancelled = false

    const start = () => {
      if (cancelled) {
        return
      }
      void warmImageSources(
        DEFERRED_IMAGE_SOURCES,
        warmedSources,
        createBrowserImageWarmer(),
      )
    }

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(start, {
        timeout: IDLE_TIMEOUT_MS,
      })
      return () => {
        cancelled = true
        window.cancelIdleCallback?.(handle)
      }
    }

    const handle = window.setTimeout(start, FALLBACK_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [])
}
