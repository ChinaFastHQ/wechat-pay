import { afterEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { createWebWeChatPay, detectWebWeChatPayEnvironment } from "./browser";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async (text: string) => `data:png;${text}`) },
}));

afterEach(() => vi.restoreAllMocks());

function mockResponse(body: unknown) {
  return {
    fetch: vi.fn(async () => new Response(JSON.stringify(body))) as typeof fetch,
  };
}

describe("web WeChat Pay", () => {
  it("detects WeChat and regular mobile browsers", () => {
    expect(detectWebWeChatPayEnvironment("iPhone MicroMessenger")).toMatchObject({
      device: "mobile",
      inWeChat: true,
    });
    expect(detectWebWeChatPayEnvironment("Android Chrome")).toMatchObject({
      device: "mobile",
      inWeChat: false,
    });
  });

  it("returns a QR launch on desktop with a pre-rendered data URL", async () => {
    const { fetch } = mockResponse({
      orderId: "order_1",
      channel: "native",
      payload: { codeUrl: "weixin://pay" },
    });
    const payments = createWebWeChatPay({
      apiBaseUrl: "https://api.example.com",
      environment: () => ({ runtime: "web", device: "desktop", inWeChat: false }),
      fetch,
    });
    const result = await payments.pay({ productId: "coffee" });
    expect(result).toMatchObject({ channel: "native", status: "started" });
    expect(result.qr).toBe("data:png;weixin://pay");
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      "weixin://pay",
      expect.objectContaining({ width: 260, margin: 1 }),
    );
  });

  it("skips QR generation when qr config is false", async () => {
    const { fetch } = mockResponse({
      orderId: "order_1",
      channel: "native",
      payload: { codeUrl: "weixin://pay" },
    });
    const payments = createWebWeChatPay({
      apiBaseUrl: "https://api.example.com",
      environment: () => ({ runtime: "web", device: "desktop", inWeChat: false }),
      qr: false,
      fetch,
    });
    const result = await payments.pay({ productId: "coffee" });
    expect(result.qr).toBeUndefined();
  });

  it("invokes WeixinJSBridge in the WeChat browser", async () => {
    window.WeixinJSBridge = {
      invoke: (_name, _payload, done) => done({ err_msg: "get_brand_wcpay_request:ok" }),
    };
    const { fetch } = mockResponse({
      orderId: "order_1",
      channel: "jsapi",
      payload: {
        appId: "wx",
        timeStamp: "1",
        nonceStr: "n",
        package: "prepay_id=p",
        signType: "RSA",
        paySign: "s",
      },
    });
    const payments = createWebWeChatPay({
      apiBaseUrl: "https://api.example.com",
      environment: () => ({ runtime: "web", device: "mobile", inWeChat: true }),
      fetch,
    });
    await expect(payments.pay({ productId: "coffee", openId: "openid" })).resolves.toMatchObject({
      status: "success",
    });
  });

  it("polls the server until the order reaches a terminal status", async () => {
    vi.useFakeTimers();
    const responses = [
      { orderId: "order_1", status: "pending" },
      { orderId: "order_1", status: "paid" },
    ];
    const fetch = vi.fn(async () => new Response(JSON.stringify(responses.shift()))) as typeof fetch;
    const payments = createWebWeChatPay({
      apiBaseUrl: "https://api.example.com",
      environment: () => ({ runtime: "web", device: "desktop", inWeChat: false }),
      qr: false,
      fetch,
    });
    const seen: string[] = [];
    const controller = payments.watch("order_1", (s) => seen.push(s.status), { intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1500);
    controller.stop();
    expect(seen).toEqual(["pending", "paid"]);
    vi.useRealTimers();
  });
});
