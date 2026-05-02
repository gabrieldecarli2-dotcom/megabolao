# AGENTS.md — MegaBolão

## Visão Geral
Plataforma web de bolão da Mega-Sena com múltiplos usuários, ranking, premiação configurável e painel administrativo completo.

## Stack Tecnológica
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend/DB:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (frontend) + Supabase (banco)
- **Estilização:** Tailwind CSS v4 — usar `@import "tailwindcss"` no globals.css (NÃO as diretivas @tailwind)

## Estrutura de Pastas
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── cadastro/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── apostar/page.tsx
│   │   ├── minhas-participacoes/page.tsx
│   │   ├── ranking/page.tsx
│   │   └── resultados/page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── layout.tsx
│   ├── page.tsx           ← redireciona para /login
│   └── globals.css
├── components/
│   └── shared/
│       └── Navbar.tsx
├── lib/
│   └── supabase.ts
└── types/
```

## Cliente Supabase
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Variáveis de Ambiente (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Banco de Dados — Tabelas Principais

### users
| campo | tipo | descrição |
|-------|------|-----------|
| id | uuid | FK para auth.users |
| nome | text | nome do usuário |
| telefone | text | WhatsApp |
| role | text | 'user' ou 'admin' |
| referral_code | text | código único |
| created_at | timestamptz | |

### rounds
| campo | tipo | descrição |
|-------|------|-----------|
| id | uuid | PK |
| nome | text | ex: "Bolão Maio 2025" |
| status | text | 'draft', 'open', 'closed', 'finished' |
| start_date | date | início dos palpites |
| end_date | date | encerramento dos palpites |
| ticket_price | numeric | valor por participação (default 50) |

**Status da rodada:**
- `open` — aceitando palpites
- `closed` — palpites encerrados, sorteios em andamento
- `finished` — alguém atingiu 10 acertos, rodada encerrada

### entries
| campo | tipo | descrição |
|-------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK users |
| round_id | uuid | FK rounds |
| numbers | integer[] | 10 números escolhidos |
| payment_status | text | 'pending', 'paid', 'cancelled' |
| total_hits | integer | acertos únicos acumulados |

### draw_results
| campo | tipo | descrição |
|-------|------|-----------|
| id | uuid | PK |
| round_id | uuid | FK rounds |
| contest_number | text | número do concurso Mega-Sena |
| draw_date | date | data do sorteio |
| numbers | integer[] | 6 números sorteados |
| is_first | boolean | true = primeiro sorteio da rodada |

### entry_hits
| campo | tipo | descrição |
|-------|------|-----------|
| id | uuid | PK |
| entry_id | uuid | FK entries |
| draw_result_id | uuid | FK draw_results |
| hits_count | integer | acertos neste sorteio |
| hit_numbers | integer[] | quais números acertou |

### prize_rules
| campo | tipo | descrição |
|-------|------|-----------|
| id | uuid | PK |
| round_id | uuid | FK rounds |
| prize_type | text | 'first10', 'firstDraw', 'second', 'last', 'admin' |
| percentage | numeric | percentual |

**Tipos de prêmio:**
- `first10` — primeiro a fazer 10 acertos (50%)
- `firstDraw` — mais acertos no primeiro sorteio (7%)
- `second` — segundo melhor colocado final (18%)
- `last` — lanterna (menos acertos) (13%)
- `admin` — taxa administrativa (12%)

## Regras de Negócio Críticas

### Cálculo de Acertos
- Cada participação tem 10 números (1-60, sem repetição)
- A cada sorteio da Mega-Sena (6 números), conta quantos o usuário acertou
- **IMPORTANTE:** `total_hits` conta apenas **números únicos** acertados em TODOS os sorteios
- Um número acertado em dois sorteios conta como 1, não 2
- Fórmula: `acertos_unicos = entry.numbers ∩ todos_numeros_sorteados_ate_agora`

### Encerramento Automático
- Quando qualquer entry atingir `total_hits >= 10`, a rodada muda para `finished` automaticamente
- Isso acontece na função `salvarSorteio` do admin

### Premiação do 1º Sorteio
- O sorteio marcado com `is_first = true` define quem ganhou o prêmio de "mais acertos no 1º sorteio"
- Em caso de empate, o prêmio é dividido igualmente

### Pagamentos
- Participações ficam `pending` até o admin aprovar
- Participações `pending` em rodadas `closed` ou `finished` são canceladas
- Apenas participações `paid` entram no ranking

### Recálculo de acertos (SQL utilitário)
```sql
update entries e
set total_hits = (
  select count(distinct n)
  from draw_results dr
  cross join unnest(dr.numbers) as n
  where dr.round_id = e.round_id
    and n = any(e.numbers)
)
where e.payment_status = 'paid';
```

## Autenticação e Roles
- Auth via Supabase Auth (email + senha)
- Role armazenada na tabela `users` (não no JWT)
- Admin acessa `/admin` — redireciona para `/dashboard` se não for admin
- Usuário comum acessa rotas em `/(dashboard)/`

## RLS (Row Level Security) — Políticas Importantes
```sql
-- entries: usuário vê as próprias + todos veem pagas
-- rounds: todos veem open/closed/finished
-- prize_rules: todos podem ler
-- users: todos podem ler (para o ranking)
-- entry_hits: usuário vê as próprias + admin vê tudo
```

## Paleta de Cores e Design

### Cores principais
- **Azul primário:** `blue-600` (#2563eb) — navbar, botões, valores
- **Amarelo/ouro:** `yellow-400` (#facc15) e `yellow-500` — prêmios, destaques
- **Verde:** `green-500` — números acertados, status pago
- **Vermelho:** `red-500` — erros, cancelados, lanterna
- **Fundo:** `gray-50` — fundo das páginas
- **Cards:** `white` com `border-gray-100` e `shadow-sm`

### Navbar
- Fundo `blue-600`, logo com "MEGA" em `yellow-400` e "BOLÃO" em branco
- Aba ativa: fundo `yellow-400` texto `gray-900`
- Admin navbar: fundo `gray-900` com badge "ADMIN" em `yellow-400`

### Cards padrão
```tsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
```

### Bolinhas de números
- Normal: `bg-gray-100 text-gray-500`
- Acertado: `bg-green-500 text-white`
- Selecionado: `bg-blue-600 text-white`
- Sorteado (Mega-Sena): `bg-yellow-400 text-gray-900`

### Banner de rodada
```tsx
<div className="bg-blue-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
```

## Componentes Reutilizáveis

### Navbar (src/components/shared/Navbar.tsx)
- Props: `nomeUsuario: string`
- Links: Dashboard, Apostar, Minhas Participações, Ranking, Resultados
- Aba ativa detectada via `usePathname()`

## Fluxo do Usuário
1. Cadastro → salva em `auth.users` + `users`
2. Login → redireciona para `/dashboard`
3. Apostar → carrinho de palpites, confirma tudo de uma vez
4. Paga via PIX → admin aprova
5. Acompanha ranking e resultados
6. Pode "refazer palpite" de rodadas anteriores (adiciona ao carrinho sem limpar)

## Fluxo do Admin
1. Cria rodada → status `open`
2. Aprova pagamentos individualmente ou em massa
3. Fecha palpites → status `closed`
4. Define percentuais de premiação (devem somar 100%)
5. Registra sorteios → sistema calcula acertos automaticamente
6. Se alguém atingir 10 → rodada vai para `finished` automaticamente
7. Gera PDF do ranking para WhatsApp
8. Cria nova rodada → histórico preservado

## Comandos Úteis
```bash
npm run dev      # desenvolvimento local
npm run build    # build de produção
npm run lint     # linting
```

## Erros Comuns e Soluções

### "Cannot read properties of null"
- Usar `.maybeSingle()` ao invés de `.single()` quando resultado pode ser null

### Tailwind não funciona
- Verificar se globals.css tem `@import "tailwindcss"` (v4)
- NÃO usar `@tailwind base/components/utilities`

### RLS bloqueando dados
- Verificar policies com: `select * from pg_policies where tablename = 'nome_tabela'`
- Admin usa policy separada verificando `role = 'admin'` na tabela users

### Acertos duplicados
- Nunca somar `hits_count` do `entry_hits` para obter o total
- Sempre recalcular com números únicos: interseção entre `entry.numbers` e todos os números sorteados