# Publicar a MOVA TICKETS (Railway + Cloudflare R2 + Google + Brevo + InfinitePay)

Faça na ordem. Tempo estimado: 1 a 2 horas na primeira vez.

## 0. No seu computador (uma vez)
1. Instale Node 22 e pnpm. Na pasta do projeto: `pnpm install`.
2. Rode `pnpm check` e `pnpm test`. **Se algo falhar, não publique**: me envie a mensagem de erro.
3. Gere a migration inicial (o banco é novo):
   `DATABASE_URL=mysql://x:x@localhost/x pnpm db:generate` (a URL é só para o comando não reclamar; nada é conectado).
4. Crie um repositório no GitHub e envie o projeto **incluindo a pasta `drizzle/` (passo 3) e o arquivo `pnpm-lock.yaml` (gerado no `pnpm install`)**: sem ele o Railway não instala as dependências.

## 1. Railway (app + banco)
1. railway.com → New Project → Deploy from GitHub repo → escolha o repositório.
2. No mesmo projeto: New → Database → Add MySQL. O Railway cria a variável `MYSQL_URL`.
3. No serviço do app → Variables: crie `DATABASE_URL` apontando para a do MySQL (use "Add Reference" → `MYSQL_URL`).
4. Settings do app → Build command `pnpm build` · Start command `pnpm start` · **Pre-deploy command `pnpm db:migrate`** (aplica as migrations a cada deploy).
5. Settings → Networking → Generate Domain. Copie o endereço (ex.: `https://mova.up.railway.app`).
6. Variables: `APP_PUBLIC_ORIGIN` = esse endereço (sem `/` no fim).
   - `SESSION_SECRET`: rode `openssl rand -base64 48` e cole.
   - `ENCRYPTION_KEY`: rode `openssl rand -base64 32` e cole. **Guarde uma cópia segura**: sem ela as InfiniteTags salvas não podem ser lidas.
   - `SUPER_ADMIN_EMAILS`: seu e-mail (vira administradora MOVA ao entrar com e-mail confirmado).
7. Triggers da auditoria (uma vez, depois do primeiro deploy): no MySQL do Railway abra a aba Data/Query (ou use um cliente MySQL) e execute o conteúdo de `scripts/audit-triggers.sql`.

## 2. Cloudflare R2 (imagens)
1. Cloudflare → R2 → Create bucket `mova-tickets`.
2. Settings do bucket → Public access: habilite o domínio público (r2.dev) ou, melhor, conecte um domínio próprio (ex.: `cdn.seudominio.com`).
3. R2 → Manage API tokens → Create token com permissão **Object Read & Write** só nesse bucket. Anote Access Key ID e Secret.
4. Variáveis no Railway: `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_BUCKET=mova-tickets`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` (o endereço público do passo 2, sem `/` no fim).

## 3. Google (login)
1. console.cloud.google.com → APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.
2. **URIs de redirecionamento autorizados:** `https://SEU-DOMINIO/api/auth/google/callback` (exatamente assim).
3. Tela de consentimento: preencha nome do app MOVA TICKETS e e-mail de suporte; publique em "Em produção" para qualquer pessoa entrar.
4. Variáveis: `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

## 4. Brevo (e-mails de confirmação e redefinição)
1. brevo.com → SMTP & API → API Keys → crie a chave → variável `BREVO_API_KEY`.
2. Senders & IP → Domains: autentique seu domínio (registros SPF/DKIM/DMARC no DNS). Sem isso os e-mails caem no spam.
3. Variáveis: `MAIL_FROM_EMAIL` (um endereço do domínio autenticado) e `MAIL_FROM_NAME=MOVA TICKETS`.

## 5. InfinitePay
Nada a configurar na MOVA: cada produtora informa a própria InfiniteTag em Área da produtora → Recebimento.
O webhook é enviado automaticamente a `APP_PUBLIC_ORIGIN/api/webhooks/infinitepay` em cada link criado.

## 6. Teste antes de divulgar (checklist)
- [ ] `https://SEU-DOMINIO/healthz` responde `{"ok":true}`.
- [ ] Criar conta por e-mail: chega o e-mail, o link pede nome e senha e entra logada.
- [ ] Entrar com Google.
- [ ] Redefinir senha derruba a sessão antiga de e-mail.
- [ ] Seu e-mail (SUPER_ADMIN_EMAILS) vê "MODERAÇÃO" no topo e abre `/master`.
- [ ] Candidatar uma produtora de teste → aprovar em `/master` → ela vê as abas.
- [ ] Salvar InfiniteTag de teste, criar evento + lote de R$ 1,00, enviar e aprovar.
- [ ] Comprar com outra conta: abre o checkout da InfinitePay; pagar; a página de sucesso mostra o voucher com QR.
- [ ] Portaria: ler QR → marcar a confirmação → validar; tentar de novo deve bloquear.
- [ ] Em `/master` → Auditoria aparecem `ORDER_APPROVED` e `CHECKIN_VALIDATED`.
- [ ] Abandonar uma compra: após 15 min o estoque volta.

## 7. Domínio próprio
Railway → Settings → Networking → Custom Domain. Depois atualize `APP_PUBLIC_ORIGIN` e a URI de redirecionamento do Google.

## Operação
- Pagamento que chega depois da reserva expirar sem estoque aparece na auditoria como `PAYMENT_AFTER_EXPIRY_REFUND_NEEDED`: reembolse manualmente na InfinitePay.
- Faça backup do MySQL (Railway → Backups) e da `ENCRYPTION_KEY`.

## Antes de divulgar: textos legais
Abra `shared/legal.ts` e preencha CNPJ, endereço, e-mails (atendimento e encarregado LGPD) e foro. Peça a revisão de um(a) advogado(a) dos textos em `client/src/legal/` e faça o novo deploy.
