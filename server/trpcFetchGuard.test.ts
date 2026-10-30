import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import { describe, expect, it } from "vitest";
import superjson from "superjson";
import { createTrpcFetchGuard } from "../client/src/lib/trpcFetchGuard";

const batchUrl = "https://mova.example/api/trpc/ticketing.orders.create,ticketing.events.bySlug?batch=1";

describe("tRPC response guard", () => {
  it("converts an HTML batch response into actionable tRPC JSON errors", async () => {
    const guard = createTrpcFetchGuard(async () => new Response("<!DOCTYPE html><title>Error</title>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));

    const response = await guard(batchUrl);
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toHaveLength(2);
    expect(payload[0].error.json.message).toContain("ticketing.orders.create");
    expect(payload[0].error.json.message).toContain("HTTP 404");
    expect(payload[0].error.json.data).toMatchObject({ code: "INTERNAL_SERVER_ERROR", httpStatus: 502 });
    expect(payload[1].error.json.message).toContain("ticketing.events.bySlug");
  });

  it("converts invalid JSON even when the endpoint mislabels it as JSON", async () => {
    const guard = createTrpcFetchGuard(async () => new Response("<!DOCTYPE html>", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const response = await guard(batchUrl);
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload[0].error.json.message).toContain("resposta não JSON");
  });

  it("passes through valid tRPC JSON unchanged", async () => {
    const original = new Response(JSON.stringify([{ result: { data: { json: { ok: true } } } }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const guard = createTrpcFetchGuard(async () => original);

    const response = await guard(batchUrl);
    expect(response).toBe(original);
    expect(await response.json()).toEqual([{ result: { data: { json: { ok: true } } } }]);
  });

  it("surfaces a readable TRPCClientError instead of a JSON.parse error for HTML responses", async () => {
    const guard = createTrpcFetchGuard(async () => new Response("<!DOCTYPE html><title>Preview fallback</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
    const client = createTRPCUntypedClient({
      links: [httpBatchLink({ url: "https://mova.example/api/trpc", transformer: superjson, fetch: guard })],
    });

    await expect(client.mutation("ticketing.orders.create", {})).rejects.toMatchObject({
      message: expect.stringContaining("ticketing.orders.create (HTTP 200)"),
    });
  });
});
