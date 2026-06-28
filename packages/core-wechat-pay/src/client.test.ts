import { describe, expect, it, vi } from "vitest";
import { createWeChatPayClient } from "./client";
import { resolveWeChatPayChannel } from "./channel";

describe("core WeChat Pay", () => {
  it("selects each one-time payment channel", () => {
    expect(resolveWeChatPayChannel({ runtime: "native", device: "mobile", inWeChat: false })).toBe(
      "app",
    );
    expect(resolveWeChatPayChannel({ runtime: "web", device: "mobile", inWeChat: true })).toBe(
      "jsapi",
    );
    expect(resolveWeChatPayChannel({ runtime: "web", device: "mobile", inWeChat: false })).toBe(
      "h5",
    );
    expect(resolveWeChatPayChannel({ runtime: "web", device: "desktop", inWeChat: false })).toBe(
      "native",
    );
  });

  it("creates and queries a payment", async () => {
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/orders")
              ? { orderId: "order_1", channel: "native", payload: { codeUrl: "weixin://pay" } }
              : { orderId: "order_1", status: "pending" },
          ),
        ),
    );
    const client = createWeChatPayClient({
      apiBaseUrl: "https://api.example.com/",
      fetch: fetcher as typeof fetch,
    });
    await client.createPayment({ productId: "coffee", channel: "native" });
    await client.getPayment("order 1");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/wechat-pay/orders",
      "https://api.example.com/wechat-pay/orders/order%201",
    ]);
  });

  it("stops polling once a terminal status is reported", async () => {
    vi.useFakeTimers();
    const statuses = [{ status: "pending" }, { status: "pending" }, { status: "paid" }];
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ orderId: "order_1", ...statuses.shift() })),
    );
    const client = createWeChatPayClient({
      apiBaseUrl: "https://api.example.com",
      fetch: fetcher as typeof fetch,
    });
    const seen: string[] = [];
    const controller = client.watch("order_1", (s) => seen.push(s.status), { intervalMs: 500 });
    await vi.advanceTimersByTimeAsync(2000);
    controller.stop();
    expect(seen).toEqual(["pending", "pending", "paid"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("aborts polling via an AbortSignal", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ orderId: "order_1", status: "pending" })),
    );
    const client = createWeChatPayClient({
      apiBaseUrl: "https://api.example.com",
      fetch: fetcher as typeof fetch,
    });
    const seen: string[] = [];
    const controller = new AbortController();
    client.watch("order_1", (s) => seen.push(s.status), {
      intervalMs: 500,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(600);
    controller.abort();
    const callsBefore = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher.mock.calls.length).toBe(callsBefore);
    vi.useRealTimers();
  });
});
