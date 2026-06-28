import { LiveWeChatPayServer } from "./live";
import { MockWeChatPayServer } from "./mock";
import type { WeChatPayServer, WeChatPayServerConfig } from "./types";

export function createWeChatPayServer(config: WeChatPayServerConfig): WeChatPayServer {
  return config.mode === "live" ? new LiveWeChatPayServer(config) : new MockWeChatPayServer(config);
}
