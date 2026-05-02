'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'
import { closeExpiredRounds } from '@/lib/rounds'

export default function ResultadosPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [drawsByRound, setDrawsByRound] = useState<Record<string, any[]>>({})
  const [expandedRound, setExpandedRound] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      await closeExpiredRounds()

      const { data: profile } = await supabase
        .from('users').select('*').eq('id', authUser.id).single()

      // Busca todas as rodadas
      const { data: allRounds } = await supabase
        .from('rounds').select('*')
        .order('created_at', { ascending: false })

      // Busca todos os sorteios de cada rodada
      const byRound: Record<string, any[]> = {}
      for (const r of allRounds || []) {
        const { data: sorteios } = await supabase
          .from('draw_results').select('*')
          .eq('round_id', r.id)
          .order('draw_date', { ascending: false })
        byRound[r.id] = sorteios || []
      }

      // Expande a mais recente por padrao
      if (allRounds && allRounds.length > 0) {
        setExpandedRound(allRounds[0].id)
      }

      setUser(profile)
      setRounds(allRounds || [])
      setDrawsByRound(byRound)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar nomeUsuario={user?.nome || ''} />

      <div className="max-w-4xl mx-auto p-6 pb-28 md:pb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Resultados</h2>
          <p className="text-gray-500 text-sm mt-1">Historico de sorteios por rodada</p>
        </div>

        {rounds.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🎱</div>
            <h3 className="font-bold text-gray-700 mb-1">Nenhum sorteio registrado ainda</h3>
            <p className="text-gray-400 text-sm">Os resultados aparecerao aqui apos cada sorteio.</p>
          </div>
        )}

        <div className="space-y-4">
          {rounds.map(round => {
            const draws = drawsByRound[round.id] || []
            const isExpanded = expandedRound === round.id

            return (
              <div key={round.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Header clicavel */}
                <button
                  onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="text-left">
                    <div className="font-bold text-gray-800">{round.nome}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {draws.length} sorteio(s) registrado(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={
                      'text-xs font-bold px-2 py-1 rounded-full ' +
                      (round.status === 'open' ? 'bg-green-100 text-green-700' :
                       round.status === 'finished' ? 'bg-blue-100 text-blue-700' :
                       'bg-gray-100 text-gray-500')
                    }>
                      {round.status === 'open' ? '● Aberta' : round.status === 'finished' ? '● Encerrada' : '● Fechada'}
                    </span>
                    <span className="text-gray-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Conteudo expandido */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {draws.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        Nenhum sorteio registrado nesta rodada ainda.
                      </div>
                    )}

                    {draws.map((draw, index) => (
                      <div
                        key={draw.id}
                        className={
                          'px-5 py-4 border-b border-gray-50 last:border-0 ' +
                          (draw.is_first ? 'bg-blue-50' : '')
                        }
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-sm">
                              Concurso {draw.contest_number}
                            </span>
                            {draw.is_first && (
                              <span className="text-xs bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                                1° Sorteio
                              </span>
                            )}
                            {index === 0 && (
                              <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                                Ultimo
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(draw.draw_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit', month: 'long', year: 'numeric'
                            })}
                          </span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {draw.numbers.map((n: number) => (
                            <div
                              key={n}
                              className="w-10 h-10 rounded-full bg-yellow-400 text-gray-900 font-black font-mono text-sm flex items-center justify-center shadow-sm"
                            >
                              {String(n).padStart(2, '0')}
                            </div>
                          ))}
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
