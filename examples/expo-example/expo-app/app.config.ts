import type { ExpoConfig } from "expo/config";

const appId = process.env.EXPO_PUBLIC_WECHAT_APP_ID || "wx-development-placeholder";
const universalLink =
  process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || "https://example.com/wechat/";

const config: ExpoConfig = {
  name: "Expo WeChat Pay Example",
  slug: "expo-wechat-pay-example",
  scheme: "wechatpayexample",
  plugins: [["@chinafast/expo-wechat-pay/plugin", { appId, universalLink }]],
  android: { package: "com.chinafast.expowechatpayexample" },
  ios: { bundleIdentifier: "com.chinafast.expowechatpayexample" },
};

export default config;
