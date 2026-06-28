import type {
  CreatePaymentInput,
  PaymentLaunch,
  PaymentStatus,
  WeChatPayProduct,
} from "@chinafast/core-wechat-pay";

export type ProductConfig = Omit<WeChatPayProduct, "id">;
export type CreateOrderInput = CreatePaymentInput & {
  channel: NonNullable<CreatePaymentInput["channel"]>;
};

export type WeChatPayCredentials = {
  appId: string;
  merchantId: string;
  apiV3Key: string;
  privateKey: string;
  certificateSerialNo: string;
  platformCertificates: Record<string, string>;
  notifyUrl: string;
  baseUrl?: string;
};

export type WeChatPayServerConfig = {
  mode: "mock" | "live";
  credentials?: Partial<WeChatPayCredentials>;
  products?: Record<string, ProductConfig>;
  fetch?: typeof fetch;
};

export type QueryOrderInput =
  | { orderId: string; transactionId?: never }
  | { orderId?: never; transactionId: string };
export type RefundInput = {
  orderId: string;
  refundId: string;
  amount: number;
  totalAmount: number;
  reason?: string;
  notifyUrl?: string;
};
export type RefundResult = {
  refundId: string;
  status: "processing" | "success" | "closed" | "abnormal";
  raw?: unknown;
};
export type VerifyWebhookInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string | Buffer;
};
export type WeChatPayWebhookEvent = {
  type: "order.paid" | "order.closed" | "order.failed" | "refund.updated" | "unknown";
  orderId?: string;
  transactionId?: string;
  amount?: number;
  currency?: "CNY";
  raw: unknown;
};
export type WebhookResult = { valid: true; event: WeChatPayWebhookEvent; raw: unknown };

export type WeChatPayServer = {
  createOrder(input: CreateOrderInput): Promise<PaymentLaunch>;
  queryOrder(input: QueryOrderInput): Promise<PaymentStatus>;
  closeOrder(orderId: string): Promise<PaymentStatus>;
  refund(input: RefundInput): Promise<RefundResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookResult>;
  listProducts(): WeChatPayProduct[];
};
