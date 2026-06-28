import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { encryptResourceForTest, rsaSign } from "./crypto";
import { createWeChatPayServer } from "./server";

describe("server WeChat Pay", () => {
  it("runs all one-time channels in mock mode", async () => {
    const server = createWeChatPayServer({
      mode: "mock",
      products: { coffee: { amount: 300, currency: "CNY", subject: "Coffee" } },
    });
    for (const channel of ["app", "h5", "jsapi", "native"] as const) {
      const order = await server.createOrder({ productId: "coffee", channel });
      expect(order.payload).toBeTruthy();
      await expect(server.queryOrder({ orderId: order.orderId })).resolves.toMatchObject({
        status: "pending",
      });
    }
  });

  it("signs live requests and creates an App Pay payload", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ prepay_id: "prepay_1" })));
    const server = createWeChatPayServer({
      mode: "live",
      fetch: fetcher as typeof fetch,
      credentials: {
        appId: "wx123",
        merchantId: "190000",
        apiV3Key: "12345678901234567890123456789012",
        privateKey,
        certificateSerialNo: "SERIAL",
        platformCertificates: { SERIAL: "unused" },
        notifyUrl: "https://example.com/webhook",
        baseUrl: "https://wechat.test",
      },
    });
    await expect(server.createOrder({ productId: "coffee", channel: "app" })).rejects.toMatchObject(
      { code: "UNKNOWN_PRODUCT" },
    );
    const custom = await server.createOrder({
      amount: 300,
      currency: "CNY",
      subject: "Coffee",
      channel: "app",
    });
    expect(custom).toMatchObject({
      channel: "app",
      payload: { appId: "wx123", prepayId: "prepay_1" },
    });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: expect.stringContaining("WECHATPAY2-SHA256-RSA2048"),
    });
  });

  it("verifies and decrypts a signed webhook", async () => {
    const keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const key = "12345678901234567890123456789012";
    const body = JSON.stringify({
      event_type: "TRANSACTION.SUCCESS",
      resource: encryptResourceForTest(key, {
        out_trade_no: "order_1",
        transaction_id: "tx_1",
        amount: { total: 300, currency: "CNY" },
      }),
    });
    const timestamp = "1710000000";
    const requestNonce = "nonce";
    const server = createWeChatPayServer({
      mode: "live",
      fetch: vi.fn() as typeof fetch,
      credentials: {
        appId: "wx123",
        merchantId: "190000",
        apiV3Key: key,
        privateKey: keys.privateKey,
        certificateSerialNo: "merchant",
        platformCertificates: { platform: keys.publicKey },
        notifyUrl: "https://example.com/webhook",
      },
    });
    await expect(
      server.verifyWebhook({
        rawBody: body,
        headers: {
          "wechatpay-timestamp": timestamp,
          "wechatpay-nonce": requestNonce,
          "wechatpay-serial": "platform",
          "wechatpay-signature": rsaSign(
            keys.privateKey,
            `${timestamp}\n${requestNonce}\n${body}\n`,
          ),
        },
      }),
    ).resolves.toMatchObject({
      valid: true,
      event: { type: "order.paid", orderId: "order_1", amount: 300 },
    });
  });
});
