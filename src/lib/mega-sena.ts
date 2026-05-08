export type MegaSenaLatestResult = {
  contestNumber: string
  drawDate: string
  numbers: number[]
  originalDate: string
  nextContestNumber: string | null
  nextDrawDate: string | null
  originalNextDrawDate: string | null
  source: string
  providerErrors?: string[]
}

const CAIXA_MEGA_SENA_LATEST_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena'
const CAIXA_MEGA_SENA_LATEST_URL_WITH_SLASH = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/'
const FALLBACK_MEGA_SENA_LATEST_URL = 'https://loteriascaixa-api.herokuapp.com/api/megasena/latest'
const FALLBACK_MEGA_SENA_CONTEST_URL = 'https://loteriascaixa-api.herokuapp.com/api/megasena'

function parseBrazilianDate(date: unknown) {
  if (typeof date !== 'string') return null
  const [day, month, year] = date.split('/')
  if (!day || !month || !year) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseNumbers(numbers: unknown) {
  if (!Array.isArray(numbers)) return []

  return numbers
    .map((number) => Number(number))
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 60)
    .sort((a, b) => a - b)
}

const CAIXA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://loterias.caixa.gov.br/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
}

async function fetchJson(url: string, headers: Record<string, string> = { Accept: 'application/json' }) {
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Nao foi possivel consultar a API da Mega-Sena (${response.status}).`)
  }

  const text = await response.text()
  return JSON.parse(text)
}

function normalizeCaixaResult(result: Record<string, unknown>): MegaSenaLatestResult {
  const drawDate = parseBrazilianDate(result?.dataApuracao)
  const nextDrawDate = parseBrazilianDate(result?.dataProximoConcurso)
  const numbers = parseNumbers(result?.listaDezenas)
  const contestNumber = result?.numero ? String(result.numero) : ''
  const nextContestNumber = result?.numeroConcursoProximo ? String(result.numeroConcursoProximo) : null

  if (!contestNumber || !drawDate || numbers.length !== 6) {
    throw new Error('A API da Caixa retornou um resultado incompleto.')
  }

  return {
    contestNumber,
    drawDate,
    numbers,
    originalDate: String(result.dataApuracao),
    nextContestNumber,
    nextDrawDate,
    originalNextDrawDate: result.dataProximoConcurso ? String(result.dataProximoConcurso) : null,
    source: CAIXA_MEGA_SENA_LATEST_URL,
  }
}

function normalizeFallbackResult(result: Record<string, unknown>): MegaSenaLatestResult {
  const drawDate = parseBrazilianDate(result?.data)
  const nextDrawDate = parseBrazilianDate(result?.dataProximoConcurso)
  const numbers = parseNumbers(result?.dezenas)
  const contestNumber = result?.concurso ? String(result.concurso) : ''
  const nextContestNumber = result?.proximoConcurso ? String(result.proximoConcurso) : null

  if (!contestNumber || !drawDate || numbers.length !== 6) {
    throw new Error('A API retornou um resultado incompleto.')
  }

  return {
    contestNumber,
    drawDate,
    numbers,
    originalDate: String(result.data),
    nextContestNumber,
    nextDrawDate,
    originalNextDrawDate: result.dataProximoConcurso ? String(result.dataProximoConcurso) : null,
    source: FALLBACK_MEGA_SENA_LATEST_URL,
  }
}

export async function fetchLatestMegaSenaResult(): Promise<MegaSenaLatestResult> {
  const providerErrors: string[] = []

  try {
    const caixaResult = await fetchJson(CAIXA_MEGA_SENA_LATEST_URL_WITH_SLASH, CAIXA_HEADERS)
    return normalizeCaixaResult(caixaResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido na API oficial da Caixa com barra.'
    providerErrors.push(`caixa_slash: ${message}`)
    console.error('Falha ao consultar API oficial da Caixa com barra', error)
  }

  try {
    const caixaResult = await fetchJson(CAIXA_MEGA_SENA_LATEST_URL, CAIXA_HEADERS)
    return normalizeCaixaResult(caixaResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido na API oficial da Caixa.'
    providerErrors.push(`caixa: ${message}`)
    console.error('Falha ao consultar API oficial da Caixa, usando fallback', error)
  }

  try {
    const fallbackResult = await fetchJson(FALLBACK_MEGA_SENA_LATEST_URL)
    const normalizedFallback = normalizeFallbackResult(fallbackResult)

    if (normalizedFallback.nextContestNumber) {
      try {
        const nextContestResult = await fetchJson(`${FALLBACK_MEGA_SENA_CONTEST_URL}/${normalizedFallback.nextContestNumber}`)
        const normalizedNextContest = normalizeFallbackResult(nextContestResult)

        if (Number(normalizedNextContest.contestNumber) > Number(normalizedFallback.contestNumber)) {
          return {
            ...normalizedNextContest,
            source: `${FALLBACK_MEGA_SENA_CONTEST_URL}/${normalizedFallback.nextContestNumber}`,
            providerErrors,
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao buscar proximo concurso no fallback.'
        providerErrors.push(`fallback_next_contest: ${message}`)
      }
    }

    return {
      ...normalizedFallback,
      providerErrors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido na API fallback.'
    providerErrors.push(`fallback: ${message}`)
    throw new Error(providerErrors.join(' | '))
  }
}
