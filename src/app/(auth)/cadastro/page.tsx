'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CadastroPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    if (senha !== confirmarSenha) {
      setErro('A confirmação da senha não confere.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    })

    if (error || !data.user) {
      setErro(error?.message || 'Erro ao criar conta.')
      setLoading(false)
      return
    }

    const { error: dbError } = await supabase.from('users').insert({
      id: data.user.id,
      nome,
      email,
      telefone,
      role: 'user',
      referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    })

    if (dbError) {
      setErro('Erro ao salvar dados do perfil.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  async function handleGoogleCadastro() {
    setGoogleLoading(true)
    setErro('')

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (error) {
      setErro('Nao foi possivel iniciar o cadastro com Google.')
      setGoogleLoading(false)
    }
  }

  const passwordMismatch = confirmarSenha.length > 0 && senha !== confirmarSenha

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:grid md:grid-cols-[0.95fr_1.05fr] md:p-0">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center md:min-h-screen">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-widest">
              <span className="text-yellow-400">MEGA</span>
              <span className="text-blue-600">BOLÃO</span>
            </h1>
            <div className="mt-6 text-xs font-bold uppercase tracking-wide text-blue-600">Criar conta</div>
            <h2 className="mt-1 text-2xl font-black text-gray-900">Entre para o bolão</h2>
            <p className="mt-1 text-sm text-gray-500">Cadastre seus dados para participar das rodadas.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleCadastro}
            disabled={googleLoading}
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-black text-blue-600">G</span>
            {googleLoading ? 'Abrindo Google...' : 'Cadastrar com Google'}
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleCadastro} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Nome completo
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Seu nome"
                  required
                />
              </div>
            </div>

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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                WhatsApp
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 text-sm text-gray-800 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="mínimo 6 caracteres"
                  required
                  minLength={6}
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

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  className={'w-full rounded-xl border py-3 pl-10 pr-12 text-sm text-gray-800 outline-none transition focus:border-transparent focus:ring-2 ' + (passwordMismatch ? 'border-red-200 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500')}
                  placeholder="repita a senha"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordMismatch && (
                <div className="mt-1 text-xs font-semibold text-red-500">As senhas ainda não conferem.</div>
              )}
            </div>

            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || passwordMismatch}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Já tem conta?{' '}
              <a href="/login" className="font-bold text-blue-600 hover:underline">
                Entrar
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden bg-blue-600 text-white md:flex md:flex-col md:justify-between md:p-10 lg:p-14">
        <div>
          <div className="text-3xl font-black tracking-widest">
            <span className="text-yellow-400">MEGA</span>BOLÃO
          </div>
          <div className="mt-10 max-w-lg">
            <div className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-100">
              Cadastro rápido
            </div>
            <h2 className="text-4xl font-black leading-tight lg:text-5xl">
              Seus palpites organizados do início ao prêmio.
            </h2>
            <p className="mt-4 text-sm leading-6 text-blue-100">
              Participe das rodadas abertas, acompanhe pagamentos, ranking, resultados e premiações com segurança.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-2xl font-black text-yellow-300">01</div>
            <div className="mt-1 text-blue-100">crie sua conta</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-2xl font-black text-yellow-300">10</div>
            <div className="mt-1 text-blue-100">escolha números</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-2xl font-black text-yellow-300">🏆</div>
            <div className="mt-1 text-blue-100">acompanhe prêmios</div>
          </div>
        </div>
      </div>
    </div>
  )
}
