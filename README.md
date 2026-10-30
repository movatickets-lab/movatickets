# MOVA TICKETS — projeto completo (hospedável)

Stack: React 19 + Vite, Express, tRPC 11, Drizzle + MySQL. Hospedagem sugerida: **Railway (app + MySQL) + Cloudflare R2 (imagens)**.

## Estado da construção
- [x] Etapa 1 — Fundação: schema, sessões, login e-mail/senha (confirmação e redefinição por e-mail via Brevo), login Google (OAuth + PKCE), auditoria, relatórios e portaria transacional (backend).
- [x] Etapa 2 — Backend de eventos, lotes, pedidos com reserva de estoque (15 min), InfinitePay por produtora (InfiniteTag cifrada; checkout + webhook confirmado por payment_check), candidatura de produtora, perfil público com contato, busca, afiliados, equipe, upload de imagens (R2) e moderação MOVA.
- [x] Etapa 3 — Interface: vitrine, busca, evento e compra nominal, voucher (PNG/PDF), perfil público, login/cadastro, candidatura, Área da produtora (eventos, lotes, perfil, recebimento, afiliados, equipe), resumo de vendas com CSV, portaria com câmera e busca manual, moderação MOVA e auditoria.
- [x] Etapa 4 — Guia de publicação: veja `DEPLOY.md`.

Nada daqui foi executado ainda (sem `node_modules` no ambiente de criação): rode `pnpm install`, `pnpm check` e `pnpm test` antes de publicar.

## Banco (banco novo, vazio)
1. `pnpm db:generate` (gera a migration inicial a partir de `drizzle/schema.ts`)
2. `pnpm db:migrate`
3. Execute `scripts/audit-triggers.sql` no MySQL (torna a auditoria append-only).

## Variáveis
Veja `.env.example`. `SUPER_ADMIN_EMAILS` define quem vira administrador MOVA ao entrar com e-mail verificado.

## Callback do Google
`APP_PUBLIC_ORIGIN/api/auth/google/callback` em "Authorized redirect URIs".

## Pagamento (InfinitePay)
Cada produtora cadastra a própria **InfiniteTag** (painel > Recebimento). A MOVA cria o link de checkout na conta dela
(`POST https://api.checkout.infinitepay.io/links`) e só aprova o pedido depois de `payment_check` com `paid=true` e valor
igual ao do pedido. O corpo do webhook não é assinado, então nunca é prova de pagamento. Pagamento que chega depois da
reserva expirar tenta reaver o estoque; sem estoque, o pedido fica marcado `PAYMENT_AFTER_EXPIRY_REFUND_NEEDED` na auditoria.
Webhook: `APP_PUBLIC_ORIGIN/api/webhooks/infinitepay`.

## Verificação já feita
`util`, `helpers` e `reports` (funções puras) foram executadas com asserts; `tsc` não encontrou erro de sintaxe. A checagem de
tipos completa e os testes com banco dependem de `pnpm install`.

## Funcionalidades adicionadas na rodada final
E-mails (Brevo): candidatura recebida, decisões da moderação (com motivo), voucher ao confirmar o pagamento e reenvio pelo painel ·
XLSX (ExcelJS, servidor) e CSV minimizados · gráficos por dia com comparação ao período anterior · ocupação por lote ·
relatório por afiliado · gestão de participantes (busca, reenvio de voucher) · fila de reembolsos pendentes (marcação manual) ·
prévia social (Open Graph/Twitter) para evento e produtora, `sitemap.xml` e `robots.txt` · "Adicionar ao calendário" (.ics) ·
cartão de divulgação com QR Code da página da produtora (PNG 1080×1350).

## Ainda não feito
Reembolso automático (a InfinitePay não oferece esse recurso na API de checkout usada aqui) · permissões ainda mais granulares
que gestora/portaria · fila durável de e-mails (hoje o envio é direto, com falha só registrada no log).

## Textos legais (preencher antes de publicar)
Páginas: `/termos` (Termos de uso), `/termos-produtoras` (Termos para produtoras) e `/privacidade` (Política de Privacidade/LGPD),
ligadas no rodapé. **Preencha `shared/legal.ts`** (CNPJ, endereço, e-mails de atendimento e do encarregado de dados, foro): campos
pendentes aparecem destacados em amarelo nas páginas e o servidor avisa no log. Os textos são um modelo e **devem ser revisados por
advogado(a)** antes da divulgação. Mude `TERMS_VERSION` ao alterar os textos.
Aceite registrado com data e versão: na ativação da conta (`users`), em cada compra (`orders`) e na candidatura da produtora.
