'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'
import { supabase } from '@/lib/supabase'
import { formatWhatsapp } from '@/lib/phone'

type Profile = {
  id: string
  nome: string | null
  telefone: string | null
  pix_key?: string | null
  referral_code?: string | null
}

export default function PerfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [email, setEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      const userProfile = data as Profile | null
      setProfile(userProfile)
      setNome(userProfile?.nome || '')
      setTelefone(formatWhatsapp(userProfile?.telefone || ''))
      setPixKey(userProfile?.pix_key || '')
      setEmail(authUser.email || '')
      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setErro('')
    setSucesso('')

    if (novaSenha || confirmarSenha) {
      if (novaSenha.length < 6) {
        setErro('A nova senha precisa ter pelo menos 6 caracteres.')
        setSaving(false)
        return
      }
      if (novaSenha !== confirmarSenha) {
        setErro('A confirmação da senha não confere.')
        setSaving(false)
        return
      }
    }

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const authUpdates: { email?: string; password?: string } = {}
    if (email && email !== authUser?.email) authUpdates.email = email
    if (novaSenha) authUpdates.password = novaSenha

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabase.auth.updateUser(authUpdates)
      if (authError) {
        setErro(authError.message)
        setSaving(false)
        return
      }
    }

    const { error: profileError } = await supabase
      .from('users')
      .update({
        nome,
        email,
        telefone,
        pix_key: pixKey,
      })
      .eq('id', profile.id)

    if (profileError) {
      setErro(profileError.message.includes('pix_key')
        ? 'Não foi possível salvar a chave PIX. Verifique se a coluna pix_key existe na tabela users.'
        : profileError.message)
      setSaving(false)
      return
    }

    setProfile({ ...profile, nome, telefone, pix_key: pixKey })
    setNovaSenha('')
    setConfirmarSenha('')
    setSucesso(authUpdates.email
      ? 'Perfil salvo. Confirme o novo email se o Supabase solicitar.'
      : 'Perfil salvo com sucesso.')
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Carregando...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar nomeUsuario={nome || profile?.nome || ''} />

      <div className="max-w-4xl mx-auto p-6 pb-28 md:pb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Perfil</h2>
          <p className="text-gray-500 text-sm mt-1">Dados da conta e recebimento de prêmios</p>
        </div>

        <form onSubmit={handleSalvar} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Dados pessoais</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nome</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={e => setTelefone(formatWhatsapp(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Chave PIX</label>
                  <input
                    type="text"
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="CPF, email, telefone ou chave aleatória"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Acesso</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nova senha</label>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Confirmar senha</label>
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    minLength={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-200 mb-2">Conta</div>
              <div className="text-lg font-black">{nome || 'Usuario'}</div>
              {profile?.referral_code && (
                <div className="mt-4">
                  <div className="text-xs text-blue-200 mb-1">Codigo de indicação</div>
                  <div className="inline-flex rounded-xl bg-white/10 px-3 py-2 font-mono text-sm font-bold">
                    {profile.referral_code}
                  </div>
                </div>
              )}
            </div>

            {(erro || sucesso) && (
              <div className={(erro ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700') + ' rounded-2xl border px-4 py-3 text-sm font-semibold'}>
                {erro || sucesso}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3 text-sm transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
