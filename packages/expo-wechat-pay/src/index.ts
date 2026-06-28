import {
  createWeChatPayClient,
  WeChatPayError,
  type CreatePaymentInput,
  type PaymentController,
  type PaymentResult,
  type PaymentStatus,
  type WatchOptions,
  type WeChatPayClientConfig,
} from "@chinafast/core-wechat-pay";
import { getNativeWeChatPayModule } from "./native";

export type ExpoWeChatPayConfig = WeChatPayClientConfig & {
  appId: string;
  universalLink?: string;
  pollIntervalMs?: number;
};

export function createExpoWeChatPay(config: ExpoWeChatPayConfig) {
  if (!config.appId)
    throw new WeChatPayError("NOT_CONFIGURED", "A WeChat Open Platform appId is required.");
  const client = createWeChatPayClient(config);
  const pollIntervalMs = config.pollIntervalMs ?? 2500;
  return {
    client,
    isInstalled: () => getNativeWeChatPayModule().isInstalled(),
    async pay(input: CreatePaymentInput): Promise<PaymentResult> {
      const native = getNativeWeChatPayModule();
      if (!(await native.isInstalled())) {
        throw new WeChatPayError("WECHAT_NOT_INSTALLED", "WeChat is not installed on this device.");
      }
      const launch = await client.createPayment({ ...input, channel: "app" });
      if (launch.channel !== "app") {
        throw new WeChatPayError(
          "INVALID_RESPONSE",
          "The payment server did not return an App Pay payload.",
        );
      }
      const response = await native.pay({
        appId: config.appId,
        universalLink: config.universalLink,
        payload: { ...launch.payload, packageValue: launch.payload.package },
      });
      return {
        ...launch,
        status: response.cancelled ? "cancelled" : response.errorCode === 0 ? "success" : "failed",
        shouldVerifyWithServer: true,
      };
    },
    watch(
      orderId: string,
      onStatus: (status: PaymentStatus) => void,
      options: Omit<WatchOptions, "intervalMs"> & { intervalMs?: number } = {},
    ): PaymentController {
      return client.watch(orderId, onStatus, {
        ...options,
        intervalMs: options.intervalMs ?? pollIntervalMs,
      });
    },
  };
}

export type ExpoWeChatPay = ReturnType<typeof createExpoWeChatPay>;
export * from "./native";
export type * from "@chinafast/core-wechat-pay";
