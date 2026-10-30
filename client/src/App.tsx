import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import AuthPage from "@/pages/AuthPage";
import PrivacyPage from "@/legal/PrivacyPage";
import TermsPage from "@/legal/TermsPage";
import ProducerTermsPage from "@/legal/ProducerTermsPage";
import EventAdminPage from "@/pages/EventAdminPage";
import GatePage from "@/pages/GatePage";
import MasterPage from "@/pages/MasterPage";
import PainelPage from "@/pages/PainelPage";
import EventPage from "@/pages/EventPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import ProducerApplyPage from "@/pages/ProducerApplyPage";
import ProducerPublicPage from "@/pages/ProducerPublicPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SuccessPage from "@/pages/SuccessPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Ir para o conteúdo</a>
      <SiteHeader />
      <div id="conteudo" className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/entrar" component={AuthPage} />
          <Route path="/esqueci-senha" component={ForgotPasswordPage} />
          <Route path="/verificar-email" component={VerifyEmailPage} />
          <Route path="/redefinir-senha" component={ResetPasswordPage} />
          <Route path="/cadastro/produtora" component={ProducerApplyPage} />
          <Route path="/produtora/:slugId" component={ProducerPublicPage} />
          <Route path="/sucesso/:orderId" component={SuccessPage} />
          <Route path="/privacidade" component={PrivacyPage} />
          <Route path="/termos" component={TermsPage} />
          <Route path="/termos-produtoras" component={ProducerTermsPage} />
          <Route path="/painel" component={PainelPage} />
          <Route path="/painel/evento/:eventId" component={EventAdminPage} />
          <Route path="/portaria/:eventId" component={GatePage} />
          <Route path="/master" component={MasterPage} />
          <Route path="/:slug" component={EventPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <SiteFooter />
      <Toaster richColors position="top-center" />
    </div>
  );
}
