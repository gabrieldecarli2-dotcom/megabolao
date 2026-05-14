import { fetchLatestMegaSenaResult, type MegaSenaLatestResult } from './mega-sena'
import { getSupabaseAdmin } from './supabase-admin'

type DrawSource = 'manual' | 'api' | 'cron'

type RegisterDrawPayload = {
  roundId: string
  contestNumber: string
  drawDate: string
  numbers: number[]
  source: DrawSource
}

function uniqueSortedNumbers(numbers: number[]) {
  return Array.from(new Set(numbers))
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 60)
    .sort((a, b) => a - b)
}

function getBrazilDateTimeParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    hour12: false,
  }).formatToParts(new Date())

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || ''

  return {
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    hour: Number(getPart('hour')),
  }
}

function shouldTryAutomaticRegistration(latestResult: MegaSenaLatestResult) {
  const brazilNow = getBrazilDateTimeParts()
  const latestDrawIsInFuture = latestResult.drawDate > brazilNow.date

  if (latestDrawIsInFuture) {
    return {
      shouldRun: false,
      reason: 'future_draw_date',
      brazilNow,
    }
  }

  return {
    shouldRun: true,
    reason: null,
    brazilNow,
  }
}

export async function registerDrawForRound(payload: RegisterDrawPayload) {
  const supabaseAdmin = getSupabaseAdmin()
  const numbers = uniqueSortedNumbers(payload.numbers)

  if (numbers.length !== 6) {
    throw new Error('Resultado da Mega-Sena invalido.')
  }

  const { data: round, error: roundError } = await supabaseAdmin
    .from('rounds')
    .select('*')
    .eq('id', payload.roundId)
    .maybeSingle()

  if (roundError || !round) {
    throw new Error('Rodada nao encontrada.')
  }

  if (round.status === 'finished') {
    return { status: 'skipped', reason: 'round_finished', round, draw: null }
  }

  if (round.start_date && payload.drawDate < round.start_date) {
    return { status: 'skipped', reason: 'draw_before_round_start', round, draw: null }
  }

  if (round.end_date && payload.drawDate < round.end_date) {
    return { status: 'skipped', reason: 'draw_before_round_end', round, draw: null }
  }

  const { data: existingDraw } = await supabaseAdmin
    .from('draw_results')
    .select('id')
    .eq('round_id', payload.roundId)
    .eq('contest_number', payload.contestNumber)
    .maybeSingle()

  if (existingDraw) {
    return { status: 'skipped', reason: 'contest_already_registered', round, draw: existingDraw }
  }

  const { data: previousDraws } = await supabaseAdmin
    .from('draw_results')
    .select('numbers')
    .eq('round_id', payload.roundId)
    .order('draw_date', { ascending: true })

  const isFirst = (previousDraws || []).length === 0
  const { data: draw, error: drawError } = await supabaseAdmin
    .from('draw_results')
    .insert({
      round_id: payload.roundId,
      contest_number: payload.contestNumber,
      draw_date: payload.drawDate,
      numbers,
      source: payload.source,
      is_first: isFirst,
    })
    .select()
    .single()

  if (drawError || !draw) {
    throw new Error(drawError?.message || 'Erro ao salvar sorteio.')
  }

  const previouslyDrawnNumbers = (previousDraws || []).flatMap((previousDraw: { numbers?: number[] }) => previousDraw.numbers || [])
  const allDrawnNumbers = Array.from(new Set([...previouslyDrawnNumbers, ...numbers]))

  const { data: paidEntries } = await supabaseAdmin
    .from('entries')
    .select('id, numbers')
    .eq('round_id', payload.roundId)
    .eq('payment_status', 'paid')

  let winnerFound = false

  for (const entry of paidEntries || []) {
    const entryNumbers = Array.isArray(entry.numbers) ? entry.numbers : []
    const uniqueHits = entryNumbers.filter((number: number) => allDrawnNumbers.includes(number))
    const drawHits = entryNumbers.filter((number: number) => numbers.includes(number))

    await supabaseAdmin
      .from('entry_hits')
      .insert({
        entry_id: entry.id,
        draw_result_id: draw.id,
        hits_count: drawHits.length,
        hit_numbers: drawHits,
      })

    await supabaseAdmin
      .from('entries')
      .update({ total_hits: uniqueHits.length })
      .eq('id', entry.id)

    if (uniqueHits.length >= 10) {
      winnerFound = true
    }
  }

  if (winnerFound) {
    await supabaseAdmin
      .from('rounds')
      .update({ status: 'finished' })
      .eq('id', payload.roundId)
  }

  return {
    status: winnerFound ? 'registered_and_finished' : 'registered',
    reason: null,
    round,
    draw,
    paidEntriesCount: paidEntries?.length || 0,
  }
}

export async function registerLatestMegaSenaDrawFromCron() {
  const supabaseAdmin = getSupabaseAdmin()

  await supabaseAdmin.rpc('close_expired_rounds')

  const latestResult: MegaSenaLatestResult = await fetchLatestMegaSenaResult()
  const automaticRegistrationCheck = shouldTryAutomaticRegistration(latestResult)

  if (!automaticRegistrationCheck.shouldRun) {
    return {
      status: 'skipped',
      reason: automaticRegistrationCheck.reason,
      brazilNow: automaticRegistrationCheck.brazilNow,
      latestResult,
      registration: null,
    }
  }

  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('*')
    .eq('status', 'closed')
    .or(`start_date.is.null,start_date.lte.${latestResult.drawDate}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!round) {
    return {
      status: 'skipped',
      reason: 'no_closed_round',
      brazilNow: automaticRegistrationCheck.brazilNow,
      latestResult,
      registration: null,
    }
  }

  const registration = await registerDrawForRound({
    roundId: round.id,
    contestNumber: latestResult.contestNumber,
    drawDate: latestResult.drawDate,
    numbers: latestResult.numbers,
    source: 'cron',
  })

  return {
    status: registration.status,
    reason: registration.reason,
    brazilNow: automaticRegistrationCheck.brazilNow,
    latestResult,
    registration,
  }
}

export async function registerMegaSenaDrawFromCronOverride(payload: {
  contestNumber: string
  drawDate: string
  numbers: number[]
}) {
  const supabaseAdmin = getSupabaseAdmin()

  await supabaseAdmin.rpc('close_expired_rounds')

  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('*')
    .eq('status', 'closed')
    .or(`start_date.is.null,start_date.lte.${payload.drawDate}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!round) {
    return {
      status: 'skipped',
      reason: 'no_closed_round',
      latestResult: {
        contestNumber: payload.contestNumber,
        drawDate: payload.drawDate,
        numbers: uniqueSortedNumbers(payload.numbers),
        source: 'cron_override',
      },
      registration: null,
    }
  }

  const registration = await registerDrawForRound({
    roundId: round.id,
    contestNumber: payload.contestNumber,
    drawDate: payload.drawDate,
    numbers: payload.numbers,
    source: 'cron',
  })

  return {
    status: registration.status,
    reason: registration.reason,
    latestResult: {
      contestNumber: payload.contestNumber,
      drawDate: payload.drawDate,
      numbers: uniqueSortedNumbers(payload.numbers),
      source: 'cron_override',
    },
    registration,
  }
}
