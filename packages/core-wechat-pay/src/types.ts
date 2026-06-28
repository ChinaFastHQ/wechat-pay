export type WeChatPayChannel = "app" | "h5" | "jsapi" | "native";

export type WeChatPayEnvironment = {
  runtime: "native" | "web";
  device: "mobile" | "desktop" | "tablet" | "unknown";
  inWeChat: boolean;
};

export type WeChatPayProduct = {
  id: string;
  amount: number;
  currency: "CNY";
  subject: string;
  description?: string;
};

export type CreatePaymentInput = {
  productId?: string;
  amount?: number;
  currency?: "CNY";
  subject?: string;
  description?: string;
  openId?: string;
  clientIp?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
  channel?: WeChatPayChannel;
};

export type WeChatAppPayPayload = {
  appId: string;
  partnerId: string;
  prepayId: string;
  package: "Sign=WXPay";
  nonceStr: string;
  timestamp: string;
  sign: string;
};

export type WeChatH5PayPayload = { h5Url: string };
export type WeChatJsApiPayPayload = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
};
export type WeChatNativePayPayload = { codeUrl: string };

export type PaymentLaunch =
  | { orderId: string; channel: "app"; payload: WeChatAppPayPayload; expiresAt?: string }
  | { orderId: string; channel: "h5"; payload: WeChatH5PayPayload; expiresAt?: string }
  | { orderId: string; channel: "jsapi"; payload: WeChatJsApiPayPayload; expiresAt?: string }
  | { orderId: string; channel: "native"; payload: WeChatNativePayPayload; expiresAt?: string };

export type PaymentStatus = {
  orderId: string;
  status: "pending" | "paid" | "closed" | "failed" | "unknown";
  transactionId?: string;
  paidAt?: string;
  raw?: unknown;
};

export type PaymentResult = PaymentLaunch extends infer Launch
  ? Launch extends PaymentLaunch
    ? Launch & {
        status: "started" | "success" | "cancelled" | "failed";
        shouldVerifyWithServer: true;
      }
    : never
  : never;

export type WeChatPayClientConfig = {
  apiBaseUrl: string;
  basePath?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
};

export type WeChatPayErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_INPUT"
  | "UNSUPPORTED_ENVIRONMENT"
  | "WECHAT_NOT_INSTALLED"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_FAILED"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export type WatchOptions = {
  intervalMs?: number;
  signal?: AbortSignal;
};

export type PaymentController = { stop: () => void };

export type PaymentStatusFilter = PaymentStatus["status"];

export const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatusFilter> = new Set([
  "paid",
  "closed",
  "failed",
]);
