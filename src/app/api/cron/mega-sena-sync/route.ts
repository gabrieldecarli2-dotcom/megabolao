import { NextRequest, NextResponse } from 'next/server'
import { registerLatestMegaSenaDrawFromCron, registerMegaSenaDrawFromCronOverride } from '@/lib/draw-registration'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const contestNumber = request.nextUrl.searchParams.get('contestNumber')
    const drawDate = request.nextUrl.searchParams.get('drawDate')
    const numbersParam = request.nextUrl.searchParams.get('numbers')
    const hasManualResult = contestNumber || drawDate || numbersParam

    if (hasManualResult && (!contestNumber || !drawDate || !numbersParam)) {
      return NextResponse.json(
        { success: false, error: 'Informe contestNumber, drawDate e numbers para registro manual pelo cron.' },
        { status: 400 },
      )
    }

    const numbers = numbersParam
      ?.split(',')
      .map((number) => Number(number.trim()))
      .filter((number) => Number.isInteger(number))

    if (hasManualResult && (!numbers || numbers.length !== 6)) {
      return NextResponse.json(
        { success: false, error: 'Informe exatamente 6 numeros em numbers, separados por virgula.' },
        { status: 400 },
      )
    }

    const result = hasManualResult
      ? await registerMegaSenaDrawFromCronOverride({
          contestNumber: contestNumber!,
          drawDate: drawDate!,
          numbers: numbers!,
        })
      : await registerLatestMegaSenaDrawFromCron()

    console.log('Resultado do cron da Mega-Sena', {
      mode: hasManualResult ? 'manual_override' : 'automatic',
      status: result.status,
      reason: result.reason,
      brazilNow: 'brazilNow' in result ? result.brazilNow : undefined,
      latestContest: result.latestResult?.contestNumber,
      latestDrawDate: result.latestResult?.drawDate,
      latestSource: result.latestResult?.source,
      providerErrors: 'providerErrors' in result.latestResult ? result.latestResult.providerErrors : undefined,
      registrationStatus: result.registration?.status,
      registrationReason: result.registration?.reason,
      registeredContest: result.registration?.draw?.contest_number,
      roundId: result.registration?.round?.id,
      roundStatus: result.registration?.round?.status,
    })

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
