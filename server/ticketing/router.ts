import { router } from "../_core/trpc";
import { auditRouter } from "./auditRouter";
import { checkinRouter } from "./checkinRouter";
import { masterRouter } from "./masterRouter";
import { eventsRouter, ordersRouter, producersRouter } from "./publicRouter";
import { producerRouter } from "./producerRouter";
import { reportsRouter } from "./reportsRouter";

export const ticketingRouter = router({
  events: eventsRouter,
  producers: producersRouter,
  orders: ordersRouter,
  producer: producerRouter,
  master: masterRouter,
  salesReports: reportsRouter,
  checkin: checkinRouter,
  auditTrail: auditRouter,
});
