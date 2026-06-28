import { requireNativeModule } from "expo-modules-core";
import type { WeChatAppPayPayload } from "@chinafast/core-wechat-pay";

export type NativePayOptions = {
  appId: string;
  universalLink?: string;
  payload: WeChatAppPayPayload & { packageValue?: string };
};

export type NativePayResponse = {
  errorCode: number;
  errorMessage?: string;
  returnKey?: string;
  cancelled: boolean;
};

export type ExpoWeChatPayNativeModule = {
  isInstalled(): Promise<boolean>;
  pay(options: NativePayOptions): Promise<NativePayResponse>;
};

let nativeModule: ExpoWeChatPayNativeModule | undefined;

export function getNativeWeChatPayModule(): ExpoWeChatPayNativeModule {
  nativeModule ??= requireNativeModule<ExpoWeChatPayNativeModule>("ExpoWeChatPay");
  return nativeModule;
}

export function setNativeWeChatPayModuleForTests(module?: ExpoWeChatPayNativeModule): void {
  nativeModule = module;
}
