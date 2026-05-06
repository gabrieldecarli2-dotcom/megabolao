import crypto from 'crypto'
import { LocalPaymentStatus } from './payment-types'

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
const mercadoPagoWebhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET

type CreatePixOrderParams = {
  amount: number
  externalReference: string
  payerEmail: string
  payerFirstName?: string | null
  description: string
  expirationMinutes: number
}

type MercadoPagoOrder = {
  id?: string | number
  status?: string
  status_detail?: string
  external_reference?: string
  transactions?: {
    payments?: Array<{
      id?: string | number
      status?: string
      status_detail?: string
      qr_data?: string
      qr_code_base64?: string
      ticket_url?: string
      payment_method?: {
        qr_code?: string
        qr_code_base64?: string
        ticket_url?: string
      }
    }>
  }
}

function getMercadoPagoBaseUrl() {
  return 'https://api.mercadopago.com'
}

async function mercadoPagoFetch(path: string, init?: RequestInit) {
  if (!mercadoPagoAccessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN nao configurado.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  const response = await fetch(getMercadoPagoBaseUrl() + path, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  const text = await response.text()
  let json: Record<string, unknown> | null = null

  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      json = { raw: text }
    }
  }

  if (!response.ok) {
    const statusInfo = `HTTP ${response.status}`
    const message = String(json?.message || json?.error || json?.raw || statusInfo)
    throw new Error(message)
  }

  return json
}

export async function createPixOrder(params: CreatePixOrderParams) {
  const payload = {
    type: 'online',
    processing_mode: 'automatic',
    total_amount: params.amount.toFixed(2),
    external_reference: params.externalReference,
    description: params.description,
    payer: {
      email: params.payerEmail,
      first_name: params.payerFirstName || undefined,
    },
    transactions: {
      payments: [
        {
          amount: params.amount.toFixed(2),
          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
          expiration_time: `PT${params.expirationMinutes}M`,
        },
      ],
    },
  }

  return mercadoPagoFetch('/v1/orders', {
    method: 'POST',
    headers: {
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  })
}

export async function getOrderById(orderId: string) {
  return mercadoPagoFetch(`/v1/orders/${orderId}`)
}

export function extractOrderPayment(order: MercadoPagoOrder | null) {
  const payment = Array.isArray(order?.transactions?.payments)
    ? order?.transactions?.payments?.[0]
    : null

  return payment || null
}

export function mapMercadoPagoOrderStatus(order: MercadoPagoOrder | null): LocalPaymentStatus {
  const payment = extractOrderPayment(order)
  const status = String(payment?.status || order?.status || '').toLowerCase()

  if (['approved', 'accredited', 'processed'].includes(status)) return 'paid'
  if (status === 'expired') return 'expired'
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled'
  if (['rejected', 'failed'].includes(status)) return 'failed'

  return 'pending'
}

export function extractPixData(order: MercadoPagoOrder | null) {
  const payment = extractOrderPayment(order)
  const paymentMethod = payment?.payment_method || {}

  return {
    orderId: order?.id ? String(order.id) : null,
    paymentId: payment?.id ? String(payment.id) : null,
    status: String(payment?.status || order?.status || 'pending'),
    statusDetail: String(payment?.status_detail || order?.status_detail || ''),
    qrCode: paymentMethod?.qr_code || payment?.qr_data || null,
    qrCodeBase64: paymentMethod?.qr_code_base64 || payment?.qr_code_base64 || null,
    ticketUrl: paymentMethod?.ticket_url || payment?.ticket_url || null,
  }
}

export function isMercadoPagoWebhookValid(payload: string, signature: string | null, requestId: string | null, dataId: string | null) {
  if (!mercadoPagoWebhookSecret) {
    return true
  }

  if (!signature || !dataId) {
    return false
  }

  const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=')
    if (key && value) acc[key.trim()] = value.trim()
    return acc
  }, {})

  const ts = parts.ts
  const hash = parts.v1

  if (!ts || !hash) {
    return false
  }

  const manifest = `id:${dataId};request-id:${requestId || ''};ts:${ts};`
  const expected = crypto
    .createHmac('sha256', mercadoPagoWebhookSecret)
    .update(manifest)
    .digest('hex')

  return expected === hash
}
