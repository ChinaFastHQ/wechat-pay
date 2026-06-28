import { afterEach, describe, expect, it, vi } from "vitest";
import { createExpoWeChatPay } from "./index";
import { setNativeWeChatPayModuleForTests } from "./native";

afterEach(() => setNativeWeChatPayModuleForTests(undefined));

describe("Expo WeChat Pay", () => {
  it("creates an App Pay order and launches the native SDK", async () => {
    const pay = vi.fn(async () => ({ errorCode: 0, cancelled: false }));
    setNativeWeChatPayModuleForTests({ isInstalled: async () => true, pay });
    const payments = createExpoWeChatPay({
      appId: "wx123",
      apiBaseUrl: "https://api.example.com",
      fetch: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              orderId: "order_1",
              channel: "app",
              payload: {
                appId: "wx123",
                partnerId: "merchant",
                prepayId: "prepay",
                package: "Sign=WXPay",
                nonceStr: "nonce",
                timestamp: "1",
                sign: "signature",
              },
            }),
          ),
      ) as typeof fetch,
    });
    await expect(payments.pay({ productId: "coffee" })).resolves.toMatchObject({
      status: "success",
      channel: "app",
    });
    expect(pay).toHaveBeenCalledOnce();
  });
});
