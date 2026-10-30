import { LEGAL } from "@shared/legal";
import { L, LegalPage, S, UL } from "./LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>Esta política explica como a {LEGAL.companyName} (“MOVA”, CNPJ {L(LEGAL.companyDocument)}), responsável pela plataforma MOVA TICKETS, trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>

      <S n={1} title="Quem decide sobre os seus dados">
        <p>A MOVA é <strong>controladora</strong> dos dados da sua conta, da operação da plataforma, da segurança e da prevenção a fraudes.</p>
        <p>A <strong>produtora do evento</strong> em que você compra ingresso recebe os dados necessários para realizar o evento e atender você (por exemplo, nome do titular, lote, status do ingresso e dados de contato). Em relação a esses dados, ela atua como controladora própria e deve tratá-los conforme a LGPD e os Termos para produtoras.</p>
      </S>

      <S n={2} title="Quais dados coletamos">
        <UL items={[
          <><strong>Conta:</strong> nome, e-mail, senha (guardada apenas em formato criptográfico irreversível) e, se você entrar com Google, o identificador e o e-mail verificados pelo Google.</>,
          <><strong>Compra:</strong> nome completo, CPF, e-mail, telefone e, opcionalmente, Instagram do comprador e de cada titular de ingresso; lote escolhido, valor, situação do pagamento e identificadores da transação.</>,
          <><strong>Portaria:</strong> registro de validação do ingresso (data e hora, operador e evento).</>,
          <><strong>Produtoras:</strong> razão social ou nome, CPF/CNPJ, responsável, e-mail, telefone, cidade e informações do perfil público.</>,
          <><strong>Técnicos:</strong> endereço IP, data e hora de ações sensíveis (login, compra, validação, aprovações) e registros de erro, para segurança e auditoria.</>,
        ]} />
        <p>Não coletamos dados de cartão: o pagamento é feito no ambiente da InfinitePay.</p>
      </S>

      <S n={3} title="Para que usamos e em que base legal">
        <UL items={[
          <>Criar e manter sua conta, processar a compra, emitir o voucher nominal e permitir sua entrada no evento — <em>execução de contrato</em> (art. 7º, V).</>,
          <>Prevenir fraude, uso indevido e reutilização de ingressos, e manter trilha de auditoria — <em>legítimo interesse</em> (art. 7º, IX) e <em>proteção ao crédito e à segurança</em>.</>,
          <>Cumprir obrigações fiscais, contábeis e de defesa do consumidor — <em>obrigação legal ou regulatória</em> (art. 7º, II).</>,
          <>Defender direitos em processos — <em>exercício regular de direitos</em> (art. 7º, VI).</>,
          <>Enviar e-mails transacionais (confirmação de conta, redefinição de senha, voucher, avisos de aprovação). Não enviamos publicidade sem o seu consentimento.</>,
        ]} />
      </S>

      <S n={4} title="Com quem compartilhamos">
        <UL items={[
          <><strong>Produtora do evento:</strong> dados dos titulares necessários à realização do evento e ao atendimento.</>,
          <><strong>InfinitePay:</strong> processamento do pagamento, na conta da produtora.</>,
          <><strong>Prestadores de tecnologia (operadores):</strong> hospedagem e banco de dados (Railway), armazenamento de imagens (Cloudflare), envio de e-mails (Brevo) e login (Google), que tratam dados apenas para prestar o serviço à MOVA.</>,
          <><strong>Autoridades:</strong> quando houver determinação legal ou judicial.</>,
        ]} />
        <p>Não vendemos dados pessoais.</p>
      </S>

      <S n={5} title="Transferência internacional">
        <p>Alguns prestadores podem armazenar ou processar dados fora do Brasil. Nesses casos, adotamos prestadores que oferecem salvaguardas compatíveis com a LGPD (art. 33).</p>
      </S>

      <S n={6} title="Por quanto tempo guardamos">
        <UL items={[
          <>Conta: enquanto estiver ativa e até a sua solicitação de exclusão, ressalvadas obrigações legais.</>,
          <>Dados de compra e pagamento: pelo prazo necessário a obrigações fiscais, de defesa do consumidor e de defesa em processos (em geral, até 5 anos).</>,
          <>Registros de auditoria e segurança: pelo tempo necessário à segurança e à prestação de contas.</>,
          <>Links de confirmação e de redefinição de senha: expiram em até 24 horas e 1 hora, respectivamente.</>,
        ]} />
      </S>

      <S n={7} title="Seus direitos">
        <p>Você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre compartilhamentos, revisão de decisões automatizadas e revogação de consentimento (art. 18).</p>
        <p>Para exercer seus direitos, escreva para o encarregado: {L(LEGAL.dpoName)} — {L(LEGAL.dpoEmail)}. Responderemos no prazo legal. Dados que a produtora recebeu para o evento também podem ser solicitados diretamente a ela. Você pode ainda reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
      </S>

      <S n={8} title="Como protegemos os dados">
        <UL items={[
          <>CPF exibido mascarado na tela; a versão completa só aparece no arquivo do voucher baixado.</>,
          <>Senhas com hash criptográfico; InfiniteTag da produtora cifrada em repouso.</>,
          <>Conexão segura (HTTPS), controle de acesso por produtora e por evento, e trilha de auditoria que não pode ser alterada pelo painel.</>,
          <>Exportações para conciliação sem CPF, e-mail, telefone ou nome dos compradores.</>,
        ]} />
        <p>Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente que possa causar risco relevante a você, comunicaremos você e a ANPD conforme a lei.</p>
      </S>

      <S n={9} title="Cookies e armazenamento no seu navegador">
        <p>Usamos apenas o que é <strong>estritamente necessário</strong>: um cookie de sessão para manter você conectado (<span className="font-mono">mova_session</span>), um cookie temporário durante o login com Google e um registro local do código de afiliado para atribuir a venda. Não usamos cookies de publicidade nem de rastreamento de terceiros.</p>
      </S>

      <S n={10} title="Crianças e adolescentes">
        <p>A plataforma é voltada a maiores de 18 anos. Ingressos para menores devem ser adquiridos por pai, mãe ou responsável legal, que responde pelos dados informados do menor, observadas as regras de acesso de cada evento.</p>
      </S>

      <S n={11} title="Alterações desta política">
        <p>Podemos atualizar esta política. A versão vigente e a data ficam no topo desta página; mudanças relevantes serão comunicadas pelos canais da plataforma.</p>
      </S>

      <S n={12} title="Contato">
        <p>{LEGAL.companyName} · {L(LEGAL.companyAddress)} · {L(LEGAL.contactEmail)}</p>
      </S>
    </LegalPage>
  );
}
