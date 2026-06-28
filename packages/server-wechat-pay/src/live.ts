import { randomUUID } from "node:crypto";
import type { PaymentLaunch, PaymentStatus, WeChatPayChannel } from "@chinafast/core-wechat-pay";
import { decryptResource, nonce, rsaSign, rsaVerify } from "./crypto";
import { WeChatPayServerError } from "./errors";
import type {
  CreateOrderInput,
  QueryOrderInput,
  RefundInput,
  RefundResult,
  VerifyWebhookInput,
  WeChatPayCredentials,
  WeChatPayServer,
  WeChatPayServerConfig,
  WeChatPayWebhookEvent,
  WebhookResult,
} from "./types";

type Json = Record<string, any>;

function requiredCredentials(input?: Partial<WeChatPayCredentials>): WeChatPayCredentials {
  const names: Array<keyof WeChatPayCredentials> = [
    "appId",
    "merchantId",
    "apiV3Key",
    "privateKey",
    "certificateSerialNo",
    "platformCertificates",
    "notifyUrl",
  ];
  for (const name of names) {
    if (!input?.[name])
      throw new WeChatPayServerError(
        "INVALID_CONFIG",
        `credentials.${name} is required in live mode.`,
      );
  }
  return { baseUrl: "https://api.mch.weixin.qq.com", ...input } as WeChatPayCredentials;
}

function tradeStatus(value: string | undefined): PaymentStatus["status"] {
  if (value === "SUCCESS") return "paid";
  if (value === "CLOSED" || value === "REVOKED") return "closed";
  if (value === "PAYERROR") return "failed";
  if (value === "NOTPAY" || value === "USERPAYING") return "pending";
  return "unknown";
}

function refundStatus(value: string | undefined): RefundResult["status"] {
  if (value === "SUCCESS") return "success";
  if (value === "CLOSED") return "closed";
  if (value === "ABNORMAL") return "abnormal";
  return "processing";
}

export class LiveWeChatPayServer implements WeChatPayServer {
  private readonly credentials: WeChatPayCredentials;
  private readonly fetcher: typeof fetch;
  constructor(private readonly config: WeChatPayServerConfig) {
    this.credentials = requiredCredentials(config.credentials);
    this.fetcher = config.fetch ?? globalThis.fetch;
    if (!this.fetcher)
      throw new WeChatPayServerError("INVALID_CONFIG", "A fetch implementation is required.");
  }

  listProducts() {
    return Object.entries(this.config.products ?? {}).map(([id, product]) => ({
      id,
      amount: product.amount,
      currency: product.currency,
      subject: product.subject,
      description: product.description,
    }));
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentLaunch> {
    const product = input.productId ? this.config.products?.[input.productId] : undefined;
    if (input.productId && !product)
      throw new WeChatPayServerError("UNKNOWN_PRODUCT", `Unknown productId ${input.productId}.`);
    const amount = product?.amount ?? input.amount;
    const subject = product?.subject ?? input.subject;
    if (!Number.isInteger(amount) || (amount ?? 0) <= 0 || !subject) {
      throw new WeChatPayServerError(
        "INVALID_ORDER",
        "A positive integer amount in fen and subject are required.",
      );
    }
    if (input.channel === "jsapi" && !input.openId) {
      throw new WeChatPayServerError("INVALID_ORDER", "openId is required for JSAPI payments.");
    }
    if (input.channel === "h5" && !input.clientIp) {
      throw new WeChatPayServerError("INVALID_ORDER", "clientIp is required for H5 payments.");
    }
    const orderId = randomUUID().replace(/-/g, "");
    const body: Json = {
      appid: this.credentials.appId,
      mchid: this.credentials.merchantId,
      description: subject,
      out_trade_no: orderId,
      notify_url: this.credentials.notifyUrl,
      amount: { total: amount, currency: "CNY" },
    };
    if (input.metadata) body.attach = JSON.stringify(input.metadata).slice(0, 128);
    if (input.channel === "jsapi") body.payer = { openid: input.openId };
    if (input.channel === "h5")
      body.scene_info = { payer_client_ip: input.clientIp, h5_info: { type: "Wap" } };
    const response = await this.request("POST", `/v3/pay/transactions/${input.channel}`, body);
    const payload = this.launchPayload(input.channel, response, input.returnUrl);
    return {
      orderId,
      channel: input.channel,
      payload,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    } as PaymentLaunch;
  }

  async queryOrder(input: QueryOrderInput): Promise<PaymentStatus> {
    const byTransaction = Boolean(input.transactionId);
    const id = input.transactionId ?? input.orderId ?? "";
    const segment = byTransaction ? "id" : "out-trade-no";
    const response = await this.request(
      "GET",
      `/v3/pay/transactions/${segment}/${encodeURIComponent(id)}?mchid=${encodeURIComponent(this.credentials.merchantId)}`,
    );
    return {
      orderId: response.out_trade_no ?? input.orderId ?? "",
      transactionId: response.transaction_id,
      status: tradeStatus(response.trade_state),
      paidAt: response.success_time,
      raw: response,
    };
  }

  async closeOrder(orderId: string): Promise<PaymentStatus> {
    await this.request(
      "POST",
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderId)}/close`,
      { mchid: this.credentials.merchantId },
      true,
    );
    return { orderId, status: "closed" };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (
      !Number.isInteger(input.amount) ||
      input.amount <= 0 ||
      !Number.isInteger(input.totalAmount) ||
      input.totalAmount < input.amount
    ) {
      throw new WeChatPayServerError(
        "INVALID_REFUND",
        "Refund and total amounts must be valid integer values in fen.",
      );
    }
    const response = await this.request("POST", "/v3/refund/domestic/refunds", {
      out_trade_no: input.orderId,
      out_refund_no: input.refundId,
      reason: input.reason,
      notify_url: input.notifyUrl,
      amount: { refund: input.amount, total: input.totalAmount, currency: "CNY" },
    });
    return {
      refundId: response.out_refund_no ?? input.refundId,
      status: refundStatus(response.status),
      raw: response,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<WebhookResult> {
    const timestamp = this.header(input.headers, "wechatpay-timestamp");
    const requestNonce = this.header(input.headers, "wechatpay-nonce");
    const signature = this.header(input.headers, "wechatpay-signature");
    const serial = this.header(input.headers, "wechatpay-serial");
    const certificate = this.credentials.platformCertificates[serial];
    if (!certificate)
      throw new WeChatPayServerError(
        "UNKNOWN_CERTIFICATE",
        `No platform certificate is configured for serial ${serial}.`,
      );
    const raw = Buffer.isBuffer(input.rawBody) ? input.rawBody.toString("utf8") : input.rawBody;
    if (!rsaVerify(certificate, `${timestamp}\n${requestNonce}\n${raw}\n`, signature)) {
      throw new WeChatPayServerError(
        "INVALID_SIGNATURE",
        "The WeChat webhook signature is invalid.",
      );
    }
    let envelope: Json;
    try {
      envelope = JSON.parse(raw);
    } catch (cause) {
      throw new WeChatPayServerError("INVALID_WEBHOOK", "The webhook body is invalid JSON.", cause);
    }
    const decrypted = decryptResource(this.credentials.apiV3Key, envelope.resource);
    return {
      valid: true,
      event: this.normalizeEvent(envelope.event_type, decrypted),
      raw: envelope,
    };
  }

  private launchPayload(channel: WeChatPayChannel, response: Json, returnUrl?: string) {
    if (channel === "h5") {
      const separator = response.h5_url?.includes("?") ? "&" : "?";
      return {
        h5Url:
          returnUrl && response.h5_url
            ? `${response.h5_url}${separator}redirect_url=${encodeURIComponent(returnUrl)}`
            : response.h5_url,
      };
    }
    if (channel === "native") return { codeUrl: response.code_url };
    const prepayId = response.prepay_id;
    if (!prepayId)
      throw new WeChatPayServerError("INVALID_RESPONSE", "WeChat did not return prepay_id.");
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const nonceStr = nonce(16);
    if (channel === "app") {
      return {
        appId: this.credentials.appId,
        partnerId: this.credentials.merchantId,
        prepayId,
        package: "Sign=WXPay" as const,
        nonceStr,
        timestamp,
        sign: rsaSign(
          this.credentials.privateKey,
          `${this.credentials.appId}\n${timestamp}\n${nonceStr}\n${prepayId}\n`,
        ),
      };
    }
    const packageValue = `prepay_id=${prepayId}`;
    return {
      appId: this.credentials.appId,
      timeStamp: timestamp,
      nonceStr,
      package: packageValue,
      signType: "RSA" as const,
      paySign: rsaSign(
        this.credentials.privateKey,
        `${this.credentials.appId}\n${timestamp}\n${nonceStr}\n${packageValue}\n`,
      ),
    };
  }

  private async request(
    method: string,
    path: string,
    body?: Json,
    allowEmpty = false,
  ): Promise<Json> {
    const bodyText = body
      ? JSON.stringify(
          Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)),
        )
      : "";
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const requestNonce = nonce(16);
    const message = `${method}\n${path}\n${timestamp}\n${requestNonce}\n${bodyText}\n`;
    const token = `mchid="${this.credentials.merchantId}",nonce_str="${requestNonce}",timestamp="${timestamp}",serial_no="${this.credentials.certificateSerialNo}",signature="${rsaSign(this.credentials.privateKey, message)}"`;
    let response: Response;
    try {
      response = await this.fetcher(`${this.credentials.baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `WECHATPAY2-SHA256-RSA2048 ${token}`,
          "User-Agent": "@chinafast/server-wechat-pay",
        },
        body: bodyText || undefined,
      });
    } catch (cause) {
      throw new WeChatPayServerError("NETWORK_ERROR", "Could not reach WeChat Pay.", cause);
    }
    const text = await response.text();
    let result: Json = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch (cause) {
      throw new WeChatPayServerError(
        "INVALID_RESPONSE",
        "WeChat Pay returned invalid JSON.",
        cause,
      );
    }
    if (!response.ok)
      throw new WeChatPayServerError(
        result.code ?? "WECHAT_API_ERROR",
        result.message ?? `WeChat Pay returned HTTP ${response.status}.`,
        result,
      );
    if (!text && !allowEmpty)
      throw new WeChatPayServerError("INVALID_RESPONSE", "WeChat Pay returned an empty response.");
    return result;
  }

  private header(headers: VerifyWebhookInput["headers"], name: string): string {
    const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
    const value = Array.isArray(entry) ? entry[0] : entry;
    if (!value) throw new WeChatPayServerError("INVALID_WEBHOOK", `Missing ${name} header.`);
    return value;
  }

  private normalizeEvent(type: string, raw: any): WeChatPayWebhookEvent {
    if (type === "TRANSACTION.SUCCESS")
      return {
        type: "order.paid",
        orderId: raw.out_trade_no,
        transactionId: raw.transaction_id,
        amount: raw.amount?.total,
        currency: raw.amount?.currency,
        raw,
      };
    if (type === "TRANSACTION.CLOSED")
      return { type: "order.closed", orderId: raw.out_trade_no, raw };
    if (type === "TRANSACTION.FAIL")
      return { type: "order.failed", orderId: raw.out_trade_no, raw };
    if (type?.startsWith("REFUND."))
      return { type: "refund.updated", orderId: raw.out_trade_no, raw };
    return { type: "unknown", raw };
  }
}
