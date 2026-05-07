import { NextRequest, NextResponse } from 'next/server'
import { registerLatestMegaSenaDrawFromCron } from '@/lib/draw-registration'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await registerLatestMegaSenaDrawFromCron()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Falha no cron da Mega-Sena', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Falha ao sincronizar resultado da Mega-Sena.',
      },
      { status: 500 },
    )
  }
}
