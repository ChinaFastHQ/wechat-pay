import { WeChatPayError } from "./errors";
import type { WeChatPayChannel, WeChatPayEnvironment } from "./types";

export function resolveWeChatPayChannel(environment: WeChatPayEnvironment): WeChatPayChannel {
  if (environment.runtime === "native") return "app";
  if (environment.inWeChat) return "jsapi";
  if (environment.device === "mobile" || environment.device === "tablet") return "h5";
  if (environment.device === "desktop") return "native";
  throw new WeChatPayError(
    "UNSUPPORTED_ENVIRONMENT",
    "Unable to select a WeChat Pay channel for this environment.",
  );
}
