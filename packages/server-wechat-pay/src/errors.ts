export class WeChatPayServerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WeChatPayServerError";
  }
}
