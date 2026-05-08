'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { closeExpiredRounds, formatRoundDeadline } from '@/lib/rounds'
import { BarChart3, ClipboardList, Settings, TicketCheck, Trophy, UserRound, Users } from 'lucide-react'

type Tab = 'painel' | 'ranking' | 'participantes' | 'sorteios' | 'premiacao' | 'usuarios'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('painel')
  const [user, setUser] = useState<any>(null)
  const [allRounds, setAllRounds] = useState<any[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string>('')
  const [round, setRound] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [draws, setDraws] = useState<any[]>([])
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null)
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantsPage, setParticipantsPage] = useState(1)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([])
  const [novoUsuarioNome, setNovoUsuarioNome] = useState('')
  const [novoUsuarioEmail, setNovoUsuarioEmail] = useState('')
  const [novoUsuarioTelefone, setNovoUsuarioTelefone] = useState('')
  const [novoUsuarioSenha, setNovoUsuarioSenha] = useState('')
  const [novoUsuarioRole, setNovoUsuarioRole] = useState<'user' | 'admin'>('user')
  const [criandoUsuario, setCriandoUsuario] = useState(false)
  const [msgNovoUsuario, setMsgNovoUsuario] = useState('')
  const [allDrawnNumbers, setAllDrawnNumbers] = useState<number[]>([])
  const [firstDrawWinnerIds, setFirstDrawWinnerIds] = useState<string[]>([])
  const [firstDrawWinners, setFirstDrawWinners] = useState<string[]>([])
  const [prizeRules, setPrizeRules] = useState({ first10: 50, firstDraw: 7, second: 18, last: 13, admin: 12 })
  const [loading, setLoading] = useState(true)
  const [salvandoPremiacao, setSalvandoPremiacao] = useState(false)
  const [msgPremiacao, setMsgPremiacao] = useState('')

  const [concurso, setConcurso] = useState('')
  const [dataSorteio, setDataSorteio] = useState('')
  const [numerosSorteio, setNumerosSorteio] = useState('')
  const [salvandoSorteio, setSalvandoSorteio] = useState(false)
  const [buscandoResultado, setBuscandoResultado] = useState(false)
  const [msgSorteio, setMsgSorteio] = useState('')

  const [nomeRodada, setNomeRodada] = useState('')
  const [inicioRodada, setInicioRodada] = useState('')
  const [fimRodada, setFimRodada] = useState('')
  const [fimRodadaHora, setFimRodadaHora] = useState('')
  const [valorParticipacao, setValorParticipacao] = useState('50')
  const [salvandoRodada, setSalvandoRodada] = useState(false)

  const [novaRodadaNome, setNovaRodadaNome] = useState('')
  const [novaRodadaInicio, setNovaRodadaInicio] = useState('')
  const [novaRodadaFim, setNovaRodadaFim] = useState('')
  const [novaRodadaFimHora, setNovaRodadaFimHora] = useState('')
  const [novaRodadaValor, setNovaRodadaValor] = useState('50')
  const [criandoRodada, setCriandoRodada] = useState(false)
  const [msgNovaRodada, setMsgNovaRodada] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      await closeExpiredRounds()
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
      setUser(profile)
      await loadUsersData()
      const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
      setAllRounds(rounds || [])
      if (rounds && rounds.length > 0) {
        setSelectedRoundId(rounds[0].id)
        await loadRoundData(rounds[0].id)
      }
      setLoading(false)
    }
    init()
  }, [])

  async function loadRoundData(roundId: string) {
    const { data: rodada } = await supabase.from('rounds').select('*').eq('id', roundId).single()
    if (!rodada) return
    setRound(rodada)
    setNomeRodada(rodada.nome)
    setInicioRodada(rodada.start_date || '')
    setFimRodada(rodada.end_date || '')
    setFimRodadaHora(rodada.end_time?.slice(0, 5) || '')
    setValorParticipacao(String(rodada.ticket_price || 50))

    const { data: participacoes } = await supabase
      .from('entries').select('*, users(nome, telefone, pix_key), payments(id, method, status, amount, entry_count, expires_at, ticket_url, mercado_pago_status, mercado_pago_status_detail)')
      .eq('round_id', roundId).order('total_hits', { ascending: false })

    const { data: sorteios } = await supabase
      .from('draw_results').select('*').eq('round_id', roundId).order('draw_date', { ascending: true })

    const todosNumeros = (sorteios || []).flatMap((d: any) => d.numbers)
    const numerosUnicos = Array.from(new Set(todosNumeros)) as number[]

    // Regras de premiacao
    const { data: rules } = await supabase.from('prize_rules').select('*').eq('round_id', roundId)
    if (rules && rules.length > 0) {
      const r: any = {}
      rules.forEach((rule: any) => { r[rule.prize_type] = rule.percentage })
      setPrizeRules({ first10: r.first10 ?? 50, firstDraw: r.firstDraw ?? 7, second: r.second ?? 18, last: r.last ?? 13, admin: r.admin ?? 12 })
    } else {
      setPrizeRules({ first10: 50, firstDraw: 7, second: 18, last: 13, admin: 12 })
    }

    // Vencedores do 1° sorteio
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

    setEntries(participacoes || [])
    setDraws([...(sorteios || [])].reverse())
    setAllDrawnNumbers(numerosUnicos)
    setFirstDrawWinnerIds(winnerIds)
    setFirstDrawWinners(winnerNames)
  }

  async function loadUsersData() {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, nome, email, telefone, pix_key, role, created_at')
      .order('created_at', { ascending: false })

    const { data: allEntries } = await supabase
      .from('entries')
      .select('id, user_id, round_id, payment_status, total_hits, prize_status, rounds(status)')

    const { data: allDraws } = await supabase
      .from('draw_results')
      .select('id, round_id, is_first')

    const { data: allHits } = await supabase
      .from('entry_hits')
      .select('entry_id, draw_result_id, hits_count')

    const awardedIds = new Set<string>()
    const paidEntriesByRound = new Map<string, any[]>()
    ;(allEntries || [])
      .filter((entry: any) => entry.payment_status === 'paid')
      .forEach((entry: any) => {
        if (!paidEntriesByRound.has(entry.round_id)) paidEntriesByRound.set(entry.round_id, [])
        paidEntriesByRound.get(entry.round_id)?.push(entry)
        if ((entry.total_hits || 0) >= 10) awardedIds.add(entry.id)
      })

    ;(allDraws || [])
      .filter((draw: any) => draw.is_first)
      .forEach((draw: any) => {
        const hits = (allHits || []).filter((hit: any) => hit.draw_result_id === draw.id)
        if (hits.length === 0) return
        const maxHits = Math.max(...hits.map((hit: any) => hit.hits_count || 0))
        if (maxHits <= 0) return
        hits.filter((hit: any) => hit.hits_count === maxHits).forEach((hit: any) => awardedIds.add(hit.entry_id))
      })

    paidEntriesByRound.forEach((roundEntries) => {
      const status = roundEntries[0]?.rounds?.status
      if (status !== 'finished') return
      const naoVencedores = roundEntries.filter((entry: any) => (entry.total_hits || 0) < 10)
      if (naoVencedores.length === 0) return
      const maiorPts = Math.max(...naoVencedores.map((entry: any) => entry.total_hits || 0))
      const menorPts = Math.min(...naoVencedores.map((entry: any) => entry.total_hits || 0))
      const segundos = naoVencedores.filter((entry: any) => (entry.total_hits || 0) === maiorPts)
      segundos.forEach((entry: any) => awardedIds.add(entry.id))
      naoVencedores
        .filter((entry: any) => (entry.total_hits || 0) === menorPts && !segundos.find((segundo: any) => segundo.id === entry.id))
        .forEach((entry: any) => awardedIds.add(entry.id))
    })

    const entriesByUser = new Map<string, any[]>()
    ;(allEntries || []).forEach((entry: any) => {
      if (!entriesByUser.has(entry.user_id)) entriesByUser.set(entry.user_id, [])
      entriesByUser.get(entry.user_id)?.push(entry)
    })

    setRegisteredUsers((usersData || []).map((userData: any) => {
      const userEntries = entriesByUser.get(userData.id) || []
      const awardedEntries = userEntries.filter((entry: any) => awardedIds.has(entry.id))
      return {
        ...userData,
        entriesCount: userEntries.length,
        paidEntriesCount: userEntries.filter((entry: any) => entry.payment_status === 'paid').length,
        awardedCount: awardedEntries.length,
        prizePaidCount: awardedEntries.filter((entry: any) => entry.prize_status === 'paid').length,
      }
    }))
  }

  async function criarUsuarioAdmin() {
    setCriandoUsuario(true)
    setMsgNovoUsuario('')

    try {
      if (!novoUsuarioNome.trim() || !novoUsuarioEmail.trim() || !novoUsuarioSenha) {
        setMsgNovoUsuario('Informe nome, email e senha.')
        return
      }

      if (novoUsuarioSenha.length < 6) {
        setMsgNovoUsuario('A senha precisa ter pelo menos 6 caracteres.')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMsgNovoUsuario('Sua sessao expirou. Entre novamente para criar usuarios.')
        return
      }

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome: novoUsuarioNome,
          email: novoUsuarioEmail,
          telefone: novoUsuarioTelefone,
          password: novoUsuarioSenha,
          role: novoUsuarioRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMsgNovoUsuario(result?.error || 'Nao foi possivel criar o usuario.')
        return
      }

      setNovoUsuarioNome('')
      setNovoUsuarioEmail('')
      setNovoUsuarioTelefone('')
      setNovoUsuarioSenha('')
      setNovoUsuarioRole('user')
      setUsersPage(1)
      setMsgNovoUsuario('Usuario criado com sucesso!')
      await loadUsersData()
    } catch {
      setMsgNovoUsuario('Erro inesperado ao criar usuario.')
    } finally {
      setCriandoUsuario(false)
    }
  }

  async function handleRoundChange(roundId: string) {
    setSelectedRoundId(roundId)
    await loadRoundData(roundId)
  }

  async function salvarPremiacao() {
    const total = prizeRules.first10 + prizeRules.firstDraw + prizeRules.second + prizeRules.last + prizeRules.admin
    if (total !== 100) {
      setMsgPremiacao('Os percentuais devem somar 100%. Total atual: ' + total + '%')
      return
    }
    setSalvandoPremiacao(true)
    setMsgPremiacao('')
    const entries_to_insert = Object.entries(prizeRules).map(([prize_type, percentage]) => ({
      round_id: round.id, prize_type, percentage
    }))
    await supabase.from('prize_rules').delete().eq('round_id', round.id)
    await supabase.from('prize_rules').insert(entries_to_insert)
    setSalvandoPremiacao(false)
    setMsgPremiacao('Premiacao salva com sucesso!')
  }

  async function aprovarPagamento(entry: any) {
    if (entry.payment_id) {
      await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString(), cancelled_at: null, updated_at: new Date().toISOString() })
        .eq('id', entry.payment_id)

      await supabase
        .from('entries')
        .update({ payment_status: 'paid' })
        .eq('payment_id', entry.payment_id)
        .neq('payment_status', 'paid')
    } else {
      await supabase.from('entries').update({ payment_status: 'paid' }).eq('id', entry.id)
    }

    await loadRoundData(selectedRoundId)
  }

  async function cancelarPagamento(entry: any) {
    if (entry.payment_id) {
      await supabase
        .from('payments')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', entry.payment_id)

      await supabase
        .from('entries')
        .update({ payment_status: 'cancelled' })
        .eq('payment_id', entry.payment_id)
        .eq('payment_status', 'pending')
    } else {
      await supabase.from('entries').update({ payment_status: 'cancelled' }).eq('id', entry.id)
    }

    await loadRoundData(selectedRoundId)
  }

  async function marcarPremioPago(entryId: string) {
    await supabase.from('entries').update({ prize_status: 'paid' }).eq('id', entryId)
    await loadRoundData(selectedRoundId)
  }

  async function registrarSorteio(payload: { contestNumber: string; drawDate: string; numbers: number[]; source: 'manual' | 'api' }) {
    if (!round) {
      setMsgSorteio('Nenhuma rodada selecionada.')
      return
    }

    setSalvandoSorteio(true)
    setMsgSorteio('')

    const nums = payload.numbers
    if (nums.length !== 6) { setMsgSorteio('Informe exatamente 6 numeros.'); setSalvandoSorteio(false); return }

    const hasRepeatedNumber = new Set(nums).size !== nums.length
    if (hasRepeatedNumber) {
      setMsgSorteio('Os 6 numeros sorteados nao podem repetir.')
      setSalvandoSorteio(false)
      return
    }

    const existingDraw = draws.find((draw: any) => String(draw.contest_number) === String(payload.contestNumber))
    if (existingDraw) {
      setMsgSorteio('Concurso ' + payload.contestNumber + ' ja esta registrado nesta rodada.')
      setSalvandoSorteio(false)
      return
    }

    if (round.start_date && payload.drawDate < round.start_date) {
      setMsgSorteio('O concurso encontrado e anterior ao inicio desta rodada. Confira antes de registrar.')
      setSalvandoSorteio(false)
      return
    }

    const isFirst = draws.length === 0
    const { data: draw, error } = await supabase
      .from('draw_results')
      .insert({ round_id: round.id, contest_number: payload.contestNumber, draw_date: payload.drawDate, numbers: nums, source: payload.source, is_first: isFirst })
      .select().single()
    if (error) { setMsgSorteio('Erro ao salvar sorteio.'); setSalvandoSorteio(false); return }
    const todosNumerosAteAgora = Array.from(new Set([...allDrawnNumbers, ...nums]))
    const paidEntries = entries.filter(e => e.payment_status === 'paid')
    let alguemVenceu = false
    let maxFirstSorteio = 0
    for (const entry of paidEntries) {
      const acertosUnicos = entry.numbers.filter((n: number) => todosNumerosAteAgora.includes(n))
      const acertosDesteSorteio = entry.numbers.filter((n: number) => nums.includes(n))
      await supabase.from('entry_hits').insert({ entry_id: entry.id, draw_result_id: draw.id, hits_count: acertosDesteSorteio.length, hit_numbers: acertosDesteSorteio })
      await supabase.from('entries').update({ total_hits: acertosUnicos.length }).eq('id', entry.id)
      if (acertosUnicos.length >= 10) alguemVenceu = true
      if (isFirst && acertosDesteSorteio.length > maxFirstSorteio) maxFirstSorteio = acertosDesteSorteio.length
    }
    if (alguemVenceu) {
      await supabase.from('rounds').update({ status: 'finished' }).eq('id', round.id)
      setMsgSorteio('Sorteio registrado! Alguem atingiu 10 acertos. Rodada encerrada!')
      const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
      setAllRounds(rounds || [])
    } else {
      setMsgSorteio(isFirst && maxFirstSorteio > 0
        ? 'Sorteio registrado! Maior acerto no 1° sorteio: ' + maxFirstSorteio + ' acerto(s).'
        : 'Sorteio registrado e acertos calculados com sucesso!')
    }
    setConcurso(''); setDataSorteio(''); setNumerosSorteio('')
    setSalvandoSorteio(false)
    await loadRoundData(selectedRoundId)
  }

  async function salvarSorteio() {
    if (!concurso || !dataSorteio || !numerosSorteio) return

    const nums = numerosSorteio.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
    await registrarSorteio({
      contestNumber: concurso.trim(),
      drawDate: dataSorteio,
      numbers: nums,
      source: 'manual',
    })
  }

  async function buscarResultadoMegaSena(registrarAutomaticamente = false) {
    if (!round) {
      setMsgSorteio('Crie ou selecione uma rodada antes de buscar o resultado.')
      return
    }

    setBuscandoResultado(true)
    setMsgSorteio('')

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMsgSorteio('Sua sessao expirou. Entre novamente para buscar o resultado.')
        return
      }

      const response = await fetch('/api/mega-sena/latest', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()

      if (!response.ok) {
        setMsgSorteio(result?.error || 'Erro ao buscar resultado da Mega-Sena.')
        return
      }

      const numbers = Array.isArray(result.numbers) ? result.numbers.map(Number) : []
      setConcurso(String(result.contestNumber || ''))
      setDataSorteio(String(result.drawDate || ''))
      setNumerosSorteio(numbers.map((number: number) => String(number).padStart(2, '0')).join(', '))

      const alreadyRegistered = draws.some((draw: any) => String(draw.contest_number) === String(result.contestNumber))
      if (alreadyRegistered) {
        setMsgSorteio('Concurso ' + result.contestNumber + ' encontrado, mas ele ja esta registrado nesta rodada.')
      } else if (registrarAutomaticamente) {
        await registrarSorteio({
          contestNumber: String(result.contestNumber),
          drawDate: String(result.drawDate),
          numbers,
          source: 'api',
        })
      } else {
        setMsgSorteio('Resultado encontrado: concurso ' + result.contestNumber + '. Confira os numeros e clique em registrar.')
      }
    } catch {
      setMsgSorteio('Erro ao consultar a API da Mega-Sena.')
    } finally {
      setBuscandoResultado(false)
    }
  }

  async function salvarRodada() {
    const ticketPrice = Number(valorParticipacao)
    if (!nomeRodada.trim()) {
      alert('Informe o nome da rodada.')
      return
    }
    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      alert('Informe um valor de participacao valido.')
      return
    }
    setSalvandoRodada(true)

    if (!round) {
      const { data: nova, error } = await supabase.from('rounds').insert({
        nome: nomeRodada.trim(),
        status: 'open',
        start_date: inicioRodada || null,
        end_date: fimRodada || null,
        end_time: fimRodadaHora || null,
        ticket_price: ticketPrice,
      }).select().single()

      if (error) {
        setSalvandoRodada(false)
        alert(error.message.includes('end_time')
          ? 'Não foi possível salvar o horário. Rode a migration que cria a coluna end_time na tabela rounds.'
          : 'Erro ao criar rodada: ' + error.message)
        return
      }

      const { error: prizeError } = await supabase.from('prize_rules').insert([
        { round_id: nova.id, prize_type: 'first10', percentage: 50 },
        { round_id: nova.id, prize_type: 'firstDraw', percentage: 7 },
        { round_id: nova.id, prize_type: 'second', percentage: 18 },
        { round_id: nova.id, prize_type: 'last', percentage: 13 },
        { round_id: nova.id, prize_type: 'admin', percentage: 12 },
      ])

      if (prizeError) {
        setSalvandoRodada(false)
        alert('A rodada foi criada, mas nao foi possivel salvar a premiacao padrao: ' + prizeError.message)
        return
      }

      const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
      setAllRounds(rounds || [])
      setSelectedRoundId(nova.id)
      await loadRoundData(nova.id)
      setSalvandoRodada(false)
      alert('Rodada criada com sucesso!')
      return
    }

    const { error } = await supabase
      .from('rounds')
      .update({ nome: nomeRodada.trim(), start_date: inicioRodada, end_date: fimRodada, end_time: fimRodadaHora || null, ticket_price: ticketPrice })
      .eq('id', round.id)
    setSalvandoRodada(false)

    if (error) {
      alert(error.message.includes('end_time')
        ? 'Não foi possível salvar o horário. Rode a migration que cria a coluna end_time na tabela rounds.'
        : 'Erro ao salvar rodada: ' + error.message)
      return
    }

    const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
    setAllRounds(rounds || [])
    await loadRoundData(selectedRoundId)
    alert('Rodada atualizada!')
  }

  async function alterarStatusRodada(status: string) {
    await supabase.from('rounds').update({ status }).eq('id', round.id)
    const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
    setAllRounds(rounds || [])
    await loadRoundData(selectedRoundId)
  }

  async function criarNovaRodada() {
    if (!novaRodadaNome) { setMsgNovaRodada('Informe o nome da nova rodada.'); return }
    const ticketPrice = Number(novaRodadaValor)
    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      setMsgNovaRodada('Informe um valor de participacao valido.')
      return
    }
    setCriandoRodada(true)
    setMsgNovaRodada('')
    const { data: nova, error } = await supabase.from('rounds').insert({
      nome: novaRodadaNome, status: 'open',
      start_date: novaRodadaInicio || null, end_date: novaRodadaFim || null, end_time: novaRodadaFimHora || null, ticket_price: ticketPrice,
    }).select().single()
    if (error) {
      setMsgNovaRodada(error.message.includes('end_time')
        ? 'Não foi possível salvar o horário. Rode a migration que cria a coluna end_time na tabela rounds.'
        : 'Erro ao criar nova rodada.')
      setCriandoRodada(false)
      return
    }
    // Insere regras de premio padrao para a nova rodada
    await supabase.from('prize_rules').insert([
      { round_id: nova.id, prize_type: 'first10', percentage: 50 },
      { round_id: nova.id, prize_type: 'firstDraw', percentage: 7 },
      { round_id: nova.id, prize_type: 'second', percentage: 18 },
      { round_id: nova.id, prize_type: 'last', percentage: 13 },
      { round_id: nova.id, prize_type: 'admin', percentage: 12 },
    ])
    setMsgNovaRodada('Nova rodada criada com sucesso!')
    setNovaRodadaNome(''); setNovaRodadaInicio(''); setNovaRodadaFim(''); setNovaRodadaFimHora(''); setNovaRodadaValor('50')
    setCriandoRodada(false)
    const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false })
    setAllRounds(rounds || [])
    setSelectedRoundId(nova.id)
    await loadRoundData(nova.id)
  }

  function gerarExtrato() {
    if (!round) return 'Nenhuma rodada selecionada.'

    const deadline = formatRoundDeadline(round)
    const ultimo = draws[0]
    const topRanking = paidEntries.slice(0, 10)
    const valorFirst10 = (premioFirst10 / Math.max(vencedores.length, 1)).toFixed(2)
    const valorFirstDraw = (premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const isUltimoDiaPalpite = round.status === 'open' && round.end_date === hoje

    if (round.status === 'open') {
      if (isUltimoDiaPalpite) {
        return [
          '🚨 MEGABOLAO - Ultimo dia de palpites!',
          '',
          '🎰 Rodada: ' + round.nome,
          deadline ? '⏰ O prazo encerra hoje: ' + deadline : '⏰ O prazo encerra hoje.',
          '💵 Valor por participacao: R$' + Number(round.ticket_price || 50).toFixed(2),
          '',
          '🍀 Ainda da tempo de participar. Monte seus 10 numeros antes do encerramento!',
        ].join('\n')
      }

      return [
        '🎉 MEGABOLAO - Nova rodada aberta!',
        '',
        '🎰 Rodada: ' + round.nome,
        deadline ? '⏰ Palpites abertos ate: ' + deadline : '⏰ Periodo de palpites aberto.',
        '💵 Valor por participacao: R$' + Number(round.ticket_price || 50).toFixed(2),
        '',
        '🍀 Monte seus 10 numeros e envie sua participacao dentro do prazo.',
      ].join('\n')
    }

    if (encerrada) {
      const linhas = [
        '🏆 MEGABOLAO - Resultado final',
        '',
        '🎰 Rodada: ' + round.nome,
      ]

      if (ultimo) {
        linhas.push('🎲 Ultimo concurso: ' + ultimo.contest_number + ' | ' + new Date(ultimo.draw_date + 'T12:00:00').toLocaleDateString('pt-BR'))
        linhas.push('🔢 Numeros sorteados: ' + ultimo.numbers.map((n: number) => String(n).padStart(2, '0')).join(' - '))
        linhas.push('')
      }

      if (vencedores.length > 0) linhas.push('🏆 Vencedor(es): ' + vencedores.map((e: any) => e.users?.nome).join(' e ') + ' - R$' + valorFirst10 + (vencedores.length > 1 ? ' cada' : ''))
      if (firstDrawWinners.length > 0) linhas.push('⚡ Premio 1° sorteio: ' + firstDrawWinners.join(' e ') + ' - R$' + valorFirstDraw + (firstDrawWinnerIds.length > 1 ? ' cada' : ''))
      if (segundos.length > 0) linhas.push('🥈 2° lugar: ' + segundos.map((e: any) => e.users?.nome).join(' e ') + ' - R$' + (premioSecond / Math.max(segundos.length, 1)).toFixed(2) + (segundos.length > 1 ? ' cada' : ''))
      if (lanternas.length > 0) linhas.push('🔦 Lanterna: ' + lanternas.map((e: any) => e.users?.nome).join(' e ') + ' - R$' + (premioLast / Math.max(lanternas.length, 1)).toFixed(2) + (lanternas.length > 1 ? ' cada' : ''))

      linhas.push('')
      linhas.push('📊 Ranking final:')
      topRanking.forEach((e, i) => {
        linhas.push((i + 1) + 'o ' + e.users?.nome + ' - ' + (e.total_hits || 0) + ' pts')
      })

      return linhas.join('\n')
    }

    if (ultimo) {
      const linhas = [
        '🎲 MEGABOLAO - Sorteio registrado',
        '',
        '🎰 Rodada: ' + round.nome,
        '📌 Concurso: ' + ultimo.contest_number + ' | ' + new Date(ultimo.draw_date + 'T12:00:00').toLocaleDateString('pt-BR'),
        '🔢 Numeros sorteados: ' + ultimo.numbers.map((n: number) => String(n).padStart(2, '0')).join(' - '),
      ]

      if (ultimo.is_first && firstDrawWinners.length > 0) {
        linhas.push('')
        linhas.push('⚡ Premio do 1° sorteio:')
        linhas.push('🏅 ' + firstDrawWinners.join(' e ') + ' - R$' + valorFirstDraw + (firstDrawWinnerIds.length > 1 ? ' cada' : ''))
      }

      linhas.push('')
      linhas.push('📊 Ranking parcial:')
      topRanking.forEach((e, i) => {
        linhas.push((i + 1) + 'o ' + e.users?.nome + ' - ' + (e.total_hits || 0) + ' pts')
      })

      return linhas.join('\n')
    }

    return [
      '🔒 MEGABOLAO - Palpites encerrados',
      '',
      '🎰 Rodada: ' + round.nome,
      '✅ O periodo de palpites foi encerrado.',
      '🎲 Agora e aguardar o primeiro sorteio da Mega-Sena.',
    ].join('\n')
  }

  function shareMessage(channel: 'whatsapp' | 'telegram' | 'email') {
    const message = gerarExtrato()
    const encodedMessage = encodeURIComponent(message)
    const subject = encodeURIComponent('MegaBolao - ' + (round?.nome || 'Rodada'))

    if (channel === 'whatsapp') window.open('https://wa.me/?text=' + encodedMessage, '_blank')
    if (channel === 'telegram') window.open('https://t.me/share/url?url=&text=' + encodedMessage, '_blank')
    if (channel === 'email') window.open('mailto:?subject=' + subject + '&body=' + encodedMessage, '_blank')
  }

  const totalPago = entries.filter(e => e.payment_status === 'paid').length
  const totalPendente = entries.filter(e => e.payment_status === 'pending').length
  const valorRodada = Number(round?.ticket_price || 50)
  const receitaTotal = totalPago * valorRodada
  const encerrada = round?.status === 'finished'
  const paidEntries = entries.filter(e => e.payment_status === 'paid')
  const vencedores = paidEntries.filter(e => (e.total_hits || 0) >= 10)
  const naoVencedores = paidEntries.filter(e => (e.total_hits || 0) < 10)
  const menorPts = naoVencedores.length > 0 ? Math.min(...naoVencedores.map(e => e.total_hits || 0)) : -1
  const maiorPtsNV = naoVencedores.length > 0 ? Math.max(...naoVencedores.map(e => e.total_hits || 0)) : -1
  const segundos = naoVencedores.filter(e => (e.total_hits || 0) === maiorPtsNV)
  const lanternas = naoVencedores.filter(e => (e.total_hits || 0) === menorPts && !segundos.find((s: any) => s.id === e.id))

  const premioFirst10 = receitaTotal * prizeRules.first10 / 100
  const premioFirstDraw = receitaTotal * prizeRules.firstDraw / 100
  const premioSecond = receitaTotal * prizeRules.second / 100
  const premioLast = receitaTotal * prizeRules.last / 100
  const totalPercentual = prizeRules.first10 + prizeRules.firstDraw + prizeRules.second + prizeRules.last + prizeRules.admin

  function getPrizeLabels(entry: any) {
    const labels: string[] = []
    const hits = entry.total_hits || 0
    const isVencedor = hits >= 10
    const isSegundo = encerrada && !!segundos.find((e: any) => e.id === entry.id)
    const isLanterna = encerrada && !!lanternas.find((e: any) => e.id === entry.id)
    const isPrimeiro = firstDrawWinnerIds.includes(entry.id)

    if (isVencedor) labels.push('🏆 Vencedor')
    if (isPrimeiro) labels.push('⚡ 1° sorteio')
    if (isSegundo && !isVencedor) labels.push('🥈 2° lugar')
    if (isLanterna) labels.push('🔦 Lanterna')

    return labels
  }

  function getPrizeItems(entry: any) {
    const items: { label: string; value: number }[] = []
    const hits = entry.total_hits || 0
    const isVencedor = hits >= 10
    const isSegundo = encerrada && !!segundos.find((e: any) => e.id === entry.id)
    const isLanterna = encerrada && !!lanternas.find((e: any) => e.id === entry.id)
    const isPrimeiro = firstDrawWinnerIds.includes(entry.id)

    if (isVencedor) items.push({ label: '🏆 Vencedor', value: premioFirst10 / Math.max(vencedores.length, 1) })
    if (isPrimeiro) items.push({ label: '⚡ 1° sorteio', value: premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1) })
    if (isSegundo && !isVencedor) items.push({ label: '🥈 2° lugar', value: premioSecond / Math.max(segundos.length, 1) })
    if (isLanterna) items.push({ label: '🔦 Lanterna', value: premioLast / Math.max(lanternas.length, 1) })

    return items
  }

  const participantGroups = Object.values(
    entries.reduce((acc: Record<string, any>, entry: any) => {
      const userId = entry.user_id || entry.users?.nome || entry.id
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          user: entry.users,
          entries: [],
        }
      }
      acc[userId].entries.push(entry)
      return acc
    }, {})
  ).map((group: any) => {
    const paid = group.entries.filter((entry: any) => entry.payment_status === 'paid')
    const pending = group.entries.filter((entry: any) => entry.payment_status === 'pending')
    const awarded = group.entries.filter((entry: any) => getPrizeLabels(entry).length > 0)
    const paidPrize = awarded.filter((entry: any) => entry.prize_status === 'paid')
    const prizeTotal = awarded.reduce((total: number, entry: any) => (
      total + getPrizeItems(entry).reduce((entryTotal, item) => entryTotal + item.value, 0)
    ), 0)

    return {
      ...group,
      paidCount: paid.length,
      pendingCount: pending.length,
      awardedCount: awarded.length,
      paidPrizeCount: paidPrize.length,
      prizeTotal,
      bestHits: paid.length > 0 ? Math.max(...paid.map((entry: any) => entry.total_hits || 0)) : 0,
    }
  }).sort((a: any, b: any) =>
    (b.pendingCount - a.pendingCount) ||
    (b.awardedCount - a.awardedCount) ||
    (b.prizeTotal - a.prizeTotal) ||
    (b.bestHits - a.bestHits) ||
    String(a.user?.nome || '').localeCompare(String(b.user?.nome || ''))
  )
  const pendingPrizeCount = entries.filter((entry: any) =>
    getPrizeLabels(entry).length > 0 && entry.prize_status !== 'paid'
  ).length
  const participantsPerPage = 10
  const normalizedParticipantSearch = participantSearch.trim().toLowerCase()
  const filteredParticipantGroups = participantGroups.filter((group: any) => {
    const searchable = [
      group.user?.nome,
      group.user?.telefone,
      group.user?.pix_key,
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(normalizedParticipantSearch)
  })
  const totalParticipantsPages = Math.max(1, Math.ceil(filteredParticipantGroups.length / participantsPerPage))
  const safeParticipantsPage = Math.min(participantsPage, totalParticipantsPages)
  const paginatedParticipantGroups = filteredParticipantGroups.slice((safeParticipantsPage - 1) * participantsPerPage, safeParticipantsPage * participantsPerPage)
  const usersPerPage = 10
  const normalizedUserSearch = userSearch.trim().toLowerCase()
  const filteredUsers = registeredUsers.filter((registeredUser: any) => {
    const searchable = [
      registeredUser.nome,
      registeredUser.email,
      registeredUser.telefone,
      registeredUser.pix_key,
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(normalizedUserSearch)
  })
  const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage))
  const safeUsersPage = Math.min(usersPage, totalUsersPages)
  const paginatedUsers = filteredUsers.slice((safeUsersPage - 1) * usersPerPage, safeUsersPage * usersPerPage)

  const tabs = [
    { id: 'painel', label: 'Painel', shortLabel: 'Painel', Icon: BarChart3 },
    { id: 'ranking', label: 'Ranking', shortLabel: 'Ranking', Icon: Trophy },
    { id: 'participantes', label: 'Participantes', shortLabel: 'Pagos', Icon: TicketCheck },
    { id: 'sorteios', label: 'Sorteios', shortLabel: 'Sorteios', Icon: ClipboardList },
    { id: 'premiacao', label: 'Rodada', shortLabel: 'Rodada', Icon: Settings },
    { id: 'usuarios', label: 'Usuarios', shortLabel: 'Usuarios', Icon: Users },
  ]

  const RoundSelector = () => (
    allRounds.length > 1 ? (
      <select value={selectedRoundId} onChange={e => handleRoundChange(e.target.value)}
        className="max-w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        {allRounds.map((r: any) => (
          <option key={r.id} value={r.id}>
            {r.nome} {r.status === 'finished' ? '(encerrada)' : r.status === 'open' ? '(ativa)' : '(fechada)'}
          </option>
        ))}
      </select>
    ) : null
  )

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Verificando acesso...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white sticky top-0 z-40 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin" className="flex shrink-0 items-center" aria-label="MegaBolão Admin">
              <img src="/logo.png" alt="MegaBolão" className="h-9 w-auto max-w-[160px] object-contain sm:h-10 sm:max-w-[180px]" />
            </a>
            <span className="text-xs bg-yellow-400 text-gray-900 font-bold px-2 py-0.5 rounded-full">ADMIN</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/perfil" aria-label="Perfil" title="Perfil" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20">
              <UserRound size={17} strokeWidth={2.4} aria-hidden="true" />
            </a>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition">Sair</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 pb-28 md:pb-6">
        <div className="hidden md:flex gap-2 mb-6 border-b border-gray-200 pb-4">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={'px-4 py-2 rounded-xl text-sm font-semibold transition ' + (tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}>
              {t.label}
            </button>
          ))}
        </div>

        <nav className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="grid grid-cols-6 gap-1">
            {tabs.map(t => {
              const Icon = t.Icon
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as Tab)}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} strokeWidth={2.4} aria-hidden="true" />
                  <span className="leading-none">{t.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {tab === 'painel' && (
          <div>
            {encerrada && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-5 mb-6">
                <div className="font-bold text-yellow-800 text-lg mb-1">🏆 Temos vencedores! Rodada Encerrada!</div>
                <p className="text-yellow-700 text-sm">Acesse a aba <strong>Rodada</strong> para iniciar uma nova rodada.</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-gray-700">Rodada: <span className="text-blue-600">{round?.nome}</span></div>
              <RoundSelector />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Pagas</div>
                <div className="text-3xl font-black text-blue-600">{totalPago}</div>
              </div>
              <button onClick={() => setTab('participantes')} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left transition hover:border-yellow-300 hover:bg-yellow-50">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Pendentes</div>
                <div className="text-3xl font-black text-yellow-500">{totalPendente}</div>
              </button>
              <button onClick={() => setTab('participantes')} className="bg-white rounded-2xl border border-yellow-200 shadow-sm p-5 text-left transition hover:bg-yellow-50">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Premiacao pendente</div>
                <div className="text-3xl font-black text-yellow-600">{pendingPrizeCount}</div>
              </button>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Receita confirmada</div>
                <div className="text-3xl font-black text-green-600">R${receitaTotal}</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Sorteios</div>
                <div className="text-3xl font-black text-gray-700">{draws.length}</div>
              </div>
            </div>
            {encerrada && vencedores.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-4 mb-6">
                <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">🏆 Resultado Final</div>
                <div className="space-y-2">
	                  <div>
	                    <div className="font-bold text-yellow-900">🏆 {vencedores.map((entry: any) => entry.users?.nome).join(', ')}</div>
	                    <div className="text-xs text-yellow-700">
	                      Vencedor · R${(premioFirst10 / Math.max(vencedores.length, 1)).toFixed(2)}{vencedores.length > 1 ? ' cada' : ''}
	                    </div>
	                  </div>
	                  {firstDrawWinners.length > 0 && (
	                    <div>
	                      <div className="font-bold text-yellow-900">⚡ {firstDrawWinners.join(' e ')}</div>
	                      <div className="text-xs text-yellow-700">
	                        Mais acertos 1° sorteio · R${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}{firstDrawWinnerIds.length > 1 ? ' cada' : ''}
	                      </div>
	                    </div>
	                  )}
	                  {segundos.length > 0 && (
                    <div>
                      <div className="font-bold text-yellow-900">🥈 {segundos.map((entry: any) => entry.users?.nome).join(', ')}</div>
                      <div className="text-xs text-yellow-700">
                        2° lugar · R${(premioSecond / Math.max(segundos.length, 1)).toFixed(2)}{segundos.length > 1 ? ' cada' : ''}
                      </div>
                    </div>
                  )}
                  {lanternas.length > 0 && (
                    <div>
                      <div className="font-bold text-yellow-900">🔦 {lanternas.map((entry: any) => entry.users?.nome).join(', ')}</div>
                      <div className="text-xs text-yellow-700">
                        Lanterna · R${(premioLast / Math.max(lanternas.length, 1)).toFixed(2)}{lanternas.length > 1 ? ' cada' : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!encerrada && draws.length === 1 && firstDrawWinners.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">⚡ Premio 1° Sorteio</div>
                <div className="font-bold text-blue-800">{firstDrawWinners.join(' e ')}</div>
                <div className="text-xs text-blue-600 mt-1">R${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}{firstDrawWinnerIds.length > 1 ? ' cada' : ''}</div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Status</div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-gray-800">{round?.nome}</span>
                <span className={'text-xs font-bold px-3 py-1 rounded-full ' + (round?.status === 'open' ? 'bg-green-100 text-green-700' : round?.status === 'finished' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600')}>
                  {round?.status === 'open' ? 'Aberta' : round?.status === 'finished' ? 'Encerrada' : round?.status === 'closed' ? 'Fechada' : 'Rascunho'}
                </span>
                <div className="flex gap-2 ml-auto flex-wrap">
                  {round?.status !== 'open' && round?.status !== 'finished' && (
                    <button onClick={() => alterarStatusRodada('open')} className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-green-200 transition">Abrir rodada</button>
                  )}
                  {round?.status === 'open' && (
                    <button onClick={() => alterarStatusRodada('closed')} className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-yellow-200 transition">Fechar palpites</button>
                  )}
                  {round?.status !== 'finished' && (
                    <button onClick={() => alterarStatusRodada('finished')} className="text-xs bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-200 transition">Encerrar rodada</button>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Mensagem para compartilhar</div>
              <textarea readOnly value={gerarExtrato()} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-700 h-48 resize-none" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => shareMessage('whatsapp')} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">WhatsApp</button>
                <button onClick={() => shareMessage('telegram')} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">Telegram</button>
                <button onClick={() => shareMessage('email')} className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">Email</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'ranking' && (
          <div>
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-gray-700">{round?.nome}</div>
                <div className="text-xs text-gray-400">{allDrawnNumbers.length} numeros sorteados · {paidEntries.length} participantes</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <RoundSelector />
                <button
                  onClick={() => {
                    const dataHoje = new Date().toLocaleDateString('pt-BR')
                    const logoUrl = `${window.location.origin}/logo.png`
                    const naoVencedoresLocal = paidEntries.filter((e: any) => (e.total_hits || 0) < 10)
                    const menorPtsLocal = naoVencedoresLocal.length > 0 ? Math.min(...naoVencedoresLocal.map((e: any) => e.total_hits || 0)) : -1
                    const maiorPtsNVLocal = naoVencedoresLocal.length > 0 ? Math.max(...naoVencedoresLocal.map((e: any) => e.total_hits || 0)) : -1
                    const segundosLocal = naoVencedoresLocal.filter((e: any) => (e.total_hits || 0) === maiorPtsNVLocal)
                    const lanternasLocal = naoVencedoresLocal.filter((e: any) => (e.total_hits || 0) === menorPtsLocal && !segundosLocal.find((s: any) => s.id === e.id))

                    const linhasRanking = paidEntries.map((entry: any, index: number) => {
                      const hits = entry.total_hits || 0
                      const isVencedor = hits >= 10
                      const isSegundo = !!segundosLocal.find((e: any) => e.id === entry.id)
                      const isLanterna = !!lanternasLocal.find((e: any) => e.id === entry.id)
                      const isPrimeiro = firstDrawWinnerIds.includes(entry.id)
                      // Numeros com destaque nos acertados
                      const numStr = entry.numbers.map((n: number) => {
                        const isHit = allDrawnNumbers.includes(n)
                        const num = String(n).padStart(2, '0')
                        return isHit
                          ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:#22c55e;color:white;border-radius:50%;font-weight:700;font-size:10px;margin:1px">${num}</span>`
                          : `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:#9ca3af;font-size:10px;margin:1px">${num}</span>`
                      }).join('')
                      const badges = [
                        isVencedor ? '🏆 Vencedor' : '',
                        isPrimeiro ? '⚡ Mais acertos 1° sorteio' : '',
                        encerrada && isSegundo && !isVencedor ? '🥈 2° lugar' : '',
                        encerrada && isLanterna ? '🔦 Lanterna' : '',
                      ].filter(Boolean).join(' · ')
                      const bgColor = isVencedor ? '#fffbeb' : isSegundo ? '#eff6ff' : isLanterna ? '#fef2f2' : index % 2 === 0 ? '#f9fafb' : '#ffffff'
                      return `
                        <tr style="background:${bgColor}">
                          <td style="padding:5px 8px;font-weight:700;color:#6b7280;text-align:center;font-size:11px">${isVencedor ? '🏆' : index + 1}</td>
                          <td style="padding:5px 8px">
                            <div style="font-weight:700;color:#111827;font-size:11px">${entry.users?.nome}</div>
                            ${badges ? `<div style="font-size:9px;color:#6b7280;margin-top:1px">${badges}</div>` : ''}
                          </td>
                          <td style="padding:5px 8px;font-family:monospace;font-size:10px;letter-spacing:0px">${numStr}</td>
                          <td style="padding:5px 8px;text-align:center;font-weight:900;font-size:16px;color:${isVencedor ? '#f59e0b' : '#2563eb'}">${hits}</td>
                        </tr>
                      `
                    }).join('')

                    // Bloco de vencedores para aparecer ANTES do ranking
                    const vencedoresHTML = encerrada ? `
                      <div style="margin-bottom:16px;padding:10px 14px;background:#fffbeb;border:2px solid #fcd34d;border-radius:10px">
                        <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:#92400e">🎉 Resultado Final</div>
                        ${vencedores.length > 0 ? `<div style="font-size:11px;color:#78350f;margin-bottom:4px;padding:5px 8px;background:rgba(255,255,255,0.6);border-radius:6px">🏆 <b>Vencedor(es):</b> ${vencedores.map((e: any) => e.users?.nome).join(', ')} — R$${(premioFirst10 / Math.max(vencedores.length, 1)).toFixed(2)}</div>` : ''}
                        ${firstDrawWinners.length > 0 ? `<div style="font-size:11px;color:#78350f;margin-bottom:4px;padding:5px 8px;background:rgba(255,255,255,0.6);border-radius:6px">⚡ <b>1° sorteio:</b> ${firstDrawWinners.join(' e ')} — R$${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}${firstDrawWinnerIds.length > 1 ? ' cada' : ''}</div>` : ''}
                        ${segundosLocal.length > 0 ? `<div style="font-size:11px;color:#78350f;margin-bottom:4px;padding:5px 8px;background:rgba(255,255,255,0.6);border-radius:6px">🥈 <b>2° lugar:</b> ${segundosLocal.map((e: any) => e.users?.nome).join(', ')} (${maiorPtsNVLocal} pts) — R$${(premioSecond / Math.max(segundosLocal.length, 1)).toFixed(2)}${segundosLocal.length > 1 ? ' cada' : ''}</div>` : ''}
                        ${lanternasLocal.length > 0 ? `<div style="font-size:11px;color:#78350f;padding:5px 8px;background:rgba(255,255,255,0.6);border-radius:6px">🔦 <b>Lanterna:</b> ${lanternasLocal.map((e: any) => e.users?.nome).join(', ')} (${menorPtsLocal} pts) — R$${(premioLast / Math.max(lanternasLocal.length, 1)).toFixed(2)}${lanternasLocal.length > 1 ? ' cada' : ''}</div>` : ''}
                      </div>
                    ` : firstDrawWinners.length > 0 ? `
                      <div style="margin-bottom:14px;padding:8px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px">
                        <div style="font-size:11px;color:#1e40af">⚡ <b>Mais acertos no 1° sorteio:</b> ${firstDrawWinners.join(' e ')} — R$${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}${firstDrawWinnerIds.length > 1 ? ' cada' : ''}</div>
                      </div>
                    ` : ''

                    const html = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta charset="UTF-8">
                        <title>Ranking - ${round?.nome}</title>
                        <style>
                          * { margin:0; padding:0; box-sizing:border-box; }
                          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
                          @media print { body { padding: 12px; } }
                          table { width:100%; border-collapse:collapse; }
                          th { background:#1e3a8a; color:white; padding:7px 8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:1px; }
                          th:last-child, td:last-child { text-align:center; }
                          tr:last-child td { border-bottom:none; }
                          td { border-bottom:1px solid #e5e7eb; }
                        </style>
                      </head>
                      <body>
                        <div style="margin-bottom:14px">
                          <div style="display:flex;justify-content:center;align-items:center;background:#2563eb;border-radius:14px;padding:14px 18px;margin-bottom:10px">
                            <img src="${logoUrl}" alt="MegaBolao" style="display:block;width:180px;height:auto" />
                          </div>
                          <div style="font-size:15px;font-weight:700;margin-top:2px">${round?.nome}</div>
                          <div style="font-size:10px;color:#6b7280;margin-top:2px">
                            ${allDrawnNumbers.length} numeros sorteados · ${paidEntries.length} participantes · Gerado em ${dataHoje}
                          </div>
                        </div>
                        ${vencedoresHTML}
                        <table>
                          <thead>
                            <tr>
                              <th style="width:36px">#</th>
                              <th>Participante</th>
                              <th>Numeros (verde = acertado)</th>
                              <th style="width:60px">Acertos</th>
                            </tr>
                          </thead>
                          <tbody>${linhasRanking}</tbody>
                        </table>
                        <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center">
                          MegaBolao · ${dataHoje}
                        </div>
                      </body>
                      </html>
                    `
                    const w = window.open('', '_blank')
                    if (w) {
                      w.document.write(html)
                      w.document.close()
                      setTimeout(() => w.print(), 500)
                    }
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  📄 Gerar PDF
                </button>
              </div>
            </div>
            {firstDrawWinners.length > 0 && !encerrada && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">⚡ Mais acertos no 1° sorteio</div>
                <div className="font-bold text-blue-800">{firstDrawWinners.join(' e ')} — R${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}{firstDrawWinnerIds.length > 1 ? ' cada' : ''}</div>
              </div>
            )}
            {encerrada && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-4 mb-4">
                <div className="font-bold text-yellow-800 mb-2">🎉 Resultado Final</div>
                <div className="space-y-1.5">
                  {vencedores.length > 0 && <div className="flex justify-between text-sm text-yellow-700"><span>🏆 <strong>Vencedor(es):</strong> {vencedores.map((e: any) => e.users?.nome).join(', ')}</span><span className="font-bold">R${(premioFirst10 / Math.max(vencedores.length, 1)).toFixed(2)}</span></div>}
                  {firstDrawWinners.length > 0 && <div className="flex justify-between text-sm text-yellow-700"><span>⚡ <strong>1° sorteio:</strong> {firstDrawWinners.join(' e ')}</span><span className="font-bold">R${(premioFirstDraw / Math.max(firstDrawWinnerIds.length, 1)).toFixed(2)}{firstDrawWinnerIds.length > 1 ? ' cada' : ''}</span></div>}
                  {segundos.length > 0 && <div className="flex justify-between text-sm text-yellow-700"><span>🥈 <strong>2° lugar:</strong> {segundos.map((e: any) => e.users?.nome).join(', ')} ({maiorPtsNV} pts)</span><span className="font-bold">R${(premioSecond / Math.max(segundos.length, 1)).toFixed(2)}{segundos.length > 1 ? ' cada' : ''}</span></div>}
                  {lanternas.length > 0 && <div className="flex justify-between text-sm text-yellow-700"><span>🔦 <strong>Lanterna:</strong> {lanternas.map((e: any) => e.users?.nome).join(', ')} ({menorPts} pts)</span><span className="font-bold">R${(premioLast / Math.max(lanternas.length, 1)).toFixed(2)}{lanternas.length > 1 ? ' cada' : ''}</span></div>}
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between">
                <div className="text-sm font-bold text-gray-700">{paidEntries.length} participacoes pagas</div>
                <div className="text-xs text-gray-400">{allDrawnNumbers.length} numeros sorteados</div>
              </div>
              {paidEntries.length === 0 && <div className="p-12 text-center text-gray-400 text-sm">Nenhuma participacao paga</div>}
              {paidEntries.map((entry, index) => {
                const hits = entry.total_hits || 0
                const isVencedor = hits >= 10
                const isSegundo = !!segundos.find((e: any) => e.id === entry.id)
                const isLanterna = !!lanternas.find((e: any) => e.id === entry.id)
                const isPrimeiro = firstDrawWinnerIds.includes(entry.id)
                const statusColor = isVencedor ? 'text-yellow-500' : isSegundo ? 'text-blue-600' : isLanterna ? 'text-red-400' : 'text-blue-600'
                return (
                  <div key={entry.id} className={'px-3 py-2.5 border-b border-gray-50 last:border-0 sm:flex sm:items-center sm:gap-3 sm:px-4 sm:py-3 ' + (isVencedor ? 'bg-yellow-50 sm:border-l-4 sm:border-yellow-400' : isSegundo ? 'bg-blue-50 sm:border-l-4 sm:border-blue-300' : isLanterna ? 'bg-red-50 sm:border-l-4 sm:border-red-300' : '')}>
                    <div className="flex items-center gap-2 sm:contents">
                      <div className="w-7 shrink-0 text-center text-xs font-black text-gray-400 sm:w-8 sm:text-sm">{isVencedor ? '🏆' : (index + 1) + '°'}</div>
                      <div className="min-w-0 flex-1 sm:w-40 sm:shrink-0 sm:flex-none">
                        <div className="truncate text-sm font-bold text-gray-800">{entry.users?.nome}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {isVencedor && <span className="rounded-full bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-gray-900 sm:text-xs">🏆 Vencedor</span>}
                          {isPrimeiro && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-blue-700 sm:text-xs">⚡ 1° sorteio</span>}
                          {encerrada && isSegundo && !isVencedor && <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-indigo-700 sm:text-xs">🥈 2° lugar</span>}
                          {encerrada && isLanterna && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-red-600 sm:text-xs">🔦 Lanterna</span>}
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
                        return <span key={n} className={'flex h-5 w-5 shrink-0 items-center justify-center justify-self-center rounded-full font-mono text-[10px] font-bold sm:h-7 sm:w-7 sm:text-xs ' + (isHit ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400')}>{String(n).padStart(2, '0')}</span>
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
          </div>
        )}

        {tab === 'participantes' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm font-bold text-gray-700">{entries.length} participacoes — {totalPago} pagas · {totalPendente} pendentes</div>
                <div className="text-xs text-gray-400">{filteredParticipantGroups.length} participante(s)</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full sm:w-72">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Pesquisar</label>
                  <input
                    value={participantSearch}
                    onChange={(e) => { setParticipantSearch(e.target.value); setParticipantsPage(1); setExpandedParticipantId(null) }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Nome, telefone ou PIX"
                  />
                </div>
                <RoundSelector />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-500">{round?.nome}</div>
                {round?.status !== 'finished' && (
                  <button onClick={async () => {
                    const manualPaymentIds = Array.from(new Set(
                      entries
                        .filter((entry: any) => entry.payment_status === 'pending' && entry.payment_id && (entry.payments?.method || 'manual') === 'manual')
                        .map((entry: any) => entry.payment_id)
                    ))

                    const legacyEntryIds = entries
                      .filter((entry: any) => entry.payment_status === 'pending' && !entry.payment_id)
                      .map((entry: any) => entry.id)

                    if (manualPaymentIds.length > 0) {
                      await supabase
                        .from('payments')
                        .update({ status: 'paid', paid_at: new Date().toISOString(), cancelled_at: null, updated_at: new Date().toISOString() })
                        .in('id', manualPaymentIds)

                      await supabase
                        .from('entries')
                        .update({ payment_status: 'paid' })
                        .in('payment_id', manualPaymentIds)
                        .eq('payment_status', 'pending')
                    }

                    if (legacyEntryIds.length > 0) {
                      await supabase
                        .from('entries')
                        .update({ payment_status: 'paid' })
                        .in('id', legacyEntryIds)
                    }

                    await loadRoundData(selectedRoundId)
                  }}
                    className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-green-200 transition">Aprovar pendentes manuais</button>
                )}
              </div>
              {filteredParticipantGroups.length === 0 && <div className="p-12 text-center text-gray-400 text-sm">Nenhum participante encontrado</div>}
              <div className="divide-y divide-gray-50">
                {paginatedParticipantGroups.map((group: any) => {
                  const isOpen = expandedParticipantId === group.userId
                  const pixKey = group.user?.pix_key || ''

                  return (
                    <div key={group.userId}>
                      <button
                        onClick={() => setExpandedParticipantId(isOpen ? null : group.userId)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-800 text-sm">{group.user?.nome || 'Usuario'}</span>
                            {group.pendingCount > 0 && (
                              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">Pendente</span>
                            )}
                            {group.awardedCount > 0 && (
                              <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-gray-900">🏅 Premiado</span>
                            )}
                            {group.awardedCount > 0 && group.paidPrizeCount < group.awardedCount && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Pendente premiação</span>
                            )}
                            {group.awardedCount > 0 && group.paidPrizeCount === group.awardedCount && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Prêmio pago</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {group.entries.length} participacao(es) · {group.paidCount} pagas · {group.pendingCount} pendentes · melhor: {group.bestHits}
                          </div>
                          {pixKey && <div className="text-xs text-gray-400 mt-0.5">PIX: {pixKey}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {group.awardedCount > 0 && (
                            <span className="rounded-lg bg-yellow-50 px-3 py-1.5 text-xs font-black text-yellow-700">
                              R${group.prizeTotal.toFixed(2)}
                            </span>
                          )}
                          {pixKey && group.awardedCount > 0 && (
                            <span
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(pixKey) }}
                              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600"
                            >
                              Copiar PIX
                            </span>
                          )}
                          <span className="text-gray-400 text-lg">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50 bg-gray-50/40">
                          {[...group.entries].sort((a: any, b: any) => {
                            const cancelledOrder = Number(a.payment_status === 'cancelled') - Number(b.payment_status === 'cancelled')
                            if (cancelledOrder !== 0) return cancelledOrder
                            const pendingOrder = Number(b.payment_status === 'pending') - Number(a.payment_status === 'pending')
                            if (pendingOrder !== 0) return pendingOrder
                            const prizeOrder = getPrizeLabels(b).length - getPrizeLabels(a).length
                            if (prizeOrder !== 0) return prizeOrder
                            return (b.total_hits || 0) - (a.total_hits || 0)
                          }).map((entry: any, index: number) => {
                            const isCancelled = entry.payment_status === 'cancelled'
                            const displayedHits = isCancelled ? 0 : entry.total_hits || 0
                            const prizeItems = getPrizeItems(entry)
                            const isAwarded = prizeItems.length > 0
                            const prizePaid = entry.prize_status === 'paid'
                            const entryPrizeTotal = prizeItems.reduce((total, item) => total + item.value, 0)
                            const paymentMethod = entry.payments?.method || 'manual'
                            const isOnlinePix = paymentMethod === 'mercado_pago_pix'

                            return (
                              <div key={entry.id} className={'p-4 flex flex-col gap-3 sm:flex-row sm:items-center ' + (isAwarded ? 'bg-yellow-50/80 border-l-4 border-yellow-400' : '')}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="font-semibold text-gray-800 text-sm">Participacao #{group.entries.length - index}</span>
                                    <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + (entry.payment_status === 'paid' ? 'bg-green-100 text-green-700' : entry.payment_status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700')}>
                                      {entry.payment_status === 'paid' ? 'Pago' : entry.payment_status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                                    </span>
                                    <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + (isOnlinePix ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                                      {isOnlinePix ? 'Pix online' : 'Manual'}
                                    </span>
                                    {isAwarded && (
                                      <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + (prizePaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                                        {prizePaid ? 'Prêmio pago' : 'Aguardando premiação'}
                                      </span>
                                    )}
                                  </div>
                                  {isOnlinePix && entry.payment_status === 'pending' && (
                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-blue-700">
                                      {entry.payments?.expires_at && (
                                        <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold border border-blue-100">
                                          Expira em {new Date(entry.payments.expires_at).toLocaleString('pt-BR')}
                                        </span>
                                      )}
                                      {entry.payments?.ticket_url && (
                                        <a
                                          href={entry.payments.ticket_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="rounded-full bg-white px-2 py-1 font-semibold border border-blue-200 hover:bg-blue-50 transition"
                                        >
                                          Abrir QR
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {isAwarded && (
                                    <div className="mb-2 flex flex-wrap gap-1">
                                      {prizeItems.map((item) => (
                                        <span key={item.label} className="rounded-full bg-white px-2 py-1 text-xs font-bold text-yellow-700 border border-yellow-200">
                                          {item.label} · R${item.value.toFixed(2)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-1">
                                    {entry.numbers.map((n: number) => {
                                      const isHit = !isCancelled && allDrawnNumbers.includes(n)
                                      return <span key={n} className={'w-7 h-7 rounded-full text-xs font-bold font-mono flex items-center justify-center ' + (isHit ? 'bg-green-500 text-white' : isCancelled ? 'bg-gray-50 text-gray-300 border border-gray-200' : 'bg-gray-100 text-gray-500')}>{String(n).padStart(2, '0')}</span>
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 shrink-0 sm:justify-end">
                                  <div className="text-right">
                                    {isAwarded && (
                                      <div className="text-sm font-black text-yellow-600">R${entryPrizeTotal.toFixed(2)}</div>
                                    )}
                                    <div className={'text-2xl font-black ' + (isCancelled ? 'text-gray-300' : 'text-blue-600')}>{displayedHits}</div>
                                    <div className="text-xs text-gray-400">acertos</div>
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-1">
                                    {entry.payment_status === 'pending' && round?.status !== 'finished' && !isOnlinePix && (
                                      <>
                                        <button onClick={() => aprovarPagamento(entry)} className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-green-200 transition">Aprovar</button>
                                        <button onClick={() => cancelarPagamento(entry)} className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-1.5 rounded-lg hover:bg-red-200 transition">Cancelar</button>
                                      </>
                                    )}
                                  {isAwarded && !prizePaid && (
                                      <button onClick={() => marcarPremioPago(entry.id)} className="text-xs bg-yellow-400 text-gray-900 font-bold px-2 py-1.5 rounded-lg hover:bg-yellow-300 transition">Prêmio pago</button>
                                    )}
                                  </div>
                                </div>
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

            {filteredParticipantGroups.length > participantsPerPage && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => { setParticipantsPage(prev => Math.max(1, prev - 1)); setExpandedParticipantId(null) }}
                  disabled={safeParticipantsPage === 1}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  Anterior
                </button>
                <div className="text-xs font-semibold text-gray-500">
                  Pagina {safeParticipantsPage} de {totalParticipantsPages}
                </div>
                <button
                  onClick={() => { setParticipantsPage(prev => Math.min(totalParticipantsPages, prev + 1)); setExpandedParticipantId(null) }}
                  disabled={safeParticipantsPage === totalParticipantsPages}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  Proxima
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'sorteios' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-gray-700">Sorteios — {round?.nome}</div>
              <RoundSelector />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Registrar novo sorteio</div>
                {encerrada ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">Temos vencedor! Rodada encerrada. Inicie uma nova rodada na aba Rodada.</div>
                ) : (
                  <div className="space-y-3">
                    {draws.length === 0 && <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">Este sera o <strong>1° sorteio</strong> desta rodada — definira o premio de mais acertos!</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => buscarResultadoMegaSena(false)}
                        disabled={buscandoResultado || salvandoSorteio}
                        className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                      >
                        {buscandoResultado ? 'Buscando...' : 'Buscar para conferir'}
                      </button>
                      <button
                        type="button"
                        onClick={() => buscarResultadoMegaSena(true)}
                        disabled={buscandoResultado || salvandoSorteio}
                        className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {buscandoResultado || salvandoSorteio ? 'Processando...' : 'Buscar e registrar'}
                      </button>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                      A busca preenche os campos abaixo usando a API Loterias CAIXA. Confira o concurso e os numeros antes de registrar.
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Numero do Concurso</label>
                      <input value={concurso} onChange={e => setConcurso(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 2705" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Data do sorteio</label>
                      <input type="date" value={dataSorteio} onChange={e => setDataSorteio(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">6 numeros sorteados</label>
                      <input value={numerosSorteio} onChange={e => setNumerosSorteio(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 04, 09, 14, 26, 33, 58" />
                    </div>
                    {msgSorteio && <div className={'text-sm rounded-xl px-4 py-3 ' + (/erro|anterior|ja esta|expirou|informe/i.test(msgSorteio) ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200')}>{msgSorteio}</div>}
                    <button onClick={salvarSorteio} disabled={salvandoSorteio} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50">
                      {salvandoSorteio ? 'Calculando...' : 'Registrar e Calcular Acertos'}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Sorteios registrados</div>
                {draws.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">Nenhum sorteio ainda</div>}
                <div className="space-y-3">
                  {draws.map(d => (
                    <div key={d.id} className={'bg-white rounded-2xl border shadow-sm p-4 ' + (d.is_first ? 'border-blue-200 bg-blue-50' : 'border-gray-100')}>
                      <div className="flex justify-between text-xs mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-700">Concurso {d.contest_number}</span>
                          {d.is_first && <span className="bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">1° Sorteio</span>}
                        </div>
                        <span className="text-gray-400">{new Date(d.draw_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {d.numbers.map((n: number) => (
                          <span key={n} className="w-9 h-9 rounded-full bg-yellow-400 text-gray-900 text-sm font-black font-mono flex items-center justify-center shadow-sm">{String(n).padStart(2, '0')}</span>
                        ))}
                      </div>
                      {d.is_first && firstDrawWinners.length > 0 && (
                        <div className="mt-2 text-xs text-blue-700 font-semibold">⚡ Mais acertos: {firstDrawWinners.join(' e ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'premiacao' && (
          <div className="space-y-6">
            {encerrada && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <div className="font-bold text-green-800 text-base mb-1">🚀 Iniciar Nova Rodada</div>
                <p className="text-green-700 text-sm mb-4">Rodada atual encerrada.</p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Nome</label>
                    <input value={novaRodadaNome} onChange={e => setNovaRodadaNome(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: Bolao Junho 2025" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Valor</label>
                    <input type="number" min="1" step="0.01" value={novaRodadaValor} onChange={e => setNovaRodadaValor(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="50.00" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Abertura</label>
                    <input type="date" value={novaRodadaInicio} onChange={e => setNovaRodadaInicio(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Encerramento</label>
                    <input type="date" value={novaRodadaFim} onChange={e => setNovaRodadaFim(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Horario</label>
                    <input type="time" value={novaRodadaFimHora} onChange={e => setNovaRodadaFimHora(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
                {msgNovaRodada && <div className={'text-sm rounded-xl px-4 py-3 mb-3 ' + (msgNovaRodada.includes('sucesso') ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-50 text-red-600 border border-red-200')}>{msgNovaRodada}</div>}
                <button onClick={criarNovaRodada} disabled={criandoRodada} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition disabled:opacity-50">
                  {criandoRodada ? 'Criando...' : '+ Criar e Abrir Nova Rodada'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{round ? 'Editar Rodada' : 'Criar Primeira Rodada'}</div>
                  <RoundSelector />
                </div>
                {!round && (
                  <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Nenhuma rodada cadastrada. Preencha os dados abaixo e clique em criar para iniciar o teste real.
                  </div>
                )}
                <div className="space-y-3">
                  <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Nome</label><input value={nomeRodada} onChange={e => setNomeRodada(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Valor por participacao</label><input type="number" min="1" step="0.01" value={valorParticipacao} onChange={e => setValorParticipacao(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Inicio</label><input type="date" value={inicioRodada} onChange={e => setInicioRodada(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Encerramento dos palpites</label><input type="date" value={fimRodada} onChange={e => setFimRodada(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Horario</label><input type="time" value={fimRodadaHora} onChange={e => setFimRodadaHora(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  <button onClick={salvarRodada} disabled={salvandoRodada} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50">{salvandoRodada ? 'Salvando...' : (round ? 'Salvar alteracoes' : 'Criar rodada')}</button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Configurar Premiacao (%)</div>
                <div className="space-y-3 mb-4">
                  {[
                    { key: 'first10', label: '🏆 1° a fazer 10 pontos' },
                    { key: 'firstDraw', label: '⚡ Mais acertos no 1° sorteio' },
                    { key: 'second', label: '🥈 2° melhor colocado final' },
                    { key: 'last', label: '🔦 Lanterna (menos acertos)' },
                    { key: 'admin', label: '🏢 Taxa administrativa' },
                  ].map(p => (
                    <div key={p.key} className="flex items-center gap-3">
                      <label className="text-sm text-gray-600 flex-1">{p.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0" max="100"
                          value={prizeRules[p.key as keyof typeof prizeRules]}
                          onChange={e => setPrizeRules(prev => ({ ...prev, [p.key]: Number(e.target.value) }))}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-400 text-sm">%</span>
                        <span className="text-xs text-gray-400 w-16 text-right">R${(receitaTotal * prizeRules[p.key as keyof typeof prizeRules] / 100).toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={
                  'flex justify-between text-sm font-bold py-2 border-t ' +
                  (totalPercentual === 100 ? 'text-green-600 border-green-200' : 'text-red-500 border-red-200')
                }>
                  <span>Total</span>
                  <span>{totalPercentual}% {totalPercentual === 100 ? '✓' : '— deve ser 100%'}</span>
                </div>
                {msgPremiacao && <div className={'text-sm rounded-xl px-4 py-3 mt-3 ' + (msgPremiacao.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>{msgPremiacao}</div>}
                <button onClick={salvarPremiacao} disabled={salvandoPremiacao || totalPercentual !== 100}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-40">
                  {salvandoPremiacao ? 'Salvando...' : 'Salvar Premiacao'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'usuarios' && (
          <div>
            <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Cadastrar usuario manualmente</div>
                <div className="text-sm text-gray-500 mt-1">Crie o login do usuario e informe uma senha temporaria para primeiro acesso.</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Nome</label>
                  <input value={novoUsuarioNome} onChange={e => setNovoUsuarioNome(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome completo" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Email</label>
                  <input type="email" value={novoUsuarioEmail} onChange={e => setNovoUsuarioEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="usuario@email.com" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Perfil</label>
                  <select value={novoUsuarioRole} onChange={e => setNovoUsuarioRole(e.target.value === 'admin' ? 'admin' : 'user')} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="user">Usuario</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">WhatsApp</label>
                  <input value={novoUsuarioTelefone} onChange={e => setNovoUsuarioTelefone(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(11) 99999-9999" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Senha temporaria</label>
                  <input type="text" value={novoUsuarioSenha} onChange={e => setNovoUsuarioSenha(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Minimo 6 caracteres" />
                </div>
                <div className="flex items-end">
                  <button onClick={criarUsuarioAdmin} disabled={criandoUsuario} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50">
                    {criandoUsuario ? 'Criando...' : 'Criar usuario'}
                  </button>
                </div>
              </div>
              {msgNovoUsuario && (
                <div className={'mt-4 text-sm rounded-xl px-4 py-3 ' + (msgNovoUsuario.includes('sucesso') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
                  {msgNovoUsuario}
                </div>
              )}
            </div>

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm font-bold text-gray-700">Usuarios cadastrados</div>
                <div className="text-xs text-gray-400">{filteredUsers.length} de {registeredUsers.length} usuario(s)</div>
              </div>
              <div className="w-full md:w-80">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">Pesquisar</label>
                <input
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1); setExpandedUserId(null) }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Nome, email, telefone ou PIX"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-gray-400 text-sm">Nenhum usuario encontrado</div>
              )}

              <div className="divide-y divide-gray-50">
                {paginatedUsers.map((registeredUser: any) => {
                  const isOpen = expandedUserId === registeredUser.id

                  return (
                  <div key={registeredUser.id} className="p-4">
                    <button
                      onClick={() => setExpandedUserId(isOpen ? null : registeredUser.id)}
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-800">{registeredUser.nome || 'Sem nome'}</span>
                          <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + (registeredUser.role === 'admin' ? 'bg-gray-900 text-white' : 'bg-blue-100 text-blue-700')}>
                            {registeredUser.role === 'admin' ? 'Admin' : 'Usuario'}
                          </span>
                          {registeredUser.awardedCount > 0 && (
                            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-gray-900">🏅 {registeredUser.awardedCount} premiada(s)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {registeredUser.entriesCount} participacao(es) · {registeredUser.paidEntriesCount} pagas
                        </div>
                      </div>
                      <span className="text-gray-400 text-lg">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="grid grid-cols-1 gap-2 text-xs text-gray-500 sm:grid-cols-2">
                          <div>Email: <strong className="text-gray-700">{registeredUser.email || 'Nao informado'}</strong></div>
                          <div>Telefone: <strong className="text-gray-700">{registeredUser.telefone || 'Nao informado'}</strong></div>
                          <div className="sm:col-span-2">
                            PIX: <strong className="text-gray-700">{registeredUser.pix_key || 'Nao informado'}</strong>
                            {registeredUser.pix_key && (
                              <button
                                onClick={() => navigator.clipboard.writeText(registeredUser.pix_key)}
                                className="ml-2 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600"
                              >
                                Copiar PIX
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-gray-50 px-3 py-2">
                            <div className="text-lg font-black text-blue-600">{registeredUser.entriesCount}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Participacoes</div>
                          </div>
                          <div className="rounded-xl bg-green-50 px-3 py-2">
                            <div className="text-lg font-black text-green-600">{registeredUser.paidEntriesCount}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Pagas</div>
                          </div>
                          <div className="rounded-xl bg-yellow-50 px-3 py-2">
                            <div className="text-lg font-black text-yellow-600">{registeredUser.awardedCount}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Premiadas</div>
                          </div>
                        </div>

                        {registeredUser.awardedCount > 0 && (
                          <div className="mt-3 text-xs font-semibold text-yellow-700">
                            {registeredUser.prizePaidCount}/{registeredUser.awardedCount} premio(s) pago(s)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </div>

            {filteredUsers.length > usersPerPage && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => { setUsersPage(prev => Math.max(1, prev - 1)); setExpandedUserId(null) }}
                  disabled={safeUsersPage === 1}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  Anterior
                </button>
                <div className="text-xs font-semibold text-gray-500">
                  Pagina {safeUsersPage} de {totalUsersPages}
                </div>
                <button
                  onClick={() => { setUsersPage(prev => Math.min(totalUsersPages, prev + 1)); setExpandedUserId(null) }}
                  disabled={safeUsersPage === totalUsersPages}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  Proxima
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
