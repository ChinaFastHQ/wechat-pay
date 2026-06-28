import { randomUUID } from "node:crypto";
import type { PaymentLaunch, PaymentStatus, WeChatPayProduct } from "@chinafast/core-wechat-pay";
import { WeChatPayServerError } from "./errors";
import type {
  CreateOrderInput,
  QueryOrderInput,
  RefundInput,
  VerifyWebhookInput,
  WeChatPayServer,
  WeChatPayServerConfig,
} from "./types";

export class MockWeChatPayServer implements WeChatPayServer {
  private readonly orders = new Map<string, PaymentStatus>();
  constructor(private readonly config: WeChatPayServerConfig) {}
  listProducts(): WeChatPayProduct[] {
    return Object.entries(this.config.products ?? {}).map(([id, product]) => ({
      id,
      amount: product.amount,
      currency: product.currency,
      subject: product.subject,
      description: product.description,
    }));
  }
  async createOrder(input: CreateOrderInput): Promise<PaymentLaunch> {
    if (input.productId && !this.config.products?.[input.productId])
      throw new WeChatPayServerError("UNKNOWN_PRODUCT", `Unknown productId ${input.productId}.`);
    const orderId = `mock_${randomUUID()}`;
    this.orders.set(orderId, { orderId, status: "pending", raw: input });
    const base = {
      orderId,
      channel: input.channel,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    };
    if (input.channel === "app")
      return {
        ...base,
        channel: "app",
        payload: {
          appId: "wx-mock",
          partnerId: "merchant-mock",
          prepayId: `prepay_${orderId}`,
          package: "Sign=WXPay",
          nonceStr: "mock-nonce",
          timestamp: `${Math.floor(Date.now() / 1000)}`,
          sign: "mock-sign",
        },
      };
    if (input.channel === "h5")
      return {
        ...base,
        channel: "h5",
        payload: { h5Url: `https://mock.wechat-pay.test/h5/${orderId}` },
      };
    if (input.channel === "jsapi")
      return {
        ...base,
        channel: "jsapi",
        payload: {
          appId: "wx-mock",
          timeStamp: `${Math.floor(Date.now() / 1000)}`,
          nonceStr: "mock-nonce",
          package: `prepay_id=prepay_${orderId}`,
          signType: "RSA",
          paySign: "mock-sign",
        },
      };
    return {
      ...base,
      channel: "native",
      payload: { codeUrl: `weixin://wxpay/bizpayurl?pr=${orderId}` },
    };
  }
  async queryOrder(input: QueryOrderInput) {
    const id = input.orderId ?? input.transactionId;
    return (
      this.orders.get(id) ?? {
        orderId: input.orderId ?? "",
        transactionId: input.transactionId,
        status: "unknown" as const,
      }
    );
  }
  async closeOrder(orderId: string) {
    const status = { ...(this.orders.get(orderId) ?? { orderId }), status: "closed" as const };
    this.orders.set(orderId, status);
    return status;
  }
  async refund(input: RefundInput) {
    return { refundId: input.refundId, status: "success" as const, raw: input };
  }
  async verifyWebhook(input: VerifyWebhookInput) {
    const raw = JSON.parse(
      Buffer.isBuffer(input.rawBody) ? input.rawBody.toString("utf8") : input.rawBody,
    );
    const event = {
      type: raw.type ?? "order.paid",
      orderId: raw.orderId,
      transactionId: raw.transactionId,
      amount: raw.amount,
      currency: raw.currency,
      raw,
    };
    if (event.orderId && event.type === "order.paid")
      this.orders.set(event.orderId, {
        orderId: event.orderId,
        transactionId: event.transactionId,
        status: "paid",
        raw,
      });
    return { valid: true as const, event, raw };
  }
}
