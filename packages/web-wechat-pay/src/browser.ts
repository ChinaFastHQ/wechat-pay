import QRCode from "qrcode";
import {
  createWeChatPayClient,
  resolveWeChatPayChannel,
  WeChatPayError,
  type CreatePaymentInput,
  type PaymentController,
  type PaymentLaunch,
  type PaymentResult,
  type PaymentStatus,
  type WatchOptions,
  type WeChatJsApiPayPayload,
  type WeChatPayClientConfig,
  type WeChatPayEnvironment,
} from "@chinafast/core-wechat-pay";

type BridgeResult = { err_msg?: string };
type WeixinBridge = {
  invoke(
    name: "getBrandWCPayRequest",
    payload: WeChatJsApiPayPayload,
    callback: (result: BridgeResult) => void,
  ): void;
};

declare global {
  interface Window {
    WeixinJSBridge?: WeixinBridge;
  }
}

export function detectWebWeChatPayEnvironment(
  userAgent = globalThis.navigator?.userAgent ?? "",
): WeChatPayEnvironment {
  const tablet = /iPad|Tablet/i.test(userAgent);
  const mobile = /Android|iPhone|iPod|Mobile/i.test(userAgent);
  return {
    runtime: "web",
    device: tablet ? "tablet" : mobile ? "mobile" : "desktop",
    inWeChat: /MicroMessenger/i.test(userAgent),
  };
}

async function getBridge(timeoutMs: number): Promise<WeixinBridge> {
  if (window.WeixinJSBridge) return window.WeixinJSBridge;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      document.removeEventListener("WeixinJSBridgeReady", ready);
      reject(
        new WeChatPayError("UNSUPPORTED_ENVIRONMENT", "WeixinJSBridge did not become available."),
      );
    }, timeoutMs);
    function ready() {
      window.clearTimeout(timeout);
      document.removeEventListener("WeixinJSBridgeReady", ready);
      if (window.WeixinJSBridge) resolve(window.WeixinJSBridge);
      else reject(new WeChatPayError("UNSUPPORTED_ENVIRONMENT", "WeixinJSBridge is unavailable."));
    }
    document.addEventListener("WeixinJSBridgeReady", ready);
  });
}

async function launchJsApi(
  launch: Extract<PaymentLaunch, { channel: "jsapi" }>,
  timeoutMs: number,
): Promise<PaymentResult> {
  const bridge = await getBridge(timeoutMs);
  return new Promise((resolve, reject) => {
    bridge.invoke("getBrandWCPayRequest", launch.payload, (response) => {
      const state = response.err_msg?.split(":").at(-1);
      if (state === "ok") {
        resolve({ ...launch, status: "success", shouldVerifyWithServer: true });
      } else if (state === "cancel") {
        resolve({ ...launch, status: "cancelled", shouldVerifyWithServer: true });
      } else {
        reject(
          new WeChatPayError(
            "PAYMENT_FAILED",
            response.err_msg ?? "WeChat JSAPI payment failed.",
            response,
          ),
        );
      }
    });
  });
}

export type WebWeChatPayConfig = WeChatPayClientConfig & {
  environment?: () => WeChatPayEnvironment;
  jsApiTimeoutMs?: number;
  pollIntervalMs?: number;
  qr?: { width?: number; margin?: number } | false;
};

export type WebPaymentResult = PaymentResult & { qr?: string };

async function renderQr(
  codeUrl: string,
  options: { width?: number; margin?: number },
): Promise<string> {
  return QRCode.toDataURL(codeUrl, {
    width: options.width ?? 260,
    margin: options.margin ?? 1,
  });
}

export function createWebWeChatPay(config: WebWeChatPayConfig) {
  const client = createWeChatPayClient(config);
  const environment = config.environment ?? detectWebWeChatPayEnvironment;
  const pollIntervalMs = config.pollIntervalMs ?? 2500;

  async function finalize(
    launch: PaymentLaunch,
    status: PaymentResult["status"],
  ): Promise<WebPaymentResult> {
    const base: WebPaymentResult = { ...launch, status, shouldVerifyWithServer: true };
    if (launch.channel === "native" && config.qr !== false) {
      base.qr = await renderQr(launch.payload.codeUrl, config.qr ?? {});
    }
    return base;
  }

  return {
    client,
    environment,
    async pay(input: CreatePaymentInput): Promise<WebPaymentResult> {
      const channel = input.channel ?? resolveWeChatPayChannel(environment());
      if (channel === "app") {
        throw new WeChatPayError(
          "UNSUPPORTED_ENVIRONMENT",
          "App Pay is only available in a native app.",
        );
      }
      const launch = await client.createPayment({ ...input, channel });
      if (launch.channel === "h5") {
        window.location.assign(launch.payload.h5Url);
        return finalize(launch, "started");
      }
      if (launch.channel === "jsapi") return launchJsApi(launch, config.jsApiTimeoutMs ?? 10_000);
      return finalize(launch, "started");
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

export type WebWeChatPay = ReturnType<typeof createWebWeChatPay>;
