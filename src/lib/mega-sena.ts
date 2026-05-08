export type MegaSenaLatestResult = {
  contestNumber: string
  drawDate: string
  numbers: number[]
  originalDate: string
  nextContestNumber: string | null
  nextDrawDate: string | null
  originalNextDrawDate: string | null
  source: string
}

const CAIXA_MEGA_SENA_LATEST_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena'
const FALLBACK_MEGA_SENA_LATEST_URL = 'https://loteriascaixa-api.herokuapp.com/api/megasena/latest'

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

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Nao foi possivel consultar a API da Mega-Sena.')
  }

  return response.json()
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
  try {
    const caixaResult = await fetchJson(CAIXA_MEGA_SENA_LATEST_URL)
    return normalizeCaixaResult(caixaResult)
  } catch (error) {
    console.error('Falha ao consultar API oficial da Caixa, usando fallback', error)
    const fallbackResult = await fetchJson(FALLBACK_MEGA_SENA_LATEST_URL)
    return normalizeFallbackResult(fallbackResult)
  }
}
