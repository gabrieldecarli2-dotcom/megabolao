import type { Metadata } from 'next'
import Footer from '@/components/shared/Footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'MegaBolão',
  description: 'Plataforma de bolão da Mega-Sena',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
