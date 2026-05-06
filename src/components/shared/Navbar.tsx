'use client'

import { useRouter, usePathname } from 'next/navigation'
import { BarChart3, Home, ListChecks, ReceiptText, Trophy, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Inicio', Icon: Home },
  { href: '/apostar', label: 'Apostar', shortLabel: 'Apostar', Icon: ListChecks },
  { href: '/minhas-participacoes', label: 'Minhas Participações', shortLabel: 'Jogos', Icon: ReceiptText },
  { href: '/ranking', label: 'Ranking', shortLabel: 'Ranking', Icon: Trophy },
  { href: '/resultados', label: 'Resultados', shortLabel: 'Resultados', Icon: BarChart3 },
]

export default function Navbar({ nomeUsuario }: { nomeUsuario: string }) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <nav className="bg-blue-600 text-white sticky top-0 z-40 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          <a href="/dashboard" className="flex shrink-0 items-center" aria-label="MegaBolão">
            <img src="/logo.png" alt="MegaBolão" className="h-9 w-auto max-w-[160px] object-contain sm:h-10 sm:max-w-[180px]" />
          </a>

          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href
              const baseClass = 'text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition '
              const activeClass = 'bg-yellow-400 text-gray-900'
              const inactiveClass = 'text-blue-100 hover:bg-white/10'
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={baseClass + (isActive ? activeClass : inactiveClass)}
                >
                  {link.label}
                </a>
              )
            })}
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-sm text-blue-200 hidden lg:block">
              Olá, <strong className="text-white">{nomeUsuario}</strong>
            </span>
            <a
              href="/perfil"
              aria-label="Perfil"
              title="Perfil"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                pathname === '/perfil'
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <UserRound size={17} strokeWidth={2.4} aria-hidden="true" />
            </a>
            <button
              onClick={handleLogout}
              className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
            >
              Sair
            </button>
          </div>

        </div>
      </nav>

      <nav
        data-mobile-user-nav
        className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur"
      >
        <div className="grid grid-cols-5 gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href
            const Icon = link.Icon
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-blue-600'
                }`}
              >
                <Icon size={20} strokeWidth={2.4} aria-hidden="true" />
                <span className="leading-none">{link.shortLabel}</span>
              </a>
            )
          })}
        </div>
      </nav>
    </>
  )
}
