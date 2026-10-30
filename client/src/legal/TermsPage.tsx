import { LEGAL } from "@shared/legal";
import { Link } from "wouter";
import { L, LegalPage, S, UL } from "./LegalPage";

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p>Estes termos regulam o uso da plataforma MOVA TICKETS, da {LEGAL.companyName} (CNPJ {L(LEGAL.companyDocument)}), por quem navega, cria conta ou compra ingressos. Ao criar conta ou concluir uma compra, você declara que leu e aceita estes termos e a <Link href="/privacidade" className="text-brand underline">Política de Privacidade</Link>.</p>

      <S n={1} title="O que é a MOVA TICKETS">
        <p>A MOVA TICKETS é uma plataforma de tecnologia que conecta produtoras de eventos ao público. <strong>Cada evento é de responsabilidade da produtora que o anuncia</strong>: programação, horário, local, classificação, segurança, atendimento no local e eventual alteração ou cancelamento. A MOVA não é a organizadora dos eventos de terceiros.</p>
      </S>

      <S n={2} title="Conta de usuário">
        <UL items={[
          <>Você deve informar dados verdadeiros e manter sua senha em sigilo. Atividades feitas com sua conta são de sua responsabilidade.</>,
          <>Confirmamos seu e-mail antes de ativar a conta. Você pode entrar com e-mail e senha ou com Google.</>,
          <>Podemos suspender contas com indício de fraude ou uso indevido.</>,
        ]} />
      </S>

      <S n={3} title="Compra, reserva e pagamento">
        <UL items={[
          <>Os ingressos escolhidos ficam <strong>reservados por 15 minutos</strong> para você concluir o pagamento. Passado esse prazo sem confirmação, a reserva é liberada.</>,
          <>O pagamento é feito no ambiente seguro da InfinitePay e <strong>cai na conta da produtora</strong>. O voucher só é liberado após a confirmação real do pagamento.</>,
          <>Os preços e as condições de cada lote são definidos pela produtora e exibidos antes da compra. Eventuais encargos do meio de pagamento (como juros de parcelamento) são informados no checkout.</>,
        ]} />
      </S>

      <S n={4} title="Ingresso nominal e entrada no evento">
        <UL items={[
          <>Cada ingresso é <strong>nominal</strong>. Informe corretamente nome e CPF do titular.</>,
          <>Na portaria, apresente o <strong>voucher</strong> (com QR Code) e o <strong>documento original com foto</strong>. A entrada pode ser negada se os dados não conferirem.</>,
          <>Cada ingresso vale uma única entrada: depois de validado, o sistema bloqueia novas leituras. Não compartilhe seu voucher; quem apresentar primeiro pode consumir a entrada.</>,
        ]} />
      </S>

      <S n={5} title="Arrependimento, cancelamento e reembolso">
        <UL items={[
          <>Nas compras feitas pela internet, vale o direito de arrependimento previsto no Código de Defesa do Consumidor (art. 49), nas condições e prazos da lei. Para pedir, fale com a produtora do evento ou com {L(LEGAL.contactEmail)}.</>,
          <>Se a <strong>produtora cancelar ou alterar substancialmente</strong> o evento, você tem direito às alternativas previstas em lei, inclusive reembolso. O reembolso é realizado pela produtora, na conta em que o pagamento foi recebido.</>,
          <>Se o seu pagamento for confirmado depois do fim da reserva e não houver mais ingresso disponível, o valor será devolvido pela produtora.</>,
        ]} />
      </S>

      <S n={6} title="Condutas proibidas">
        <UL items={[
          <>Fraudar pagamentos, falsificar ou duplicar vouchers, ou tentar burlar a validação da portaria.</>,
          <>Usar robôs ou meios automatizados para reservar ingressos em massa ou sobrecarregar a plataforma.</>,
          <>Revender ingressos acima do valor de face ou em desacordo com a lei e com as regras do evento.</>,
          <>Informar dados de terceiros sem autorização.</>,
        ]} />
      </S>

      <S n={7} title="Propriedade intelectual">
        <p>A marca, o layout e o software da MOVA TICKETS pertencem à MOVA. Imagens e textos de eventos pertencem às produtoras, que autorizam sua exibição na plataforma.</p>
      </S>

      <S n={8} title="Responsabilidade">
        <p>A MOVA responde pelo funcionamento da plataforma, nos limites da lei. A MOVA não responde por fatos do evento sob responsabilidade da produtora, nem por indisponibilidades causadas por terceiros (como meios de pagamento ou provedores de internet), sem prejuízo dos seus direitos como consumidor.</p>
      </S>

      <S n={9} title="Privacidade">
        <p>O tratamento de dados pessoais segue a <Link href="/privacidade" className="text-brand underline">Política de Privacidade</Link>.</p>
      </S>

      <S n={10} title="Alterações, lei aplicável e foro">
        <p>Podemos atualizar estes termos; a versão vigente fica nesta página. Aplica-se a lei brasileira. Fica eleito o foro de {L(LEGAL.forum)}, ressalvado o foro do domicílio do consumidor quando a lei assim determinar.</p>
      </S>
    </LegalPage>
  );
}
