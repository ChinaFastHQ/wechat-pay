# @chinafast/web-wechat-pay

Browser WeChat Pay for H5 redirects, Official Account JSAPI, and desktop Native QR orders.

```ts
import { createWebWeChatPay } from "@chinafast/web-wechat-pay";

const wechatPay = createWebWeChatPay({ apiBaseUrl: "http://localhost:4000" });
const result = await wechatPay.pay({ productId: "coffee", openId });
```

The package chooses JSAPI inside WeChat, H5 in other mobile browsers, and Native QR on desktop. Native QR orders come back with `result.qr` already rendered as a data URL — render it directly in an `<img>`. JSAPI and H5 launches do not include a QR.

To poll the server for confirmation, use `watch`:

```ts
const controller = wechatPay.watch(result.orderId, (status) => {
  if (status.status === "paid") fulfillOrder();
});
controller.stop(); // optional — polling stops automatically on paid/closed/failed
```

## React

```ts
import { useWeChatPay } from "@chinafast/web-wechat-pay/react";

const { pay, loading, result, error, qr, status } = useWeChatPay(wechatPay);
```

`qr` is a pre-rendered data URL when the channel is Native QR, otherwise `undefined`. `status` is the latest `PaymentStatus` from the server, polled automatically after each launch and stopped on terminal status.

Always query the backend after launch; a client callback is not proof of payment.
