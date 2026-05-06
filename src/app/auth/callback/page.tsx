'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Finalizando login...')

  useEffect(() => {
    async function finishLogin() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setMessage('Nao foi possivel concluir o login.')
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const nome = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario'
      const telefone = user.user_metadata?.phone || ''

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        await supabase
          .from('users')
          .update({
            nome,
            email: user.email,
            telefone,
          })
          .eq('id', user.id)
      } else {
        await supabase.from('users').insert({
          id: user.id,
          nome,
          email: user.email,
          telefone,
          role: 'user',
          referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        })
      }

      router.replace('/dashboard')
    }

    finishLogin()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="rounded-2xl border border-gray-100 bg-white px-8 py-6 text-center shadow-sm">
        <Image src="/logo.png" alt="MegaBolão" width={360} height={80} className="mx-auto mb-2 h-10 w-auto max-w-[180px] object-contain" priority />
        <div className="text-sm font-semibold text-gray-500">{message}</div>
      </div>
    </div>
  )
}
