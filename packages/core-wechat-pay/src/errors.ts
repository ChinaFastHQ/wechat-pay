import type { WeChatPayErrorCode } from "./types";

export class WeChatPayError extends Error {
  constructor(
    readonly code: WeChatPayErrorCode | string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WeChatPayError";
  }
}
