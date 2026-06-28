# @chinafast/expo-wechat-pay

Native WeChat App Pay for Expo development builds and standalone apps. Expo Go cannot load the WeChat native SDK.

Configure the plugin in `app.config.ts`, then create one client:

```ts
plugins: [["@chinafast/expo-wechat-pay/plugin", { appId, universalLink }]];
```

```ts
const payments = createExpoWeChatPay({
  appId,
  universalLink,
  apiBaseUrl: "https://api.example.com",
});
const result = await payments.pay({ productId: "coffee" });
```

`result.status` only describes the SDK callback. To poll the server for confirmation, use `watch`:

```ts
const controller = payments.watch(result.orderId, (status) => {
  if (status.status === "paid") fulfillOrder();
});
controller.stop(); // optional — polling stops automatically on paid/closed/failed
```

## React

```ts
import { useWeChatPay } from "@chinafast/expo-wechat-pay/react";

const { pay, loading, result, error, status } = useWeChatPay(payments);
```

`status` is the latest `PaymentStatus` from the server, polled automatically after each launch and stopped on terminal status. Query your backend or process the WeChat webhook before granting the product.
