'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'
import { closeExpiredRounds } from '@/lib/rounds'

const MAX = 10

type Palpite = {
  id: string
  numbers: number[]
  editando: boolean
}

function ApostarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [round, setRound] = useState<any>(null)
  const [palpites, setPalpites] = useState<Palpite[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = sessionStorage.getItem('carrinho_palpites')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [selected, setSelected] = useState<number[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const urlProcessed = useRef(false)

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      await closeExpiredRounds()
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: rodada } = await supabase.from('rounds').select('*').eq('status', 'open').single()
      setUser(profile)
      setRound(rodada)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('carrinho_palpites', JSON.stringify(palpites))
    }
  }, [palpites])

  // Processa URL apenas uma vez, apos carregar
  useEffect(() => {
    if (loading) return
    if (urlProcessed.current) return
    urlProcessed.current = true

    const nums = searchParams.get('numeros')
    if (!nums) return

    const parsed = nums.split(',').map(Number).filter(n => n >= 1 && n <= 60).sort((a, b) => a - b)
    if (parsed.length !== MAX) return

    setPalpites(prev => [
      ...prev,
      { id: crypto.randomUUID(), numbers: parsed, editando: false }
    ])
    window.history.replaceState({}, '', '/apostar')
  }, [loading])

  function toggleNum(n: number) {
    if (selected.includes(n)) {
      setSelected(selected.filter(x => x !== n))
    } else if (selected.length < MAX) {
      setSelected([...selected, n])
    }
  }

  function escolhaAleatoria() {
    const nums: number[] = []
    while (nums.length < MAX) {
      const n = Math.floor(Math.random() * 60) + 1
      if (!nums.includes(n)) nums.push(n)
    }
    setSelected(nums.sort((a, b) => a - b))
  }

  function adicionarPalpite() {
    if (selected.length !== MAX) return
    if (editingId) {
      setPalpites(prev => prev.map(p => p.id === editingId ? { ...p, numbers: selected.sort((a, b) => a - b), editando: false } : p))
      setEditingId(null)
    } else {
      setPalpites(prev => [...prev, { id: crypto.randomUUID(), numbers: selected.sort((a, b) => a - b), editando: false }])
    }
    setSelected([])
  }

  function editarPalpite(id: string) {
    const p = palpites.find(p => p.id === id)
    if (!p) return
    setSelected(p.numbers)
    setEditingId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setSelected([])
    setEditingId(null)
  }

  function excluirPalpite(id: string) {
    setPalpites(prev => prev.filter(p => p.id !== id))
    if (editingId === id) { setSelected([]); setEditingId(null) }
  }

  async function handleConfirmar() {
    if (palpites.length === 0) return
    setSalvando(true)
    for (const p of palpites) {
      await supabase.from('entries').insert({
        user_id: user.id, round_id: round.id,
        numbers: p.numbers, payment_status: 'pending', total_hits: 0,
      })
    }
    setSalvando(false)
    setSucesso(true)
    sessionStorage.removeItem('carrinho_palpites')
    setConfirming(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Carregando...</div>
    </div>
  )

  const valorTotal = palpites.length * 50

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar nomeUsuario={user?.nome || ''} />
        <div className="max-w-lg mx-auto p-6 pb-28 md:pb-6 text-center mt-16">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Participacoes registradas!</h2>
          <p className="text-gray-500 text-sm mb-6">{palpites.length} palpite(s) salvo(s) com sucesso.</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4 text-left">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Pagamento via PIX</div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-sm text-gray-700 border border-gray-200 mb-2">
              11999999999
            </div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{palpites.length} participacao(es) x R$50,00</span>
              <span className="font-bold text-blue-600">R${valorTotal},00</span>
            </div>
            <div className="text-xs text-red-500 mt-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              Envie o comprovante para o admin. Participacoes nao pagas dentro do prazo serao canceladas automaticamente.
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setPalpites([]); setSucesso(false) }} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition">
              + Novos Palpites
            </button>
            <button onClick={() => router.push('/minhas-participacoes')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl text-sm transition">
              Ver Minhas Participacoes
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar nomeUsuario={user?.nome || ''} />

      {confirming && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-2xl mb-3 text-center">⚠️</div>
            <h3 className="font-bold text-gray-800 text-center mb-2">Confirmar participacoes?</h3>
            <p className="text-gray-500 text-sm text-center mb-1">
              Voce esta confirmando <strong>{palpites.length} palpite(s)</strong> no valor total de <strong className="text-blue-600">R${valorTotal},00</strong>.
            </p>
            <p className="text-red-500 text-xs text-center mb-5 bg-red-50 rounded-xl px-3 py-2 mt-3">
              Apos a confirmacao os numeros nao poderao ser alterados. O nao pagamento dentro do prazo resultara no cancelamento das participacoes.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition">
                Voltar e revisar
              </button>
              <button onClick={handleConfirmar} disabled={salvando} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Confirmar e Pagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-6 pb-28 md:pb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Apostar</h2>
          <p className="text-gray-500 text-sm mt-1">
            {round ? round.nome + ' — adicione quantos palpites quiser antes de pagar' : 'Nenhuma rodada aberta'}
          </p>
        </div>

        {!round && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl px-5 py-4 text-sm">
            Nenhuma rodada aberta no momento. Aguarde o admin abrir uma nova rodada.
          </div>
        )}

        {round && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {editingId ? 'Editando palpite' : 'Novo palpite'}
                    </div>
                    <div className="text-sm font-mono mt-0.5">
                      <span className="text-2xl font-black text-blue-600">{selected.length}</span>
                      <span className="text-gray-400"> / 10</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={escolhaAleatoria} className="text-xs bg-blue-50 text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition">
                      🎲 Aleatorio
                    </button>
                    {selected.length > 0 && (
                      <button onClick={() => setSelected([])} className="text-xs text-gray-400 hover:text-red-500 transition border border-gray-200 px-3 py-1.5 rounded-lg">
                        Limpar
                      </button>
                    )}
                    {editingId && (
                      <button onClick={cancelarEdicao} className="text-xs bg-red-50 text-red-500 font-semibold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-100 transition">
                        Cancelar edicao
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-10 gap-1.5 mb-4">
                  {Array.from({ length: 60 }, (_, i) => i + 1).map(n => {
                    const isSelected = selected.includes(n)
                    const isFull = selected.length === MAX && !isSelected
                    return (
                      <button
                        key={n}
                        onClick={() => toggleNum(n)}
                        disabled={isFull}
                        className={
                          'aspect-square rounded-full text-xs font-bold font-mono transition flex items-center justify-center ' +
                          (isSelected
                            ? 'bg-blue-600 text-white shadow-md scale-105'
                            : isFull
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200')
                        }
                      >
                        {String(n).padStart(2, '0')}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={adicionarPalpite}
                  disabled={selected.length !== MAX}
                  className={
                    'w-full font-bold py-3 rounded-xl text-sm transition ' +
                    (selected.length === MAX
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed')
                  }
                >
                  {editingId
                    ? '✓ Salvar alteracoes'
                    : selected.length === MAX
                    ? '+ Adicionar este palpite'
                    : 'Selecione ' + (MAX - selected.length) + ' numero(s) para adicionar'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Numeros selecionados</div>
                <div className="flex flex-wrap gap-1.5 min-h-10">
                  {selected.length === 0
                    ? <span className="text-xs text-gray-300">Nenhum ainda</span>
                    : selected.slice().sort((a, b) => a - b).map(n => (
                      <span key={n} className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold font-mono flex items-center justify-center">
                        {String(n).padStart(2, '0')}
                      </span>
                    ))
                  }
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                  Meus palpites ({palpites.length})
                </div>

                {palpites.length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-4">
                    Nenhum palpite adicionado ainda
                  </div>
                )}

                <div className="space-y-3">
                  {palpites.map((p, index) => (
                    <div
                      key={p.id}
                      className={
                        'border rounded-xl p-3 ' +
                        (editingId === p.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50')
                      }
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500">Palpite #{index + 1}</span>
                        <div className="flex gap-1">
                          {editingId !== p.id && (
                            <button onClick={() => editarPalpite(p.id)} className="text-xs bg-white text-blue-600 font-semibold px-2 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 transition">
                              ✏️ Editar
                            </button>
                          )}
                          <button onClick={() => excluirPalpite(p.id)} className="text-xs bg-white text-red-500 font-semibold px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 transition">
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.numbers.map(n => (
                          <span key={n} className="w-7 h-7 rounded-full bg-white text-gray-600 text-xs font-bold font-mono flex items-center justify-center border border-gray-200">
                            {String(n).padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {palpites.length > 0 && !editingId && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Resumo</div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rodada</span>
                      <span className="font-semibold text-gray-800">{round.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Palpites</span>
                      <span className="font-semibold text-gray-800">{palpites.length}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                      <span className="text-gray-500 font-semibold">Total a pagar</span>
                      <span className="font-black text-blue-600 text-lg">R${valorTotal},00</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirming(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition"
                  >
                    Confirmar e Pagar R${valorTotal},00
                  </button>
                </div>
              )}

              {editingId && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-700 text-center">
                  Editando palpite — salve as alteracoes antes de confirmar
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApostarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    }>
      <ApostarContent />
    </Suspense>
  )
}
