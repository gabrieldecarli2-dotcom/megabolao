# MegaBolão 🎱

Plataforma web para gerenciar bolões da Mega-Sena. Usuários escolhem 10 números, pagam via PIX, e acompanham acertos a cada sorteio. Quem completar os 10 números primeiro vence.

## Como Funciona

### Para o Usuário
- Cria conta e faz login
- Escolhe 10 números entre 01 e 60 (pode adicionar múltiplos palpites antes de pagar)
- Paga R$50,00 por participação via PIX
- Acompanha acertos a cada sorteio da Mega-Sena
- Primeiro a acertar todos os 10 números vence

### Para o Admin
- Cria e gerencia rodadas
- Aprova pagamentos
- Registra resultados dos sorteios
- Sistema calcula acertos automaticamente
- Gera PDF do ranking para enviar no WhatsApp

## Faixas de Premiação (configurável)
| Faixa | % Padrão |
|-------|----------|
| 🏆 Primeiro a fazer 10 pontos | 50% |
| ⚡ Mais acertos no 1º sorteio | 7% |
| 🥈 Segundo melhor colocado final | 18% |
| 🐢 Lanterna (menos acertos) | 13% |
| 🏢 Taxa administrativa | 12% |

Em caso de empate, o prêmio é dividido igualmente.

## Setup Local

### Pré-requisitos
- Node.js 18+
- Conta no Supabase
- Conta na Vercel (para deploy)

### Instalação
```bash
# Clone o repositório
git clone https://github.com/seu-usuario/megabolao.git
cd megabolao

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com suas chaves do Supabase

# Inicie o servidor de desenvolvimento
npm run dev
```

### Variáveis de Ambiente
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=chave-secreta-do-webhook
MERCADO_PAGO_PIX_EXPIRATION_MINUTES=360
MERCADO_PAGO_TEST_PAYER_FIRST_NAME=APRO
MERCADO_PAGO_TEST_PAYER_EMAIL=test@testuser.com
CRON_SECRET=uma-chave-aleatoria-com-mais-de-16-caracteres
```

### Mercado Pago Pix
No painel do Mercado Pago:

1. Crie a aplicação e use as credenciais de teste.
2. Confirme que a chave Pix da conta está ativa.
3. Em `Webhooks`, cadastre a URL:
   `https://SEU-DOMINIO.com/api/mercado-pago/webhook`
4. Selecione o evento `Order (Mercado Pago)`.
5. Copie a chave secreta gerada pelo webhook e salve em `MERCADO_PAGO_WEBHOOK_SECRET`.

Observações:
- `MERCADO_PAGO_TEST_PAYER_FIRST_NAME=APRO` ajuda a aprovar pagamentos automaticamente em ambiente de teste.
- `MERCADO_PAGO_TEST_PAYER_EMAIL=test@testuser.com` ajuda a homologar o Pix sandbox com os dados esperados pelo Mercado Pago.
- Para homologação real do webhook, a URL precisa ser pública e HTTPS.
- O pagamento online usa um QR Code por carrinho de palpites, não por participação individual.

### Resultados automáticos da Mega-Sena
O projeto usa Vercel Cron para consultar automaticamente o último resultado da Mega-Sena.

- Rota protegida: `/api/cron/mega-sena-sync`
- API consultada: `https://loteriascaixa-api.herokuapp.com/api/megasena/latest`
- Agendamento em `vercel.json`: a cada 30 minutos, todos os dias, entre 19h e 00h no horário de Brasília.
- Configure `CRON_SECRET` na Vercel para proteger a rota. A Vercel envia esse valor automaticamente no header `Authorization`.
- O cron só registra sorteios em rodada `closed`. Antes de buscar o resultado, ele roda o fechamento automático de rodadas vencidas.
- Se o concurso já estiver registrado, nada é duplicado.

## Banco de Dados (Supabase)

### Criar tabelas
Execute os SQLs na ordem no Supabase SQL Editor:

```sql
-- Usuários
create table users (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  telefone text,
  role text not null default 'user',
  referral_code text unique,
  created_at timestamp with time zone default now()
);

-- Rodadas
create table rounds (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  status text not null default 'draft',
  start_date date,
  end_date date,
  ticket_price numeric not null default 50,
  created_at timestamp with time zone default now()
);

-- Participações
create table entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  round_id uuid references rounds(id) on delete cascade not null,
  numbers integer[] not null,
  payment_status text not null default 'pending',
  total_hits integer default 0,
  created_at timestamp with time zone default now()
);

-- Resultados dos sorteios
create table draw_results (
  id uuid default gen_random_uuid() primary key,
  round_id uuid references rounds(id) on delete cascade not null,
  contest_number text not null,
  draw_date date not null,
  numbers integer[] not null,
  is_first boolean default false,
  source text default 'manual',
  created_at timestamp with time zone default now()
);

-- Acertos por participação por sorteio
create table entry_hits (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid references entries(id) on delete cascade not null,
  draw_result_id uuid references draw_results(id) on delete cascade not null,
  hits_count integer not null default 0,
  hit_numbers integer[]
);

-- Regras de premiação
create table prize_rules (
  id uuid default gen_random_uuid() primary key,
  round_id uuid references rounds(id) on delete cascade not null,
  prize_type text not null,
  percentage numeric not null
);
```

### Habilitar RLS
```sql
alter table users enable row level security;
alter table rounds enable row level security;
alter table entries enable row level security;
alter table draw_results enable row level security;
alter table entry_hits enable row level security;
alter table prize_rules enable row level security;

-- Policies
create policy "Todos veem users" on users for select using (true);
create policy "Usuario insere perfil" on users for insert with check (auth.uid() = id);
create policy "Usuario atualiza perfil" on users for update using (auth.uid() = id);

create policy "Todos veem rodadas" on rounds
  for select using (status = any(array['open','closed','finished']));
create policy "Admin gerencia rounds" on rounds
  for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "Usuario ve proprias entries" on entries for select using (auth.uid() = user_id);
create policy "Todos veem entries pagas" on entries for select using (payment_status = 'paid');
create policy "Usuario insere entry" on entries for insert with check (auth.uid() = user_id);
create policy "Admin acessa entries" on entries
  for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "Todos veem sorteios" on draw_results for select using (true);
create policy "Admin gerencia sorteios" on draw_results
  for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "Todos veem entry_hits" on entry_hits for select using (true);
create policy "Admin gerencia entry_hits" on entry_hits
  for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "Todos veem prize_rules" on prize_rules for select using (true);
create policy "Admin gerencia prize_rules" on prize_rules
  for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));
```

### Tornar usuário admin
```sql
update users set role = 'admin'
where id = (select id from auth.users where email = 'seu@email.com');
```

## Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Tela de login
│   │   └── cadastro/page.tsx       # Tela de cadastro
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx      # Dashboard do usuário
│   │   ├── apostar/page.tsx        # Carrinho de palpites
│   │   ├── minhas-participacoes/   # Histórico por rodada
│   │   ├── ranking/page.tsx        # Ranking com histórico
│   │   └── resultados/page.tsx     # Sorteios por rodada
│   ├── admin/
│   │   └── page.tsx                # Painel admin (abas)
│   ├── layout.tsx
│   ├── page.tsx                    # Redirect para /login
│   └── globals.css
├── components/
│   └── shared/
│       └── Navbar.tsx              # Navbar do usuário
└── lib/
    └── supabase.ts                 # Cliente Supabase
```

## Páginas e Funcionalidades

### Usuário

#### Dashboard (`/dashboard`)
- Banner da rodada com status
- Cards: participações, acertos, melhor posição, prêmio do vencedor
- Melhor participação com números destacados
- Último sorteio
- Top 5 ranking parcial
- O prêmio só aparece após as regras serem definidas pelo admin

#### Apostar (`/apostar`)
- Seletor de 60 números
- Botão de escolha aleatória (🎲)
- Carrinho de palpites (adicionar/editar/excluir)
- Valor total calculado automaticamente
- Modal de confirmação com aviso de não poder alterar
- Carrinho persistido no `sessionStorage`
- Aceita `?numeros=01,02,...` para refazer palpites (adiciona ao carrinho)

#### Minhas Participações (`/minhas-participacoes`)
- Agrupado por rodada (accordion)
- Números com acertos destacados em verde
- Status de pagamento
- Barra de progresso
- Botão "Refazer palpite" (apenas com rodada aberta)

#### Ranking (`/ranking`)
- Seletor de rodada (histórico)
- Badge ⚡ no vencedor do 1º sorteio
- Badges 🏆 🥈 🐢 ao encerrar
- Efeito de moedas caindo para o vencedor
- Resultado final com valores em R$
- Distribuição de prêmios sem percentuais

#### Resultados (`/resultados`)
- Agrupado por rodada (accordion)
- Apenas os números sorteados (bolinhas amarelas)
- Badge "1º Sorteio" no primeiro concurso

### Admin (`/admin`)

#### Aba Painel
- Cards: pagas, pendentes, receita, sorteios
- Status e controles da rodada
- Card do prêmio do 1º sorteio (se houver)
- Extrato para WhatsApp (copiável)

#### Aba Ranking
- Seletor de rodada
- Resultado final com valores
- Tabela compacta com números acertados destacados
- **Botão "Gerar PDF"** — abre janela de impressão com ranking formatado

#### Aba Participantes
- Seletor de rodada
- Aprovação individual ou em massa
- Números com acertos destacados

#### Aba Sorteios
- Seletor de rodada
- Formulário para registrar novo sorteio
- Aviso de "1º Sorteio" no primeiro
- Cálculo automático de acertos (únicos)
- Encerramento automático se alguém atingir 10

#### Aba Rodada
- Criar nova rodada (após encerrar a atual)
- Editar dados da rodada atual
- Configurar percentuais de premiação (devem somar 100%)
- Simulação de valores em R$

## Design System

### Paleta
```
Azul primário:  blue-600  (#2563eb)
Amarelo/ouro:   yellow-400 (#facc15)
Verde acerto:   green-500  (#22c55e)
Fundo:          gray-50
Cards:          white + border-gray-100 + shadow-sm
```

### Fontes usadas
- DM Sans (corpo)
- Bebas Neue (títulos grandes)
- JetBrains Mono (números)

Carregadas via Google Fonts no layout.tsx

### Bolinhas de números
```tsx
// Normal
'bg-gray-100 text-gray-500 border border-gray-200'
// Acertado
'bg-green-500 text-white'
// Selecionado pelo usuário
'bg-blue-600 text-white'
// Sorteado pela Mega-Sena
'bg-yellow-400 text-gray-900'
```

## Regras Importantes para o Cursor/Codex

1. **Tailwind v4** — usar `@import "tailwindcss"` no CSS, não `@tailwind`
2. **Acertos únicos** — `total_hits` é sempre a interseção de `entry.numbers` com TODOS os números sorteados até agora (sem duplicar)
3. **maybeSingle()** — usar quando resultado pode ser null (rodada sem sorteios, etc)
4. **Carrinho** — persistido em `sessionStorage` com chave `carrinho_palpites`
5. **Prêmio visível** — só mostrar valores de prêmio quando `prize_rules` existir no banco
6. **Status da rodada:**
   - `open` → aceitando palpites
   - `closed` → palpites encerrados, sorteios em andamento
   - `finished` → encerrada com vencedor
7. **PDF do ranking** — gerado via `window.open` + `window.print()`, sem bibliotecas externas
8. **Refazer palpite** — usa `sessionStorage` para não perder o carrinho ao navegar
9. **Admin** — verificado pelo campo `role = 'admin'` na tabela `users`, não no JWT

## Deploy (Vercel)

```bash
# Build local
npm run build

# Deploy via CLI
npx vercel --prod
```

Configurar no painel da Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_PIX_EXPIRATION_MINUTES`
- `CRON_SECRET`
