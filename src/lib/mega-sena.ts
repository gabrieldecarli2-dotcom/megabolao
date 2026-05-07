export type MegaSenaLatestResult = {
  contestNumber: string
  drawDate: string
  numbers: number[]
  originalDate: string
  source: string
}

const MEGA_SENA_LATEST_URL = 'https://loteriascaixa-api.herokuapp.com/api/megasena/latest'

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

export async function fetchLatestMegaSenaResult(): Promise<MegaSenaLatestResult> {
  const response = await fetch(MEGA_SENA_LATEST_URL, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Nao foi possivel consultar a API da Mega-Sena.')
  }

  const result = await response.json()
  const drawDate = parseBrazilianDate(result?.data)
  const numbers = parseNumbers(result?.dezenas)
  const contestNumber = result?.concurso ? String(result.concurso) : ''

  if (!contestNumber || !drawDate || numbers.length !== 6) {
    throw new Error('A API retornou um resultado incompleto.')
  }

  return {
    contestNumber,
    drawDate,
    numbers,
    originalDate: result.data,
    source: MEGA_SENA_LATEST_URL,
  }
}
