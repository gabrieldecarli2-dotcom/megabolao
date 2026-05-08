import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function randomReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request)

  if (!authUser) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: adminProfile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle()

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json()
  const nome = String(body?.nome || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const telefone = String(body?.telefone || '').trim()
  const password = String(body?.password || '')
  const role = body?.role === 'admin' ? 'admin' : 'user'

  if (!nome || !email || !password) {
    return NextResponse.json({ error: 'Informe nome, email e senha.' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const { data: createdUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome,
      telefone,
    },
  })

  if (authError || !createdUser.user) {
    return NextResponse.json(
      { error: authError?.message || 'Nao foi possivel criar o login do usuario.' },
      { status: 400 },
    )
  }

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: createdUser.user.id,
    nome,
    email,
    telefone,
    role,
    referral_code: randomReferralCode(),
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id)

    return NextResponse.json(
      { error: profileError.message || 'Nao foi possivel salvar o perfil do usuario.' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    success: true,
    user: {
      id: createdUser.user.id,
      nome,
      email,
      telefone,
      role,
    },
  })
}
