import { supabase } from './supabase'

type RoundWithDeadline = {
  end_date?: string | null
  end_time?: string | null
}

export async function closeExpiredRounds() {
  await supabase.rpc('close_expired_rounds')
}

export function formatRoundDeadline(round: RoundWithDeadline) {
  if (!round.end_date) return ''

  const date = new Date(round.end_date + 'T12:00:00').toLocaleDateString('pt-BR')
  const time = round.end_time ? round.end_time.slice(0, 5) : ''

  return time ? `${date} as ${time}` : date
}
