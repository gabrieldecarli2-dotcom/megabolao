import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

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

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request)

  if (!authUser) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  try {
    const response = await fetch(MEGA_SENA_LATEST_URL, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Nao foi possivel consultar a API da Mega-Sena.' },
        { status: 502 },
      )
    }

    const result = await response.json()
    const drawDate = parseBrazilianDate(result?.data)
    const numbers = parseNumbers(result?.dezenas)
    const contestNumber = result?.concurso ? String(result.concurso) : ''

    if (!contestNumber || !drawDate || numbers.length !== 6) {
      return NextResponse.json(
        { error: 'A API retornou um resultado incompleto.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      contestNumber,
      drawDate,
      numbers,
      originalDate: result.data,
      source: MEGA_SENA_LATEST_URL,
    })
  } catch (error) {
    console.error('Falha ao consultar resultado da Mega-Sena', error)

    return NextResponse.json(
      { error: 'Falha na comunicacao com a API da Mega-Sena.' },
      { status: 502 },
    )
  }
}
