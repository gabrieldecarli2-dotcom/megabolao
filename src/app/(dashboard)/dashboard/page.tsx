'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'
import { closeExpiredRounds, formatRoundDeadline } from '@/lib/rounds'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [round, setRound] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [ranking, setRanking] = useState<any[]>([])
  const [totalParticipantes, setTotalParticipantes] = useState(0)
  const [lastDraw, setLastDraw] = useState<any>(null)
  const [firstDrawWinnerIds, setFirstDrawWinnerIds] = useState<string[]>([])
  const [allDrawnNumbers, setAllDrawnNumbers] = useState<number[]>([])
  const [prizeRules, setPrizeRules] = useState<any>(null)
  const [showNewRoundModal, setShowNewRoundModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      await closeExpiredRounds()

      const { data: profile } = await supabase
        .from('users').select('*').eq('id', authUser.id).single()

      const { data: rodada } = await supabase
        .from('rounds').select('*')
        .in('status', ['open', 'closed', 'finished'])
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      if (rodada) {
        const { data: minhasEntries } = await supabase
          .from('entries').select('*')
          .eq('user_id', authUser.id)
          .eq('round_id', rodada.id)
          .order('total_hits', { ascending: false })

        const rankingQuery = supabase
          .from('entries').select('*, users(nome)')
          .eq('round_id', rodada.id)
          .eq('payment_status', 'paid')
          .order('total_hits', { ascending: false })
        if (rodada.status === 'open') rankingQuery.eq('user_id', authUser.id)

        const { data: todasEntries } = await rankingQuery
        const { count } = await supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('round_id', rodada.id)
          .eq('payment_status', 'paid')

        const { data: sorteios } = await supabase
          .from('draw_results').select('*')
          .eq('round_id', rodada.id)
          .order('draw_date', { ascending: false })

        const todosNumeros = (sorteios || []).flatMap((d: any) => d.numbers)
        const numerosUnicos = Array.from(new Set(todosNumeros)) as number[]
        const firstDraw = (sorteios || []).find((d: any) => d.is_first)
        let firstWinnerIds: string[] = []
        if (firstDraw) {
          const { data: hits } = await supabase
            .from('entry_hits')
            .select('entry_id, hits_count')
            .eq('draw_result_id', firstDraw.id)
            .order('hits_count', { ascending: false })
          if (hits && hits.length > 0) {
            const maxHits = hits[0].hits_count
            if (maxHits > 0) firstWinnerIds = hits.filter((h: any) => h.hits_count === maxHits).map((h: any) => h.entry_id)
          }
        }

        const { data: rules } = await supabase
          .from('prize_rules').select('*').eq('round_id', rodada.id)
        if (rules && rules.length > 0) {
          const r: any = {}
          rules.forEach((rule: any) => { r[rule.prize_type] = rule.percentage })
          setPrizeRules(r)
        }

        setRound(rodada)
        setEntries(minhasEntries || [])
        setRanking(todasEntries || [])
        setTotalParticipantes(count || 0)
        setLastDraw(sorteios?.[0] || null)
        setFirstDrawWinnerIds(firstWinnerIds)
        setAllDrawnNumbers(numerosUnicos)
      }

      setUser(profile)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (loading || !round || !user) return
    if (round.status !== 'open') return

    const hasActiveEntry = entries.some(entry => entry.payment_status !== 'cancelled')
    if (hasActiveEntry) return

    const storageKey = `megabolao:new-round-modal:${user.id}:${round.id}`
    if (window.localStorage.getItem(storageKey) === 'dismissed') return

    setShowNewRoundModal(true)
  }, [loading, round, user, entries])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Carregando...</div>
    </div>
  )

  const paidEntries = entries.filter(e => e.payment_status === 'paid')
  const pendingEntries = entries.filter(e => e.payment_status === 'pending')
  const melhorEntry = paidEntries[0] || null
  const melhoresAcertos = melhorEntry ? (melhorEntry.total_hits || 0) : null
  const rankingPrivado = round?.status === 'open'
  const valorParticipacao = Number(round?.ticket_price || 50)
  const receitaTotal = totalParticipantes * valorParticipacao
  const premioVisivel = prizeRules !== null
  const premioFirst10 = receitaTotal * (prizeRules?.first10 ?? 50) / 100
  const premioFirstDraw = receitaTotal * (prizeRules?.firstDraw ?? 7) / 100
  const premioSecond = receitaTotal * (prizeRules?.second ?? 18) / 100
  const premioLast = receitaTotal * (prizeRules?.last ?? 13) / 100
  const vencedores = !rankingPrivado ? ranking.filter(e => (e.total_hits || 0) >= 10) : []
  const naoVencedores = !rankingPrivado ? ranking.filter(e => (e.total_hits || 0) < 10) : []
  const maiorPtsNV = naoVencedores.length > 0 ? Math.max(...naoVencedores.map(e => e.total_hits || 0)) : -1
  const menorPts = naoVencedores.length > 0 ? Math.min(...naoVencedores.map(e => e.total_hits || 0)) : -1
  const segundos = round?.status === 'finished' && maiorPtsNV >= 0
    ? naoVencedores.filter(e => (e.total_hits || 0) === maiorPtsNV)
    : []
  const lanternas = round?.status === 'finished' && menorPts >= 0
    ? naoVencedores.filter(e => (e.total_hits || 0) === menorPts && !segundos.find(s => s.id === e.id))
    : []
  const meusPremios = paidEntries.flatMap(entry => {
    const premios = []
    if (vencedores.find(v => v.id === entry.id)) {
      premios.push({
        label: '🏆 Vencedor',
        valor: premioFirst10 / Math.max(vencedores.length, 1),
        status: entry.prize_status,
      })
    }
    if (firstDrawWinnerIds.includes(entry.id)) {
      premios.push({
        label: '⚡ 1° sorteio',
        valor: premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1),
        status: entry.prize_status,
      })
    }
    if (segundos.find(s => s.id === entry.id)) {
      premios.push({
        label: '🥈 2° lugar',
        valor: premioSecond / Math.max(segundos.length, 1),
        status: entry.prize_status,
      })
    }
    if (lanternas.find(l => l.id === entry.id)) {
      premios.push({
        label: '🔻 Lanterna',
        valor: premioLast / Math.max(lanternas.length, 1),
        status: entry.prize_status,
      })
    }
    return premios
  })
  const meusPremiosPendentes = meusPremios.filter(p => p.status !== 'paid')

  const minhaPosicao = !rankingPrivado && ranking.length > 0 && user
    ? (() => {
        const minhasIds = paidEntries.map(e => e.id)
        const idx = ranking.findIndex(e => minhasIds.includes(e.id))
        return idx >= 0 ? idx + 1 : null
      })()
    : null

  const top5 = ranking.slice(0, 5)

  function medalha(i: number, hits: number) {
    if (hits >= 10) return '🏆'
    if (i === 0) return '🥇'
    if (i === 1) return '🥈'
    return (i + 1) + '°'
  }

  const statusLabel = () => {
    if (!round) return null
    if (round.status === 'open') return { label: '● Aberto', color: 'bg-green-400 text-gray-900' }
    if (round.status === 'closed') return { label: '● Em andamento', color: 'bg-blue-400 text-white' }
    if (round.status === 'finished') return { label: '● Encerrado', color: 'bg-gray-400 text-white' }
    return null
  }
  const sl = statusLabel()

  function dismissNewRoundModal() {
    if (round && user) {
      window.localStorage.setItem(`megabolao:new-round-modal:${user.id}:${round.id}`, 'dismissed')
    }
    setShowNewRoundModal(false)
  }

  function goToNewEntryFromModal() {
    dismissNewRoundModal()
    router.push('/apostar')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar nomeUsuario={user?.nome || ''} />

      {showNewRoundModal && round && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-yellow-200 bg-white p-6 shadow-2xl">
            <div className="mb-3 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-700">
              Nova rodada aberta
            </div>
            <h3 className="text-2xl font-black text-gray-900">Rodada {round.nome} ja começou!</h3>
            <p className="mt-2 text-sm text-gray-500">
              Monte seus 10 numeros e garanta sua participacao no MegaBolao.
            </p>
            {round.end_date && (
              <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                Palpites ate {formatRoundDeadline(round)}
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={goToNewEntryFromModal}
                className="flex-1 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-gray-900 transition hover:bg-yellow-300"
              >
                Participar agora
              </button>
              <button
                onClick={dismissNewRoundModal}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-6 pb-28 md:pb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Ola, {user?.nome}! 👋</h2>
          <p className="text-gray-500 text-sm mt-1">Bem-vindo ao MegaBolao</p>
        </div>

        {!round && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🎱</div>
            <h3 className="font-bold text-gray-700 mb-1">Nenhuma rodada ativa</h3>
            <p className="text-gray-400 text-sm">Aguarde o admin abrir uma nova rodada.</p>
          </div>
        )}

        {round && (
          <>
            {/* Banner da rodada */}
            <div className="bg-blue-600 rounded-2xl p-6 mb-6 text-white relative overflow-hidden shadow-lg">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-8xl opacity-10">💰</div>
              <div className="relative z-10">
                <div className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2">🎰 Rodada</div>
                <h3 className="text-3xl font-black tracking-wide mb-3">{round.nome}</h3>
                <div className="flex gap-4 flex-wrap text-sm text-blue-200">
                  {round.end_date && (
                    <span>Encerramento palpites: <strong className="text-white">{formatRoundDeadline(round)}</strong></span>
                  )}
                  <span>Participacoes pagas: <strong className="text-white">{totalParticipantes}</strong></span>
                  {sl && <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + sl.color}>{sl.label}</span>}
                </div>
                {round.status === 'open' && (
                  <button
                    onClick={() => router.push('/apostar')}
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-gray-900 shadow-sm transition hover:bg-yellow-300"
                  >
                    + Nova Participacao
                  </button>
                )}
                {round.status === 'closed' && !lastDraw && (
                  <div className="mt-3 bg-yellow-400/20 border border-yellow-400/40 rounded-xl px-4 py-2 text-yellow-200 text-xs">
                    O periodo de palpites foi encerrado. Aguardando inicio dos sorteios.
                  </div>
                )}
              </div>
            </div>

            <details className="group mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-yellow-50 px-5 py-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-blue-600">Saiba como funciona</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-700">Entenda as participacoes, pagamentos, sorteios e premiacoes.</div>
                </div>
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white transition group-open:rotate-180">▼</span>
              </summary>
              <div className="grid gap-4 border-t border-blue-50 p-5 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-gray-400">1. Periodo de palpites</div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Quando uma nova rodada abre, voce pode cadastrar suas participacoes ate o prazo definido pelo admin.
                    Cada participacao custa <strong className="text-blue-600">R${valorParticipacao.toFixed(2)}</strong>.
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-gray-400">2. Escolha dos numeros</div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Em cada participacao, escolha <strong>10 numeros de 01 a 60</strong>. Voce pode participar com quantas participacoes quiser.
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-gray-400">3. Pagamento</div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    O pagamento pode ser feito por Pix online direto no site ou manualmente com o administrador. Apos o encerramento, participacoes pagas sao validadas e as nao pagas sao canceladas.
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-gray-400">4. Sorteios e ranking</div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    A rodada acompanha os sorteios da Mega-Sena a partir do proximo concurso apos o fim dos palpites. A cada sorteio, o ranking e os acertos sao atualizados automaticamente.
                  </p>
                </div>
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 md:col-span-2">
                  <div className="text-xs font-black uppercase tracking-wide text-yellow-700">Premiacao</div>
                  <p className="mt-2 text-sm leading-6 text-yellow-900">
                    Quem completar 10 acertos primeiro ganha o premio principal. Tambem existem premios para quem acertar mais numeros no primeiro sorteio, para o segundo colocado e para o ultimo colocado. Em caso de empate ou mais de um ganhador, o premio correspondente e dividido.
                  </p>
                </div>
              </div>
            </details>

            {meusPremios.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-4 mb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">🏆 Premiação garantida</div>
                    <div className="text-sm font-semibold text-yellow-900">
                      Voce ganhou {meusPremios.length} premiacao(es) nesta rodada.
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meusPremios.map((premio, index) => (
                        <span key={premio.label + index} className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-gray-900">
                          {premio.label} · R${premio.valor.toFixed(2)}
                        </span>
                      ))}
                    </div>
                    {meusPremiosPendentes.length > 0 && (
                      <div className="mt-2 text-xs font-semibold text-yellow-800">
                        Aguardando premiacao do admin.
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => router.push('/minhas-participacoes')}
                    className="shrink-0 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-black text-gray-900 transition hover:bg-yellow-300"
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            )}

            {round.status === 'open' && pendingEntries.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">Pagamento pendente</div>
                    <div className="text-sm text-yellow-800">
                      Voce tem {pendingEntries.length} participacao(es) aguardando aprovacao de pagamento nesta rodada.
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/minhas-participacoes')}
                    className="shrink-0 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-black text-gray-900 transition hover:bg-yellow-300"
                  >
                    Ver pendencias
                  </button>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suas participacoes</div>
                <div className="text-3xl font-black text-blue-600">{paidEntries.length}</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Seus acertos</div>
                <div className="text-3xl font-black text-blue-600">
                  {melhoresAcertos !== null ? melhoresAcertos : <span className="text-gray-300 text-2xl">--</span>}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Melhor posicao</div>
                <div className="text-3xl font-black text-yellow-500">
                  {minhaPosicao ? minhaPosicao : <span className="text-gray-300 text-2xl">--</span>}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-yellow-200 shadow-sm bg-gradient-to-br from-yellow-50 to-white">
              <div className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-2">Prêmio do vencedor</div>
                {premioVisivel || round.status !== 'open' ? (
                  <>
                    <div className="text-3xl font-black text-yellow-600">R${premioFirst10.toFixed(0)}</div>
                    <div className="text-xs text-yellow-700 mt-1">Prêmio principal</div>
                  </>
                ) : (
                  <>
                    <div className="text-xl font-black text-gray-300">A definir</div>
                    <div className="text-xs text-gray-400 mt-1">Apos encerramento</div>
                  </>
                )}
              </div>
            </div>

            {/* Melhor participacao + ultimo sorteio */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {melhorEntry ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Minha melhor participacao</div>
                  <div className="text-sm text-blue-600 font-bold mb-4">{melhorEntry.total_hits || 0} acertos acumulados</div>
                  <div className="grid grid-cols-10 gap-1 mb-4">
                    {melhorEntry.numbers.map((n: number) => {
                      const isHit = allDrawnNumbers.includes(n)
                      return (
                        <div key={n} className={'aspect-square rounded-full text-xs font-bold font-mono flex items-center justify-center ' + (isHit ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 border border-gray-200')}>
                          {String(n).padStart(2, '0')}
                        </div>
                      )
                    })}
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: ((melhorEntry.total_hits || 0) / 10 * 100) + '%' }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-2">{melhorEntry.total_hits || 0}/10 — faltam {10 - (melhorEntry.total_hits || 0)} para vencer</div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                  <div className="text-4xl mb-3">🎯</div>
                  <h3 className="font-bold text-gray-700 mb-1">
                    {round.status === 'open' ? 'Sem participacoes ainda' : 'Voce nao participou desta rodada'}
                  </h3>
                  {round.status === 'open' && (
                    <p className="text-gray-400 text-sm">Escolha seus numeros e concorra!</p>
                  )}
                </div>
              )}

              {lastDraw ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Ultimo sorteio — Concurso {lastDraw.contest_number}</div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {lastDraw.numbers.map((n: number) => (
                      <div key={n} className="w-11 h-11 rounded-full bg-yellow-400 text-gray-900 font-black font-mono text-sm flex items-center justify-center shadow-sm">
                        {String(n).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400">{new Date(lastDraw.draw_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                  {!rankingPrivado && ranking.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      Lider: <strong className="text-gray-800">{ranking[0]?.users?.nome}</strong> com <strong className="text-blue-600">{ranking[0]?.total_hits || 0} acertos</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                  <div className="text-4xl mb-3">⏳</div>
                  <h3 className="font-bold text-gray-700 mb-1">
                  {lastDraw ? 'Aguardando proximo sorteio' : round.status === 'closed' ? 'Aguardando primeiro sorteio' : 'Aguardando sorteio'}
                  </h3>
                  <p className="text-gray-400 text-sm">O resultado aparecera aqui apos o proximo sorteio.</p>
                </div>
              )}
            </div>

            {/* Mini ranking top 5 */}
            {top5.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                  {rankingPrivado ? 'Seus palpites confirmados' : 'Top 5 — Ranking Parcial'}
                </div>
                <div className="space-y-2">
                  {top5.map((entry, i) => {
                    const isMe = entry.user_id === user?.id
                    const hits = entry.total_hits || 0
                    return (
                      <div key={entry.id} className={'px-3 py-2.5 rounded-xl ' + (isMe ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50')}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 text-center text-sm font-black text-gray-400 shrink-0">{medalha(i, hits)}</div>
                          <div className="flex-1 text-sm font-semibold text-gray-800 truncate">
                            {entry.users?.nome}
                            {isMe && <span className="ml-1 text-xs text-blue-400">(voce)</span>}
                          </div>
                          <div className="font-black text-blue-600 text-lg">{hits}</div>
                          <div className="text-xs text-gray-400">pts</div>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-11">
                          {entry.numbers?.map((n: number) => {
                            const isHit = allDrawnNumbers.includes(n)
                            return (
                              <span key={n} className={'w-6 h-6 rounded-full text-xs font-bold font-mono flex items-center justify-center ' + (isHit ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400')}>
                                {String(n).padStart(2, '0')}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Botoes */}
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => router.push('/ranking')} className="bg-white hover:bg-gray-50 text-gray-700 font-semibold px-5 py-2.5 rounded-xl text-sm border border-gray-200 transition">
                Ver ranking completo
              </button>
              <button onClick={() => router.push('/resultados')} className="bg-white hover:bg-gray-50 text-gray-700 font-semibold px-5 py-2.5 rounded-xl text-sm border border-gray-200 transition">
                Ver Resultados
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
