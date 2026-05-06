import { NextRequest, NextResponse } from 'next/server'
import { syncMercadoPagoPaymentByOrderId } from '@/lib/payment-reconciliation'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const authUser = await getAuthenticatedUser(request)

  if (!authUser) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const { data: pendingPayments } = await supabaseAdmin
    .from('payments')
    .select('id, mercado_pago_order_id')
    .eq('user_id', authUser.id)
    .eq('method', 'mercado_pago_pix')
    .eq('status', 'pending')
    .not('mercado_pago_order_id', 'is', null)
    .limit(10)

  for (const payment of pendingPayments || []) {
    if (!payment.mercado_pago_order_id) continue
    await syncMercadoPagoPaymentByOrderId(String(payment.mercado_pago_order_id))
  }

  return NextResponse.json({ success: true, checked: pendingPayments?.length || 0 })
}
