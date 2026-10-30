import { LEGAL } from "@shared/legal";
import { Link } from "wouter";
import { L, LegalPage, S, UL } from "./LegalPage";

export default function ProducerTermsPage() {
  return (
    <LegalPage title="Termos para Produtoras">
      <p>Estes termos se aplicam às produtoras e organizadores que se cadastram na MOVA TICKETS, da {LEGAL.companyName} (CNPJ {L(LEGAL.companyDocument)}), para vender ingressos. Eles complementam os <Link href="/termos" className="text-brand underline">Termos de Uso</Link> e a <Link href="/privacidade" className="text-brand underline">Política de Privacidade</Link>.</p>

      <S n={1} title="Candidatura e aprovação">
        <UL items={[
          <>O cadastro é uma <strong>candidatura</strong>. Os dados enviados ficam privados e só são vistos pela equipe MOVA até a decisão.</>,
          <>A MOVA pode aprovar, pedir ajustes ou recusar candidaturas, sempre informando o motivo quando devolvida.</>,
          <>Você declara que as informações (inclusive CPF/CNPJ) são verdadeiras e que tem poderes para representar a produtora.</>,
        ]} />
      </S>

      <S n={2} title="Moderação de perfil e eventos">
        <p>O perfil público e cada evento passam por aprovação da MOVA antes de irem a público. Alterações em perfil já publicado só substituem a versão no ar depois de nova aprovação. Contato público (e-mail e telefone) só é exibido depois de aprovado e apenas se você o informar para essa finalidade.</p>
      </S>

      <S n={3} title="Recebimento dos pagamentos (InfinitePay)">
        <UL items={[
          <>Você informa a sua <strong>InfiniteTag</strong>. A MOVA gera o link de pagamento na sua conta InfinitePay; os valores são recebidos por você, e a MOVA <strong>não custodia</strong> o dinheiro.</>,
          <>Você é responsável pela sua conta InfinitePay, por suas taxas e condições (contratadas diretamente com a InfinitePay) e por manter a InfiniteTag correta.</>,
          <>No momento, a MOVA <strong>não cobra comissão por lote</strong>. Qualquer cobrança futura será comunicada com antecedência e só valerá para vendas posteriores ao aviso.</>,
          <>Um pedido só é aprovado depois da confirmação do pagamento junto à InfinitePay e da conferência do valor.</>,
        ]} />
      </S>

      <S n={4} title="Suas responsabilidades como organizadora">
        <UL items={[
          <>Informar com verdade data, local, atrações, classificação indicativa, lotes e valores, e entregar o evento como anunciado.</>,
          <>Cumprir a legislação aplicável ao evento: alvarás, segurança, acessibilidade, meia-entrada e demais normas.</>,
          <>Atender o público e responder perante os consumidores, nos termos do Código de Defesa do Consumidor.</>,
          <>Realizar a conferência de voucher e documento original com foto na portaria.</>,
        ]} />
      </S>

      <S n={5} title="Cancelamento do evento e reembolsos">
        <p>Se o evento for cancelado ou alterado substancialmente, a produtora é responsável por informar o público e reembolsar, pela própria conta InfinitePay, quem tiver direito. Pagamentos confirmados após o fim da reserva e sem estoque disponível aparecem no painel como “reembolso pendente” e devem ser devolvidos pela produtora.</p>
      </S>

      <S n={6} title="Dados pessoais dos participantes">
        <UL items={[
          <>Em relação aos dados dos participantes que você acessa, você atua como <strong>controladora</strong>, nos termos da LGPD.</>,
          <>Use esses dados <strong>somente</strong> para realizar o evento, atender o público e cumprir obrigações legais. É proibido vender, ceder ou usar para publicidade sem base legal adequada.</>,
          <>Proteja os dados, restrinja o acesso da equipe ao necessário e comunique à MOVA incidentes de segurança sem demora.</>,
          <>Atenda aos pedidos dos titulares relativos aos dados sob sua responsabilidade.</>,
        ]} />
      </S>

      <S n={7} title="Equipe, afiliados e portaria">
        <p>Você responde por quem recebe acesso (gestores, operadores de portaria e afiliados). Remova acessos de quem não deva mais ter e informe aos afiliados as regras da comissão. A comissão de afiliado é calculada e congelada no momento da compra.</p>
      </S>

      <S n={8} title="Conteúdo e propriedade intelectual">
        <p>Você declara ter direitos sobre textos, logos e imagens enviados e autoriza a MOVA a exibi-los na plataforma e em materiais de divulgação dos seus eventos (como prévias de compartilhamento).</p>
      </S>

      <S n={9} title="Conduta, suspensão e encerramento">
        <p>A MOVA pode suspender vendas, eventos ou a conta em caso de indício de fraude, informação falsa, descumprimento destes termos ou da lei. Você pode encerrar sua participação a qualquer momento, mantendo as obrigações sobre ingressos já vendidos.</p>
      </S>

      <S n={10} title="Registros e auditoria">
        <p>A MOVA mantém registros de ações sensíveis (aprovações, alterações financeiras, exportações, validações na portaria) com data, hora e IP, para segurança e prestação de contas.</p>
      </S>

      <S n={11} title="Alterações, lei aplicável e foro">
        <p>Estes termos podem ser atualizados; a versão vigente fica nesta página e o aceite guarda a versão. Aplica-se a lei brasileira, com foro em {L(LEGAL.forum)}. Contato: {L(LEGAL.contactEmail)}.</p>
      </S>
    </LegalPage>
  );
}
