import type { NextRequest } from 'next/server'
import { getSupabaseServerAuth } from './supabase-admin'

export async function getAuthenticatedUser(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length)
  const supabaseServerAuth = getSupabaseServerAuth()
  const { data, error } = await supabaseServerAuth.auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  return data.user
}
