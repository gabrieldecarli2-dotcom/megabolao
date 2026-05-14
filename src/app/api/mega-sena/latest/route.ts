import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchLatestMegaSenaResult } from '@/lib/mega-sena'

export const runtime = 'nodejs'
export const preferredRegion = 'gru1'

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
    const result = await fetchLatestMegaSenaResult()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Falha ao consultar resultado da Mega-Sena', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha na comunicacao com a API da Mega-Sena.' },
      { status: 502 },
    )
  }
}
