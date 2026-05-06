'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'
import { closeExpiredRounds } from '@/lib/rounds'

export default function RankingPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string>('')
  const [ranking, setRanking] = useState<any[]>([])
  const [totalPaidEntries, setTotalPaidEntries] = useState(0)
  const [round, setRound] = useState<any>(null)
  const [allDrawnNumbers, setAllDrawnNumbers] = useState<number[]>([])
  const [firstDrawWinnerIds, setFirstDrawWinnerIds] = useState<string[]>([])
  const [firstDrawWinnerNames, setFirstDrawWinnerNames] = useState<string[]>([])
  const [prizeRules, setPrizeRules] = useState<any>({ first10: 50, firstDraw: 7, second: 18, last: 13, admin: 12 })
  const [loading, setLoading] = useState(true)
  const [loadingRound, setLoadingRound] = useState(false)
  const [isWinner, setIsWinner] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [myEntryCursor, setMyEntryCursor] = useState(0)

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      await closeExpiredRounds()
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: allRounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
      setUser(profile)
      setRounds(allRounds || [])
      if (allRounds && allRounds.length > 0) {
        await loadRound(allRounds[0].id, authUser.id)
        setSelectedRoundId(allRounds[0].id)
      }
      setLoading(false)
    }
    init()
  }, [])

  async function loadRound(roundId: string, userId?: string) {
    setLoadingRound(true)
    const { data: rodada } = await supabase.from('rounds').select('*').eq('id', roundId).single()
    const uid = userId || user?.id
    const rankingQuery = supabase
      .from('entries').select('*, users(nome)')
      .eq('round_id', roundId).eq('payment_status', 'paid')
      .order('total_hits', { ascending: false })
    if (rodada?.status === 'open' && uid) rankingQuery.eq('user_id', uid)

    const { data: entries } = await rankingQuery
    const { count } = await supabase
      .from('entries')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', roundId)
      .eq('payment_status', 'paid')
    const { data: sorteios } = await supabase
      .from('draw_results').select('*').eq('round_id', roundId).order('draw_date', { ascending: true })

    const todosNumeros = (sorteios || []).flatMap((d: any) => d.numbers)
    const numerosUnicos = Array.from(new Set(todosNumeros)) as number[]

    // Busca regras de premio da rodada
    const { data: rules } = await supabase
      .from('prize_rules').select('*').eq('round_id', roundId)
    if (rules && rules.length > 0) {
      const r: any = {}
      rules.forEach((rule: any) => { r[rule.prize_type] = rule.percentage })
      setPrizeRules({
        first10: r.first10 ?? 50,
        firstDraw: r.firstDraw ?? 7,
        second: r.second ?? 18,
        last: r.last ?? 13,
        admin: r.admin ?? 12,
      })
    }

    const firstDraw = (sorteios || []).find((d: any) => d.is_first)
    let winnerIds: string[] = []
    let winnerNames: string[] = []
    if (firstDraw) {
      const { data: hits } = await supabase
        .from('entry_hits')
        .select('entry_id, hits_count, entries(id, users(nome))')
        .eq('draw_result_id', firstDraw.id)
        .order('hits_count', { ascending: false })
      if (hits && hits.length > 0) {
        const maxHits = hits[0].hits_count
        if (maxHits > 0) {
          const winners = hits.filter((h: any) => h.hits_count === maxHits)
          winnerIds = winners.map((h: any) => h.entry_id)
          winnerNames = winners.map((h: any) => h.entries?.users?.nome || '')
        }
      }
    }

    setRound(rodada)
    setRanking(entries || [])
    setTotalPaidEntries(count || 0)
    setAllDrawnNumbers(numerosUnicos)
    setFirstDrawWinnerIds(winnerIds)
    setFirstDrawWinnerNames(winnerNames)
    setMyEntryCursor(0)

    const minhasEntries = (entries || []).filter((e: any) => e.user_id === uid)
    const ganhou = rodada?.status === 'finished' && minhasEntries.some((e: any) => (e.total_hits || 0) >= 10)
    setIsWinner(ganhou)
    setLoadingRound(false)
  }

  async function handleRoundChange(roundId: string) {
    setSelectedRoundId(roundId)
    await loadRound(roundId, user?.id)
  }

  useEffect(() => {
    if (!isWinner) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const emojis = ['💰', '🤑', '💵', '🏆', '🎉', '✨', '💸', '🥇']
    type Particle = { x: number; y: number; emoji: string; size: number; speedX: number; speedY: number; rotation: number; rotSpeed: number; opacity: number }
    const particles: Particle[] = []
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: -50 - Math.random() * 500,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        size: 20 + Math.random() * 24, speedX: (Math.random() - 0.5) * 2,
        speedY: 2 + Math.random() * 3, rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 4, opacity: 0.8 + Math.random() * 0.2,
      })
    }
    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let allDone = true
      for (const p of particles) {
        p.y += p.speedY; p.x += p.speedX; p.rotation += p.rotSpeed
        if (p.y < canvas.height + 50) allDone = false
        ctx.save(); ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.font = p.size + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(p.emoji, 0, 0); ctx.restore()
      }
      if (!allDone) animRef.current = requestAnimationFrame(animate)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [isWinner])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Carregando...</div>
    </div>
  )

  const rankingPrivado = round?.status === 'open'
  const valorParticipacao = Number(round?.ticket_price || 50)
  const receitaTotal = totalPaidEntries * valorParticipacao
  const encerrada = round?.status === 'finished'
  const vencedores = ranking.filter(e => (e.total_hits || 0) >= 10)
  const naoVencedores = ranking.filter(e => (e.total_hits || 0) < 10)
  const menorPontuacao = naoVencedores.length > 0 ? Math.min(...naoVencedores.map(e => e.total_hits || 0)) : -1
  const maiorPtsNV = naoVencedores.length > 0 ? Math.max(...naoVencedores.map(e => e.total_hits || 0)) : -1
  const segundos = naoVencedores.filter(e => (e.total_hits || 0) === maiorPtsNV)
  const lanternas = naoVencedores.filter(e => (e.total_hits || 0) === menorPontuacao && !segundos.find((s: any) => s.id === e.id))

  const premioFirst10 = receitaTotal * prizeRules.first10 / 100
  const premioFirstDraw = receitaTotal * prizeRules.firstDraw / 100
  const premioSecond = receitaTotal * prizeRules.second / 100
  const premioLast = receitaTotal * prizeRules.last / 100
  const myRankingEntries = user
    ? ranking
        .map((entry, index) => ({ entry, index }))
        .filter(item => item.entry.user_id === user.id)
    : []
  const safeMyEntryCursor = myRankingEntries.length > 0
    ? Math.min(myEntryCursor, myRankingEntries.length - 1)
    : 0

  function scrollToMyEntry(nextIndex = safeMyEntryCursor) {
    if (myRankingEntries.length === 0) return
    const safeIndex = ((nextIndex % myRankingEntries.length) + myRankingEntries.length) % myRankingEntries.length
    const target = myRankingEntries[safeIndex]
    setMyEntryCursor(safeIndex)
    requestAnimationFrame(() => {
      entryRefs.current[target.entry.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function getBadge(entry: any) {
    const hits = entry.total_hits || 0
    if (hits >= 10) return { label: '🏆 Vencedor', color: 'bg-yellow-400 text-gray-900' }
    if (encerrada && segundos.find((e: any) => e.id === entry.id)) return { label: '🥈 2° lugar', color: 'bg-indigo-100 text-indigo-700' }
    if (encerrada && lanternas.find((e: any) => e.id === entry.id)) return { label: '🔦 Lanterna', color: 'bg-red-100 text-red-600' }
    return null
  }

  function medalha(index: number, hits: number) {
    if (hits >= 10) return '🏆'
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    return (index + 1) + '°'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isWinner && <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />}
      <Navbar nomeUsuario={user?.nome || ''} />

      <div className="max-w-4xl mx-auto p-6 pb-28 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Ranking</h2>
            <p className="text-gray-500 text-sm mt-1">
              {allDrawnNumbers.length > 0 && <span className="text-blue-600 font-semibold">{allDrawnNumbers.length} numeros sorteados</span>}
            </p>
          </div>
          {rounds.length > 1 && (
            <select value={selectedRoundId} onChange={e => handleRoundChange(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {rounds.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.nome} {r.status === 'finished' ? '(encerrada)' : r.status === 'open' ? '(ativa)' : '(fechada)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {isWinner && encerrada && (
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-6 mb-6 text-center shadow-lg">
            <div className="text-4xl mb-2">🏆🤑🏆</div>
            <div className="text-2xl font-black text-gray-900 mb-1">Parabéns, {user?.nome}!</div>
            <div className="text-gray-800 font-semibold">Voce é o grande vencedor desta rodada!</div>
            <div className="text-gray-900 text-sm mt-2 font-bold">Prêmio: R${(premioFirst10 / Math.max(vencedores.length, 1)).toFixed(2)} 💰</div>
          </div>
        )}

        {/* Card de primeiro sorteio: só aparece se rodada NAO encerrada */}
        {firstDrawWinnerIds.length > 0 && !encerrada && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">⚡ Mais acertos no 1° sorteio</div>
            <div className="font-bold text-blue-800">{firstDrawWinnerNames.join(' e ')}</div>
            <div className="text-xs text-blue-500 mt-0.5">Prêmio ja garantido nesta rodada!</div>
          </div>
        )}

        {rankingPrivado && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
            <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">Ranking privado</div>
            <div className="text-sm text-yellow-800">
              Enquanto os palpites estiverem abertos, voce ve apenas suas participacoes confirmadas.
            </div>
          </div>
        )}

        {!loadingRound && myRankingEntries.length > 0 && (
          <div className="sticky top-16 z-30 mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-blue-600">Meus palpites no ranking</div>
              <div className="text-sm font-semibold text-blue-900">
                {myRankingEntries.length === 1
                  ? `Sua participacao esta na ${myRankingEntries[0].index + 1}ª posicao.`
                  : `${safeMyEntryCursor + 1} de ${myRankingEntries.length} participacoes · posicao ${myRankingEntries[safeMyEntryCursor].index + 1}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {myRankingEntries.length > 1 && (
                <button
                  onClick={() => scrollToMyEntry(safeMyEntryCursor - 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-blue-600 shadow-sm transition hover:bg-blue-100"
                  aria-label="Palpite anterior"
                >
                  ‹
                </button>
              )}
              <button
                onClick={() => scrollToMyEntry(safeMyEntryCursor)}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 sm:flex-none"
              >
                Buscar meu palpite
              </button>
              {myRankingEntries.length > 1 && (
                <button
                  onClick={() => scrollToMyEntry(safeMyEntryCursor + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-blue-600 shadow-sm transition hover:bg-blue-100"
                  aria-label="Proximo palpite"
                >
                  ›
                </button>
              )}
            </div>
          </div>
        )}

        {/* Resultado final completo quando encerrada */}
        {encerrada && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-5 mb-6">
            <div className="font-bold text-yellow-800 text-lg mb-3">🎉 Resultado Final</div>
            <div className="space-y-2">
              {vencedores.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-700">🏆 <strong>Vencedor(es):</strong> {vencedores.map((e: any) => e.users?.nome).join(', ')}</span>
                  <span className="font-bold text-yellow-800">R${(premioFirst10 / Math.max(vencedores.length, 1)).toFixed(2)}</span>
                </div>
              )}
              {firstDrawWinnerIds.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-700">⚡ <strong>1° sorteio:</strong> {firstDrawWinnerNames.join(' e ')}</span>
                  <span className="font-bold text-yellow-800">R${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}{firstDrawWinnerIds.length > 1 ? ' cada' : ''}</span>
                </div>
              )}
              {segundos.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-700">🥈 <strong>2° lugar:</strong> {segundos.map((e: any) => e.users?.nome).join(', ')} ({maiorPtsNV} pts)</span>
                  <span className="font-bold text-yellow-800">R${(premioSecond / Math.max(segundos.length, 1)).toFixed(2)}{segundos.length > 1 ? ' cada' : ''}</span>
                </div>
              )}
              {lanternas.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-700">🔦 <strong>Lanterna:</strong> {lanternas.map((e: any) => e.users?.nome).join(', ')} ({menorPontuacao} pts)</span>
                  <span className="font-bold text-yellow-800">R${(premioLast / Math.max(lanternas.length, 1)).toFixed(2)}{lanternas.length > 1 ? ' cada' : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {loadingRound ? (
          <div className="text-center py-12 text-gray-400 text-sm">Carregando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="font-bold text-gray-700 mb-1">
              {rankingPrivado ? 'Voce ainda nao tem participacoes pagas nesta rodada' : 'Nenhum pagamento confirmado ainda'}
            </h3>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              {ranking.map((entry, index) => {
                const isMe = entry.user_id === user?.id
                const hits = entry.total_hits || 0
                const badge = getBadge(entry)
                const isVencedor = hits >= 10
                const isLanterna = encerrada && !!lanternas.find((e: any) => e.id === entry.id)
                const isSegundo = encerrada && !!segundos.find((e: any) => e.id === entry.id)
                const isPrimeiroSorteio = firstDrawWinnerIds.includes(entry.id)
                const statusColor = isVencedor ? 'text-yellow-500' : isSegundo ? 'text-indigo-600' : isLanterna ? 'text-red-400' : 'text-blue-600'
                const isSelectedMine = isMe && myRankingEntries[safeMyEntryCursor]?.entry.id === entry.id

                return (
                  <div
                    key={entry.id}
                    ref={(el) => { entryRefs.current[entry.id] = el }}
                    className={
                    'scroll-mt-24 px-3 py-2.5 border-b border-gray-50 last:border-b-0 sm:flex sm:items-center sm:gap-3 sm:px-4 sm:py-3 ' +
                    (isSelectedMine ? 'ring-2 ring-blue-500 ring-inset ' : '') +
                    (isVencedor ? 'bg-yellow-50' : isSegundo ? 'bg-indigo-50' : isLanterna ? 'bg-red-50' : isMe ? 'bg-gray-50' : 'hover:bg-gray-50')
                  }>
                    <div className="flex items-center gap-2 sm:contents">
                      <div className="w-7 shrink-0 text-center text-xs font-black text-gray-400 sm:w-8 sm:text-sm">{medalha(index, hits)}</div>
                      <div className="min-w-0 flex-1 sm:w-40 sm:shrink-0 sm:flex-none">
                        <div className="truncate text-sm font-bold text-gray-800">
                          {entry.users?.nome}{isMe && <span className="ml-1 text-xs text-blue-400">(voce)</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {badge && <span className={'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-tight sm:text-xs ' + badge.color}>{badge.label}</span>}
                          {isPrimeiroSorteio && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-blue-700 sm:text-xs">⚡ 1° sorteio</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right sm:hidden">
                        <div className={'text-lg font-black leading-none ' + statusColor}>{hits}</div>
                        <div className="mt-0.5 text-[10px] text-gray-400">pts</div>
                      </div>
                    </div>
                    <div className="ml-9 mt-2 grid grid-cols-10 gap-0.5 sm:ml-0 sm:mt-0 sm:flex sm:flex-1 sm:flex-wrap sm:gap-1">
                      {entry.numbers.map((n: number) => {
                        const isHit = allDrawnNumbers.includes(n)
                        return (
                          <span key={n} className={'flex h-5 w-5 shrink-0 items-center justify-center justify-self-center rounded-full font-mono text-[10px] font-bold sm:h-7 sm:w-7 sm:text-xs ' + (isHit ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400')}>
                            {String(n).padStart(2, '0')}
                          </span>
                        )
                      })}
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className={'text-xl font-black ' + statusColor}>{hits}</div>
                      <div className="text-xs text-gray-400">pts</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Distribuicao sem percentuais para o usuario */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Distribuição de Prêmios</div>
              <div className="space-y-2">
                {[
                  { label: '🏆 1° a fazer 10 pontos', valor: premioFirst10, info: encerrada && vencedores.length > 0 ? vencedores.map((e: any) => e.users?.nome).join(', ') : '' },
                  { label: '⚡ Mais acertos no 1° sorteio', valor: premioFirstDraw, info: firstDrawWinnerNames.join(' e ') },
                  { label: '🥈 2° melhor colocado final', valor: premioSecond, info: encerrada && segundos.length > 0 ? segundos.map((e: any) => e.users?.nome).join(', ') : '' },
                  { label: '🔦 Lanterna (menos acertos)', valor: premioLast, info: encerrada && lanternas.length > 0 ? lanternas.map((e: any) => e.users?.nome).join(', ') : '' },
                ].map(p => (
                  <div key={p.label} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-gray-600">{p.label}</span>
                      {p.info && <div className="text-xs text-green-600 font-semibold mt-0.5">{p.info}</div>}
                    </div>
                    <span className="font-black text-blue-600">R${p.valor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
