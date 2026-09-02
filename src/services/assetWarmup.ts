/**
 * Aquecimento das imagens que só entram no DOM depois da primeira tela.
 *
 * O navegador só busca um arquivo quando o elemento que o usa é montado.
 * Como o fundo e a ilustração do toaster de sucesso vivem em um componente
 * que aparece apenas depois da compra, a primeira compra da sessão mostrava
 * o toaster antes da imagem chegar. Aquecer as origens em tempo ocioso
 * resolve isso sem atrasar a primeira pintura.
 */

export type ImageWarmer = (source: string) => Promise<unknown>

/** Origens ainda não aquecidas, na ordem recebida e sem repetição. */
export function selectColdSources(
  sources: readonly string[],
  warmed: ReadonlySet<string>,
): string[] {
  const cold: string[] = []

  for (const source of sources) {
    if (source === '' || warmed.has(source) || cold.includes(source)) {
      continue
    }
    cold.push(source)
  }

  return cold
}

/**
 * Busca e decodifica as origens ainda frias e devolve as que ficaram prontas.
 * Uma origem só entra em `warmed` quando carrega: uma falha de rede não deve
 * impedir uma tentativa futura, e o componente continua funcionando sem o
 * aquecimento, apenas com a imagem chegando mais tarde.
 */
export async function warmImageSources(
  sources: readonly string[],
  warmed: Set<string>,
  warmImage: ImageWarmer,
): Promise<string[]> {
  const cold = selectColdSources(sources, warmed)

  const results = await Promise.all(
    cold.map(async (source) => {
      try {
        await warmImage(source)
        warmed.add(source)
        return source
      } catch {
        return null
      }
    }),
  )

  return results.filter((source): source is string => source !== null)
}

/**
 * Aquecedor real do navegador. `decode()` garante que a imagem já esteja
 * decodificada quando o elemento montar, e não apenas baixada; quando ele não
 * existe, o `load` do próprio elemento cumpre o papel de sinal de conclusão.
 */
export function createBrowserImageWarmer(): ImageWarmer {
  return (source) =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = source

      if (typeof image.decode === 'function') {
        image.decode().then(resolve, reject)
        return
      }

      image.addEventListener('load', () => resolve(image), { once: true })
      image.addEventListener('error', () => reject(new Error(source)), {
        once: true,
      })
    })
}
