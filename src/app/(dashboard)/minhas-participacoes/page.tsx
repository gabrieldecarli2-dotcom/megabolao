'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'
import { closeExpiredRounds } from '@/lib/rounds'

export default function MinhasParticipacoes() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [entriesByRound, setEntriesByRound] = useState<Record<string, any[]>>({})
  const [drawnByRound, setDrawnByRound] = useState<Record<string, number[]>>({})
  const [prizesByEntry, setPrizesByEntry] = useState<Record<string, string[]>>({})
  const [hasPrizeByRound, setHasPrizeByRound] = useState<Record<string, boolean>>({})
  const [openRoundId, setOpenRoundId] = useState<string | null>(null)
  const [expandedRound, setExpandedRound] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      await closeExpiredRounds()

      const { data: profile } = await supabase
        .from('users').select('*').eq('id', authUser.id).single()

      const { data: entries } = await supabase
        .from('entries')
        .select('*, rounds(id, nome, status, start_date, end_date, end_time)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })

      const byRound: Record<string, any[]> = {}
      const roundsMap: Record<string, any> = {}

      for (const e of entries || []) {
        const rid = e.round_id
        if (!byRound[rid]) byRound[rid] = []
        byRound[rid].push(e)
        if (e.rounds) roundsMap[rid] = e.rounds
      }

      const drawn: Record<string, number[]> = {}
      const prizes: Record<string, string[]> = {}
      const awardedRounds: Record<string, boolean> = {}
      for (const rid of Object.keys(byRound)) {
        const { data: sorteios } = await supabase
          .from('draw_results').select('id, numbers, is_first').eq('round_id', rid)
        const nums = (sorteios || []).flatMap((d: any) => d.numbers)
        drawn[rid] = Array.from(new Set(nums)) as number[]

        const round = roundsMap[rid]
        const userEntries = byRound[rid] || []
        const userEntryIds = new Set(userEntries.map((entry: any) => entry.id))
        const { data: paidEntries } = await supabase
          .from('entries')
          .select('id, user_id, total_hits')
          .eq('round_id', rid)
          .eq('payment_status', 'paid')
          .order('total_hits', { ascending: false })

        const addPrize = (entryId: string, label: string) => {
          if (!userEntryIds.has(entryId)) return
          prizes[entryId] = [...(prizes[entryId] || []), label]
          awardedRounds[rid] = true
        }

        ;(paidEntries || [])
          .filter((entry: any) => (entry.total_hits || 0) >= 10)
          .forEach((entry: any) => addPrize(entry.id, '🏆 Vencedor'))

        const firstDraw = (sorteios || []).find((draw: any) => draw.is_first)
        if (firstDraw) {
          const { data: hits } = await supabase
            .from('entry_hits')
            .select('entry_id, hits_count')
            .eq('draw_result_id', firstDraw.id)
            .order('hits_count', { ascending: false })

          if (hits && hits.length > 0) {
            const maxHits = hits[0].hits_count
            if (maxHits > 0) {
              hits
                .filter((hit: any) => hit.hits_count === maxHits)
                .forEach((hit: any) => addPrize(hit.entry_id, '⚡ 1° sorteio'))
            }
          }
        }

        if (round?.status === 'finished') {
          const naoVencedores = (paidEntries || []).filter((entry: any) => (entry.total_hits || 0) < 10)
          const maiorPtsNV = naoVencedores.length > 0 ? Math.max(...naoVencedores.map((entry: any) => entry.total_hits || 0)) : -1
          const menorPts = naoVencedores.length > 0 ? Math.min(...naoVencedores.map((entry: any) => entry.total_hits || 0)) : -1
          const segundos = naoVencedores.filter((entry: any) => (entry.total_hits || 0) === maiorPtsNV)

          segundos.forEach((entry: any) => addPrize(entry.id, '🥈 2° lugar'))
          naoVencedores
            .filter((entry: any) => (entry.total_hits || 0) === menorPts && !segundos.find((segundo: any) => segundo.id === entry.id))
            .forEach((entry: any) => addPrize(entry.id, '🔻 Lanterna'))
        }
      }

      const { data: openRound } = await supabase
        .from('rounds').select('id').eq('status', 'open').maybeSingle()

      const roundsList = Object.values(roundsMap).sort((a: any, b: any) =>
        new Date(b.start_date || b.created_at || 0).getTime() - new Date(a.start_date || a.created_at || 0).getTime()
      )

      setUser(profile)
      setRounds(roundsList)
      setEntriesByRound(byRound)
      setDrawnByRound(drawn)
      setPrizesByEntry(prizes)
      setHasPrizeByRound(awardedRounds)
      setOpenRoundId(openRound?.id || null)
      if (roundsList.length > 0) setExpandedRound(roundsList[0].id)
      setLoading(false)
    }
    init()
  }, [])

  function statusLabel(status: string) {
    if (status === 'paid') return { label: 'Pago', color: 'bg-green-100 text-green-700' }
    if (status === 'cancelled') return { label: 'Cancelado', color: 'bg-red-100 text-red-600' }
    return { label: 'Aguardando pagamento', color: 'bg-yellow-100 text-yellow-700' }
  }

  function refazerPalpite(numbers: number[]) {
    const params = new URLSearchParams({ numeros: numbers.join(',') })
    router.push('/apostar?' + params.toString())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    )
  }

  const totalParticipacoes = Object.values(entriesByRound).flat().length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar nomeUsuario={user?.nome || ''} />

      <div className="max-w-4xl mx-auto p-6 pb-28 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Minhas Participacoes</h2>
            <p className="text-gray-500 text-sm mt-1">
              {totalParticipacoes} participacao(es) em {rounds.length} rodada(s)
            </p>
          </div>
          {openRoundId && (
            <button onClick={() => router.push('/apostar')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition">
              + Nova Participacao
            </button>
          )}
        </div>

        {rounds.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="font-bold text-gray-700 mb-1">Nenhuma participacao ainda</h3>
            <p className="text-gray-400 text-sm mb-4">Escolha seus numeros e concorra ao Prêmio!</p>
            {openRoundId && (
              <button onClick={() => router.push('/apostar')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition">
                Fazer minha primeira participacao
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {rounds.map((round: any) => {
            const entries = entriesByRound[round.id] || []
            const sortedEntries = [...entries].sort((a: any, b: any) => {
              const cancelledOrder = Number(a.payment_status === 'cancelled') - Number(b.payment_status === 'cancelled')
              if (cancelledOrder !== 0) return cancelledOrder
              return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            })
            const paidEntries = entries.filter(entry => entry.payment_status === 'paid')
            const drawn = drawnByRound[round.id] || []
            const isExpanded = expandedRound === round.id
            const melhorAcerto = paidEntries.length > 0 ? Math.max(...paidEntries.map(e => e.total_hits || 0)) : 0
            const hasPrize = hasPrizeByRound[round.id]

            return (
              <div key={round.id} className={'bg-white rounded-2xl border shadow-sm overflow-hidden ' + (hasPrize ? 'border-yellow-300 ring-1 ring-yellow-200' : 'border-gray-100')}>
                <button
                  onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-800">{round.nome}</span>
                      {hasPrize && (
                        <span className="whitespace-nowrap rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-gray-900 sm:text-xs">
                          🏅 Premiada
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {entries.length} participacao(es) · melhor: {melhorAcerto} acertos
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className={
                      'whitespace-nowrap text-[11px] font-bold px-3 py-1 rounded-full sm:text-xs ' +
                      (round.status === 'open' ? 'bg-green-100 text-green-700' :
                       round.status === 'finished' ? 'bg-blue-100 text-blue-700' :
                       round.status === 'closed' ? 'bg-yellow-100 text-yellow-700' :
                       'bg-gray-100 text-gray-500')
                    }>
                      {round.status === 'open' ? '● Aberta'
                        : round.status === 'finished' ? '● Encerrada'
                        : round.status === 'closed' ? '● Palpites fechados'
                        : '● Rascunho'}
                    </span>
                    <span className="text-gray-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {entries.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        Nenhuma participacao nesta rodada.
                      </div>
                    )}
                    {sortedEntries.map((entry, index) => {
                      const status = statusLabel(entry.payment_status)
                      const isCancelled = entry.payment_status === 'cancelled'
                      const hits = isCancelled ? 0 : entry.total_hits || 0
                      const progressPct = (hits / 10) * 100
                      const prizeLabels = prizesByEntry[entry.id] || []
                      const isPrizeEntry = prizeLabels.length > 0
                      const prizePaid = entry.prize_status === 'paid'

                      return (
                        <div key={entry.id} className={'p-5 ' + (isPrizeEntry ? 'bg-yellow-50/70 border-l-4 border-yellow-400' : '')}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-800 text-sm">
                                  Participacao #{entries.length - index}
                                </span>
                                {isPrizeEntry && (
                                  <span className={'rounded-full px-2 py-0.5 text-[10px] font-black ' + (prizePaid ? 'bg-green-100 text-green-700' : 'bg-yellow-400 text-gray-900')}>
                                    {prizePaid ? 'Prêmio pago' : 'Aguardando premiação'}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                              </div>
                              {isPrizeEntry && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {prizeLabels.map((label) => (
                                    <span key={label} className="rounded-full bg-white px-2 py-1 text-xs font-bold text-yellow-700 border border-yellow-200">
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={'text-xs font-semibold px-3 py-1 rounded-full ' + status.color}>
                                {status.label}
                              </span>
                              {drawn.length > 0 && (
                                <div className="text-right">
                                  <div className={'text-2xl font-black ' + (isCancelled ? 'text-gray-300' : 'text-blue-600')}>{hits}</div>
                                  <div className="text-xs text-gray-400">acertos</div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {entry.numbers.map((n: number) => {
                              const isHit = !isCancelled && drawn.includes(n)
                              return (
                                <span key={n} className={
                                  'w-8 h-8 rounded-full text-xs font-bold font-mono flex items-center justify-center border ' +
                                  (isHit ? 'bg-green-500 text-white border-green-500'
                                    : entry.payment_status === 'cancelled'
                                    ? 'bg-gray-50 text-gray-300 border-gray-200'
                                    : 'bg-gray-100 text-gray-500 border-gray-200')
                                }>
                                  {String(n).padStart(2, '0')}
                                </span>
                              )
                            })}
                          </div>

                          {drawn.length > 0 && entry.payment_status === 'paid' && (
                            <div>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Progresso total</span>
                                <span>{hits}/10</span>
                              </div>
                              <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: progressPct + '%' }} />
                              </div>
                            </div>
                          )}

                          {entry.payment_status === 'pending' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 text-xs text-yellow-700 mt-3">
                              Pagamento pendente — envie R$50,00 via PIX para <strong>11999999999</strong>
                            </div>
                          )}

                          {entry.payment_status === 'cancelled' && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-600 mt-3">
                              Participacao cancelada por falta de pagamento.
                            </div>
                          )}

                          {openRoundId && entry.payment_status !== 'cancelled' && (
                            <button
                              onClick={() => refazerPalpite(entry.numbers)}
                              className="mt-3 text-xs bg-blue-50 text-blue-600 font-semibold px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                            >
                              ↩ Refazer palpite com esses numeros
                            </button>
                          )}
                        </div>
                      )
                    })}
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
