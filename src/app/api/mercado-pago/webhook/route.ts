import { NextRequest, NextResponse } from 'next/server'
import { isMercadoPagoWebhookValid } from '@/lib/mercado-pago'
import { syncMercadoPagoPaymentByOrderId } from '@/lib/payment-reconciliation'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const payload = rawBody ? JSON.parse(rawBody) : {}
  const signature = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  const bodyDataId = payload?.data?.id ? String(payload.data.id) : null
  const queryDataId = request.nextUrl.searchParams.get('data.id')
  const dataId = bodyDataId || queryDataId

  if (!isMercadoPagoWebhookValid(rawBody, signature, requestId, dataId)) {
    return NextResponse.json({ error: 'Assinatura invalida.' }, { status: 401 })
  }

  if (dataId) {
    await syncMercadoPagoPaymentByOrderId(dataId, payload)
  }

  return NextResponse.json({ received: true })
}
