import {
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export type ProducerProfileContent = {
  displayName: string;
  description: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  coverUrl?: string | null;
};

// Dados privados da candidatura: nunca expostos antes da aprovação da MOVA.
export type OrganizationApplication = {
  legalName: string; responsibleName: string; email: string; phone: string;
  city: string; instagram?: string | null; website?: string | null; description?: string | null;
  termsAcceptedAt?: string; termsVersion?: string; // aceite dos Termos para produtoras
};

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  passwordSessionVersion: int("password_session_version").notNull().default(0),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: varchar("terms_version", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const emailAuthAccounts = mysqlTable(
  "email_auth_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    userId: int("user_id").references(() => users.id),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ emailUnique: uniqueIndex("email_auth_accounts_email_unique").on(table.email), userIdx: index("email_auth_accounts_user_idx").on(table.userId) }),
);

export const emailAuthTokens = mysqlTable(
  "email_auth_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("account_id").notNull().references(() => emailAuthAccounts.id),
    purpose: mysqlEnum("purpose", ["VERIFY_EMAIL", "RESET_PASSWORD"]).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ tokenUnique: uniqueIndex("email_auth_tokens_token_unique").on(table.tokenHash), accountPurposeIdx: index("email_auth_tokens_account_purpose_idx").on(table.accountId, table.purpose) }),
);

export const googleAuthIdentities = mysqlTable(
  "google_auth_identities",
  {
    id: int("id").autoincrement().primaryKey(),
    googleSub: varchar("google_sub", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    userId: int("user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ subUnique: uniqueIndex("google_auth_identities_sub_unique").on(table.googleSub), userIdx: index("google_auth_identities_user_idx").on(table.userId), emailIdx: index("google_auth_identities_email_idx").on(table.email) }),
);

export const authRateLimits = mysqlTable("auth_rate_limits", {
  keyHash: varchar("key_hash", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("window_started_at").notNull(),
  attempts: int("attempts").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const organizations = mysqlTable(
  "organizations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    document: varchar("document", { length: 20 }).notNull(),
    application: json("application").$type<OrganizationApplication | null>(),
    profileDraft: json("profile_draft").$type<ProducerProfileContent | null>(),
    profilePublished: json("profile_published").$type<ProducerProfileContent | null>(),
    profileStatus: mysqlEnum("profile_status", ["DRAFT", "PENDING_REVIEW", "REJECTED", "PUBLISHED"]).default("DRAFT").notNull(),
    profilePublishedAt: timestamp("profile_published_at"),
    reviewNote: text("review_note"),
    profileReviewNote: text("profile_review_note"),
    // The current InfinitePay checkout API identifies the seller by InfiniteTag/handle.
    // This value is encrypted by the application before it is persisted.
    gatewayCredentialCiphertext: text("gateway_credential_ciphertext"),
    gatewayCredentialConfiguredAt: timestamp("gateway_credential_configured_at"),
    status: mysqlEnum("status", ["PENDING_REVIEW", "ACTIVE", "INACTIVE", "REJECTED"]).default("PENDING_REVIEW").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ documentUnique: uniqueIndex("organizations_document_unique").on(table.document) }),
);

export const events = mysqlTable(
  "events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    bannerUrl: text("banner_url"),
    bannerStorageKey: varchar("banner_storage_key", { length: 500 }),
    description: text("description"),
    locationName: varchar("location_name", { length: 255 }),
    eventDate: timestamp("event_date").notNull(),
    reviewNote: text("review_note"),
    status: mysqlEnum("status", ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FINISHED"]).default("DRAFT").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("events_slug_unique").on(table.slug),
    orgIdx: index("events_organization_idx").on(table.organizationId),
  }),
);

export const lots = mysqlTable(
  "lots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventId: varchar("event_id", { length: 36 }).notNull().references(() => events.id),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    totalQuantity: int("total_quantity").notNull(),
    // Availability excludes both active reservations and approved sales.
    availableQuantity: int("available_quantity").notNull(),
    status: mysqlEnum("status", ["ACTIVE", "PAUSED", "SOLD_OUT"]).default("ACTIVE").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ eventIdx: index("lots_event_idx").on(table.eventId) }),
);

export const affiliates = mysqlTable(
  "affiliates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id),
    eventId: varchar("event_id", { length: 36 }).references(() => events.id),
    name: varchar("name", { length: 255 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 30 }),
    code: varchar("code", { length: 32 }).notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE"]).default("ACTIVE").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("affiliates_code_unique").on(table.code),
    orgIdx: index("affiliates_organization_idx").on(table.organizationId),
    eventIdx: index("affiliates_event_idx").on(table.eventId),
  }),
);

export const orders = mysqlTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventId: varchar("event_id", { length: 36 }).notNull().references(() => events.id),
    affiliateId: varchar("affiliate_id", { length: 36 }).references(() => affiliates.id),
    buyerName: varchar("buyer_name", { length: 255 }).notNull(),
    buyerCpf: varchar("buyer_cpf", { length: 14 }).notNull(),
    buyerEmail: varchar("buyer_email", { length: 320 }).notNull(),
    buyerPhone: varchar("buyer_phone", { length: 30 }).notNull(),
    buyerInstagram: varchar("buyer_instagram", { length: 100 }),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    gatewayFeeAmount: decimal("gateway_fee_amount", { precision: 12, scale: 2 }),
    status: mysqlEnum("status", ["PENDING", "APPROVED", "CANCELLED"]).default("PENDING").notNull(),
    infinitepayCheckoutUrl: text("infinitepay_checkout_url"),
    orderNsu: varchar("order_nsu", { length: 80 }).notNull(),
    transactionNsu: varchar("transaction_nsu", { length: 120 }),
    invoiceSlug: varchar("invoice_slug", { length: 120 }),
    captureMethod: varchar("capture_method", { length: 32 }),
    voucherTokenHash: varchar("voucher_token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    paymentVerifiedAt: timestamp("payment_verified_at"),
    refundedAt: timestamp("refunded_at"),
    termsAcceptedAt: timestamp("terms_accepted_at"),
    termsVersion: varchar("terms_version", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    orderNsuUnique: uniqueIndex("orders_order_nsu_unique").on(table.orderNsu),
    transactionNsuUnique: uniqueIndex("orders_transaction_nsu_unique").on(table.transactionNsu),
    eventIdx: index("orders_event_idx").on(table.eventId),
    statusIdx: index("orders_status_expiry_idx").on(table.status, table.expiresAt),
    affiliateIdx: index("orders_affiliate_idx").on(table.affiliateId),
  }),
);

// One row represents one nominal ticket holder; multiple tickets may share one checkout.
export const orderItems = mysqlTable(
  "order_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
    lotId: varchar("lot_id", { length: 36 }).notNull().references(() => lots.id),
    holderName: varchar("holder_name", { length: 255 }).notNull(),
    holderCpf: varchar("holder_cpf", { length: 14 }).notNull(),
    holderEmail: varchar("holder_email", { length: 320 }).notNull(),
    holderPhone: varchar("holder_phone", { length: 30 }).notNull(),
    holderInstagram: varchar("holder_instagram", { length: 100 }),
    unitAmount: decimal("unit_amount", { precision: 12, scale: 2 }).notNull(),
    commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ orderIdx: index("order_items_order_idx").on(table.orderId), lotIdx: index("order_items_lot_idx").on(table.lotId) }),
);

export const inventoryReservations = mysqlTable(
  "inventory_reservations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
    lotId: varchar("lot_id", { length: 36 }).notNull().references(() => lots.id),
    quantity: int("quantity").notNull(),
    status: mysqlEnum("status", ["HELD", "CONSUMED", "RELEASED"]).default("HELD").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    releasedAt: timestamp("released_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ orderLotUnique: uniqueIndex("reservation_order_lot_unique").on(table.orderId, table.lotId), expiryIdx: index("reservation_expiry_idx").on(table.status, table.expiresAt) }),
);

export const tickets = mysqlTable(
  "tickets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
    orderItemId: varchar("order_item_id", { length: 36 }).notNull().references(() => orderItems.id),
    lotId: varchar("lot_id", { length: 36 }).notNull().references(() => lots.id),
    ticketCode: varchar("ticket_code", { length: 50 }).notNull(),
    verificationHash: varchar("verification_hash", { length: 50 }).notNull(),
    status: mysqlEnum("status", ["VALID", "USED", "CANCELLED"]).default("VALID").notNull(),
    usedAt: timestamp("used_at"),
    usedByStaffId: varchar("used_by_staff_id", { length: 36 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ticketCodeUnique: uniqueIndex("tickets_code_unique").on(table.ticketCode),
    orderItemUnique: uniqueIndex("tickets_order_item_unique").on(table.orderItemId),
    orderIdx: index("tickets_order_idx").on(table.orderId),
    lotIdx: index("tickets_lot_idx").on(table.lotId),
  }),
);

export const staffAccess = mysqlTable(
  "staff_access",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
    eventId: varchar("event_id", { length: 36 }).references(() => events.id),
    role: mysqlEnum("role", ["SUPER_ADMIN", "ORGANIZER", "STAFF_PORTARIA"]).notNull(),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE"]).default("ACTIVE").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ userIdx: index("staff_user_idx").on(table.userId), orgIdx: index("staff_organization_idx").on(table.organizationId), eventIdx: index("staff_event_idx").on(table.eventId) }),
);

export const paymentWebhookEvents = mysqlTable(
  "payment_webhook_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventKey: varchar("event_key", { length: 180 }).notNull(),
    orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["RECEIVED", "VERIFIED", "REJECTED"]).default("RECEIVED").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({ eventKeyUnique: uniqueIndex("webhook_event_key_unique").on(table.eventKey), orderIdx: index("webhook_order_idx").on(table.orderId) }),
);

export const ticketAuditLog = mysqlTable(
  "ticket_audit_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventId: varchar("event_id", { length: 36 }).notNull().references(() => events.id),
    ticketId: varchar("ticket_id", { length: 36 }).references(() => tickets.id),
    staffAccessId: varchar("staff_access_id", { length: 36 }),
    action: varchar("action", { length: 48 }).notNull(),
    detail: varchar("detail", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ eventIdx: index("ticket_audit_event_idx").on(table.eventId), ticketIdx: index("ticket_audit_ticket_idx").on(table.ticketId), createdIdx: index("ticket_audit_created_idx").on(table.createdAt) }),
);

export const securityAuditLog = mysqlTable(
  "security_audit_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    actorType: mysqlEnum("actor_type", ["USER", "SYSTEM"]).notNull(),
    actorUserId: int("actor_user_id"),
    ip: varchar("ip", { length: 45 }),
    action: varchar("action", { length: 64 }).notNull(),
    scopeType: varchar("scope_type", { length: 32 }).notNull(),
    scopeId: varchar("scope_id", { length: 36 }),
    // Somente campos permitidos: nunca CPF, e-mail, tokens, voucher ou payload de webhook.
    summary: json("summary").$type<Record<string, string | number | boolean | null> | null>(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (t) => ({
    scopeIdx: index("security_audit_scope_idx").on(t.scopeType, t.scopeId),
    createdIdx: index("security_audit_created_idx").on(t.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Lot = typeof lots.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type StaffAccess = typeof staffAccess.$inferSelect;
