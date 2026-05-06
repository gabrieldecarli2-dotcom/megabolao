import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createPixOrder, extractPixData, mapMercadoPagoOrderStatus } from '@/lib/mercado-pago'
import { PaymentMethod } from '@/lib/payment-types'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type RequestBody = {
  roundId?: string
  paymentMethod?: PaymentMethod
  picks?: number[][]
}

function isValidPick(numbers: number[]) {
  if (!Array.isArray(numbers) || numbers.length !== 10) return false
  const unique = new Set(numbers)
  if (unique.size !== 10) return false
  return numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 60)
}

function parseRoundDeadline(round: { end_date?: string | null, end_time?: string | null }) {
  if (!round.end_date) return null
  const time = round.end_time || '23:59:00'
  return new Date(`${round.end_date}T${time}-03:00`)
}

function resolvePixExpirationMinutes(round: { end_date?: string | null, end_time?: string | null }) {
  const configured = Number(process.env.MERCADO_PAGO_PIX_EXPIRATION_MINUTES || 360)
  const deadline = parseRoundDeadline(round)

  if (!deadline) {
    return Math.max(30, Math.min(configured, 43200))
  }

  const remainingMinutes = Math.floor((deadline.getTime() - Date.now()) / 60000)
  const capped = Math.min(configured, remainingMinutes)

  if (capped < 30) {
    return null
  }

  return Math.max(30, Math.min(capped, 43200))
}

function resolvePixPayerEmail(userEmail?: string | null) {
  const forcedTestEmail = process.env.MERCADO_PAGO_TEST_PAYER_EMAIL

  if (forcedTestEmail) {
    return forcedTestEmail
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'test@testuser.com'
  }

  return userEmail || 'test@testuser.com'
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const authUser = await getAuthenticatedUser(request)

    if (!authUser) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    const body = await request.json() as RequestBody
    const paymentMethod = body.paymentMethod || 'manual'
    const picks = Array.isArray(body.picks) ? body.picks : []

    if (!body.roundId || picks.length === 0 || !picks.every(isValidPick)) {
      return NextResponse.json({ error: 'Dados do pagamento invalidos.' }, { status: 400 })
    }

    const [{ data: userProfile }, { data: round }] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, nome, email')
        .eq('id', authUser.id)
        .single(),
      supabaseAdmin
        .from('rounds')
        .select('id, nome, status, ticket_price, end_date, end_time')
        .eq('id', body.roundId)
        .single(),
    ])

    if (!userProfile || !round || round.status !== 'open') {
      return NextResponse.json({ error: 'Rodada indisponivel para pagamento.' }, { status: 400 })
    }

    const pricePerEntry = Number(round.ticket_price || 50)
    const amount = Number((pricePerEntry * picks.length).toFixed(2))
    const externalReference = `megabolao_${crypto.randomUUID()}`
    const now = new Date().toISOString()

    if (paymentMethod === 'mercado_pago_pix') {
      const expirationMinutes = resolvePixExpirationMinutes(round)

      if (!expirationMinutes) {
        return NextResponse.json({
          error: 'A rodada esta muito perto de encerrar para gerar um QR Code Pix. Use pagamento manual com o admin.',
        }, { status: 400 })
      }

      const firstName = (process.env.MERCADO_PAGO_TEST_PAYER_FIRST_NAME || userProfile.nome || '')
        .trim()
        .split(/\s+/)[0] || undefined
      const payerEmail = resolvePixPayerEmail(userProfile.email || authUser.email)

      const order = await createPixOrder({
        amount,
        externalReference,
        payerEmail,
        payerFirstName: firstName,
        description: `${round.nome} - ${picks.length} participacao(oes)`,
        expirationMinutes,
      })

      const pixData = extractPixData(order)
      const localStatus = mapMercadoPagoOrderStatus(order)
      const entryStatus = localStatus === 'paid' ? 'paid' : localStatus === 'pending' ? 'pending' : 'cancelled'
      const expiresAt = expirationMinutes ? new Date(Date.now() + expirationMinutes * 60000).toISOString() : null

      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: userProfile.id,
          round_id: round.id,
          method: 'mercado_pago_pix',
          provider: 'mercado_pago',
          status: localStatus,
          amount,
          entry_count: picks.length,
          external_reference: externalReference,
          mercado_pago_order_id: pixData.orderId,
          mercado_pago_payment_id: pixData.paymentId,
          mercado_pago_status: pixData.status,
          mercado_pago_status_detail: pixData.statusDetail,
          qr_code: pixData.qrCode,
          qr_code_base64: pixData.qrCodeBase64,
          ticket_url: pixData.ticketUrl,
          expires_at: expiresAt,
          paid_at: localStatus === 'paid' ? now : null,
          cancelled_at: localStatus === 'pending' || localStatus === 'paid' ? null : now,
          raw_response: order,
          updated_at: now,
        })
        .select('*')
        .single()

      if (paymentError || !payment) {
        console.error('Erro ao registrar pagamento Pix', paymentError)
        return NextResponse.json({
          error: paymentError?.message || paymentError?.details || paymentError?.hint || 'Nao foi possivel registrar o pagamento Pix.',
        }, { status: 500 })
      }

      const entriesPayload = picks.map((numbers) => ({
        user_id: userProfile.id,
        round_id: round.id,
        payment_id: payment.id,
        numbers,
        payment_status: entryStatus,
        total_hits: 0,
      }))

      const { error: entriesError } = await supabaseAdmin.from('entries').insert(entriesPayload)

      if (entriesError) {
        console.error('Erro ao salvar entries Pix', entriesError)
        await supabaseAdmin.from('payments').update({
          status: 'failed',
          cancelled_at: now,
          updated_at: now,
        }).eq('id', payment.id)

        return NextResponse.json({
          error: entriesError?.message || entriesError?.details || entriesError?.hint || 'Nao foi possivel salvar as participacoes desse pagamento.',
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        payment: {
          id: payment.id,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          entryCount: payment.entry_count,
          expiresAt: payment.expires_at,
          qrCode: payment.qr_code,
          qrCodeBase64: payment.qr_code_base64,
          ticketUrl: payment.ticket_url,
        },
      })
    }

    const { data: payment, error: manualPaymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userProfile.id,
        round_id: round.id,
        method: 'manual',
        status: 'pending',
        amount,
        entry_count: picks.length,
        external_reference: externalReference,
        updated_at: now,
      })
      .select('*')
      .single()

    if (manualPaymentError || !payment) {
      console.error('Erro ao iniciar pagamento manual', manualPaymentError)
      return NextResponse.json({
        error: manualPaymentError?.message || manualPaymentError?.details || manualPaymentError?.hint || 'Nao foi possivel iniciar o pagamento manual.',
      }, { status: 500 })
    }

    const manualEntriesPayload = picks.map((numbers) => ({
      user_id: userProfile.id,
      round_id: round.id,
      payment_id: payment.id,
      numbers,
      payment_status: 'pending',
      total_hits: 0,
    }))

    const { error: manualEntriesError } = await supabaseAdmin.from('entries').insert(manualEntriesPayload)

    if (manualEntriesError) {
      console.error('Erro ao salvar entries manuais', manualEntriesError)
      await supabaseAdmin.from('payments').update({
        status: 'failed',
        cancelled_at: now,
        updated_at: now,
      }).eq('id', payment.id)

      return NextResponse.json({
        error: manualEntriesError?.message || manualEntriesError?.details || manualEntriesError?.hint || 'Nao foi possivel salvar as participacoes manuais.',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        entryCount: payment.entry_count,
        expiresAt: payment.expires_at,
        qrCode: null,
        qrCodeBase64: null,
        ticketUrl: null,
      },
    })
  } catch (error) {
    console.error('Falha em /api/payments/create', error)

    const message = error instanceof Error ? error.message : 'Erro inesperado ao iniciar o pagamento.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
