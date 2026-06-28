import type { ConfigPlugin } from "@expo/config-plugins";
export type ExpoWeChatPayPluginOptions = {
  appId?: string;
  universalLink?: string;
  androidPackageName?: string;
  iosBundleIdentifier?: string;
};
declare const plugin: ConfigPlugin<ExpoWeChatPayPluginOptions>;
export default plugin;
