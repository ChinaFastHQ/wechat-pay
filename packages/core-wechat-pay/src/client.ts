import { WeChatPayError } from "./errors";
import { TERMINAL_PAYMENT_STATUSES } from "./types";
import type {
  CreatePaymentInput,
  PaymentController,
  PaymentLaunch,
  PaymentStatus,
  WatchOptions,
  WeChatPayChannel,
  WeChatPayClientConfig,
  WeChatPayProduct,
} from "./types";

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch (cause) {
    throw new WeChatPayError(
      "INVALID_RESPONSE",
      "The payment server returned invalid JSON.",
      cause,
    );
  }
  if (!response.ok) {
    const error = body as { error?: { code?: string; message?: string } } | undefined;
    throw new WeChatPayError(
      error?.error?.code ?? "NETWORK_ERROR",
      error?.error?.message ?? `Payment request failed with HTTP ${response.status}.`,
      body,
    );
  }
  return body as T;
}

export class WeChatPayClient {
  private readonly apiBaseUrl: string;
  private readonly basePath: string;

  constructor(private readonly config: WeChatPayClientConfig) {
    if (!config.apiBaseUrl) throw new WeChatPayError("NOT_CONFIGURED", "apiBaseUrl is required.");
    this.apiBaseUrl = trimSlash(config.apiBaseUrl);
    this.basePath = `/${(config.basePath ?? "wechat-pay").replace(/^\/+|\/+$/g, "")}`;
  }

  async createPayment(
    input: CreatePaymentInput & { channel: WeChatPayChannel },
  ): Promise<PaymentLaunch> {
    if (
      !input.productId &&
      (!Number.isInteger(input.amount) || (input.amount ?? 0) <= 0 || !input.subject)
    ) {
      throw new WeChatPayError(
        "INVALID_INPUT",
        "Provide productId, or a positive integer amount in fen with a subject.",
      );
    }
    return this.request<PaymentLaunch>(`${this.basePath}/orders`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getPayment(orderId: string): Promise<PaymentStatus> {
    return this.request(`${this.basePath}/orders/${encodeURIComponent(orderId)}`);
  }

  closePayment(orderId: string): Promise<PaymentStatus> {
    return this.request(`${this.basePath}/orders/${encodeURIComponent(orderId)}/close`, {
      method: "POST",
    });
  }

  listProducts(): Promise<WeChatPayProduct[]> {
    return this.request(`${this.basePath}/products`);
  }

  watch(
    orderId: string,
    onStatus: (status: PaymentStatus) => void,
    options: WatchOptions = {},
  ): PaymentController {
    const intervalMs = options.intervalMs ?? 2500;
    const signal = options.signal;
    let stopped = signal?.aborted ?? false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };

    const onAbort = () => stop();
    signal?.addEventListener("abort", onAbort, { once: true });

    const tick = async () => {
      if (stopped) return;
      let next: PaymentStatus | undefined;
      try {
        next = await this.getPayment(orderId);
      } catch {
        // transient network/server errors — keep polling
      }
      if (stopped) return;
      if (next) {
        onStatus(next);
        if (TERMINAL_PAYMENT_STATUSES.has(next.status)) return;
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    tick();
    return { stop };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const fetcher = this.config.fetch ?? globalThis.fetch;
    if (!fetcher)
      throw new WeChatPayError("NETWORK_ERROR", "No fetch implementation is available.");
    const extraHeaders =
      typeof this.config.headers === "function" ? await this.config.headers() : this.config.headers;
    const headers = new Headers(extraHeaders);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    try {
      return await parseResponse<T>(
        await fetcher(`${this.apiBaseUrl}${path}`, {
          ...init,
          headers,
        }),
      );
    } catch (cause) {
      if (cause instanceof WeChatPayError) throw cause;
      throw new WeChatPayError("NETWORK_ERROR", "Could not reach the payment server.", cause);
    }
  }
}

export function createWeChatPayClient(config: WeChatPayClientConfig): WeChatPayClient {
  return new WeChatPayClient(config);
}
