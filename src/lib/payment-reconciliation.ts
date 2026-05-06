import { getSupabaseAdmin } from './supabase-admin'
import { extractPixData, getOrderById, mapMercadoPagoOrderStatus } from './mercado-pago'

function entryStatusFromPaymentStatus(status: string) {
  return status === 'paid' ? 'paid' : status === 'pending' ? 'pending' : 'cancelled'
}

function nowIso() {
  return new Date().toISOString()
}

async function updateEntriesForPayment(paymentId: string, status: string, previousStatus: string | null) {
  const supabaseAdmin = getSupabaseAdmin()
  const nextEntryStatus = entryStatusFromPaymentStatus(status)

  if (nextEntryStatus === 'paid') {
    await supabaseAdmin
      .from('entries')
      .update({ payment_status: 'paid' })
      .eq('payment_id', paymentId)
      .neq('payment_status', 'paid')

    return
  }

  if (previousStatus === 'paid') {
    return
  }

  if (nextEntryStatus === 'cancelled') {
    await supabaseAdmin
      .from('entries')
      .update({ payment_status: 'cancelled' })
      .eq('payment_id', paymentId)
      .eq('payment_status', 'pending')
  }
}

export async function syncMercadoPagoPaymentByOrderId(orderId: string, webhookPayload?: unknown) {
  const supabaseAdmin = getSupabaseAdmin()
  const order = await getOrderById(orderId)
  const pixData = extractPixData(order)
  const localStatus = mapMercadoPagoOrderStatus(order)

  const paymentQuery = supabaseAdmin
    .from('payments')
    .select('*')
    .eq('mercado_pago_order_id', orderId)
    .maybeSingle()

  let { data: payment } = await paymentQuery

  if (!payment && order?.external_reference) {
    const fallback = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('external_reference', String(order.external_reference))
      .maybeSingle()

    payment = fallback.data || null
  }

  if (!payment) {
    return { payment: null, status: localStatus }
  }

  const previousStatus = payment.status || null
  const paidAt = localStatus === 'paid' ? payment.paid_at || nowIso() : payment.paid_at
  const cancelledAt = localStatus === 'pending' || localStatus === 'paid'
    ? payment.cancelled_at
    : payment.cancelled_at || nowIso()

  const updatedPayment = {
    status: localStatus,
    paid_at: paidAt,
    cancelled_at: cancelledAt,
    mercado_pago_order_id: pixData.orderId || payment.mercado_pago_order_id,
    mercado_pago_payment_id: pixData.paymentId || payment.mercado_pago_payment_id,
    mercado_pago_status: pixData.status,
    mercado_pago_status_detail: pixData.statusDetail,
    qr_code: pixData.qrCode || payment.qr_code,
    qr_code_base64: pixData.qrCodeBase64 || payment.qr_code_base64,
    ticket_url: pixData.ticketUrl || payment.ticket_url,
    raw_response: order,
    webhook_last_payload: webhookPayload ?? payment.webhook_last_payload,
    updated_at: nowIso(),
  }

  await supabaseAdmin
    .from('payments')
    .update(updatedPayment)
    .eq('id', payment.id)

  await updateEntriesForPayment(payment.id, localStatus, previousStatus)

  return { payment: { ...payment, ...updatedPayment }, status: localStatus }
}
