'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    setSucesso('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setErro('')
    setSucesso('')

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (error) {
      setErro('Nao foi possivel iniciar o login com Google.')
      setGoogleLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setErro('Informe seu email para recuperar a senha.')
      setSucesso('')
      return
    }

    setResetLoading(true)
    setErro('')
    setSucesso('')

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/redefinir-senha`
      : undefined

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      setErro('Nao foi possivel enviar o email de recuperacao.')
    } else {
      setSucesso('Enviamos um link de recuperacao para o seu email.')
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:grid md:grid-cols-[1.05fr_0.95fr] md:p-0">
      <div className="hidden bg-blue-600 text-white md:flex md:flex-col md:justify-between md:p-10 lg:p-14">
        <div>
          <Image src="/logo.png" alt="MegaBolão" width={360} height={80} className="h-12 w-auto max-w-[220px] object-contain" priority />
          <div className="mt-10 max-w-lg">
            <div className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-100">
              Bolão entre amigos
            </div>
            <h1 className="text-4xl font-black leading-tight lg:text-5xl">
              Acompanhe seus palpites, ranking e prêmios em um só lugar.
            </h1>
            <p className="mt-4 text-sm leading-6 text-blue-100">
              Entre para conferir suas participações, resultados dos sorteios e a evolução da rodada atual.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-2xl font-black text-yellow-300">10</div>
            <div className="mt-1 text-blue-100">números por palpite</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-2xl font-black text-yellow-300">PIX</div>
            <div className="mt-1 text-blue-100">pagamento validado</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-2xl font-black text-yellow-300">🏆</div>
            <div className="mt-1 text-blue-100">ranking ao vivo</div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center md:min-h-screen">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8 md:hidden">
            <Image src="/logo.png" alt="MegaBolão" width={360} height={80} className="h-12 w-auto max-w-[220px] object-contain" priority />
          </div>

          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wide text-blue-600">Acesse sua conta</div>
            <h2 className="mt-1 text-2xl font-black text-gray-900">Bem-vindo de volta</h2>
            <p className="mt-1 text-sm text-gray-500">Entre para acompanhar suas participações.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            {googleLoading ? 'Abrindo Google...' : 'Entrar com Google'}
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-xs font-bold text-blue-600 transition hover:text-blue-700 disabled:opacity-50"
                >
                  {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 text-sm text-gray-800 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                {sucesso}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Não tem conta?{' '}
              <a href="/cadastro" className="font-bold text-blue-600 hover:underline">
                Cadastre-se
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
