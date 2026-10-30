import { router } from "./_core/trpc";
import { authRouter } from "./auth/router";
import { ticketingRouter } from "./ticketing/router";

export const appRouter = router({ auth: authRouter, ticketing: ticketingRouter });
export type AppRouter = typeof appRouter;
