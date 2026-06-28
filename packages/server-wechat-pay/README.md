# @chinafast/server-wechat-pay

Node.js helpers for one-time WeChat Pay API v3 transactions. It creates App, H5, JSAPI, and Native QR orders; queries and closes orders; submits refunds; and verifies/decrypts signed webhooks.

```ts
const wechatPay = createWeChatPayServer({
  mode: "live",
  credentials: {
    appId: process.env.WECHAT_APP_ID!,
    merchantId: process.env.WECHAT_MERCHANT_ID!,
    apiV3Key: process.env.WECHAT_API_V3_KEY!,
    privateKey: process.env.WECHAT_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    certificateSerialNo: process.env.WECHAT_CERTIFICATE_SERIAL_NO!,
    platformCertificates: {
      [process.env.WECHAT_PLATFORM_SERIAL!]: process.env.WECHAT_PLATFORM_CERTIFICATE!.replace(
        /\\n/g,
        "\n",
      ),
    },
    notifyUrl: "https://api.example.com/wechat-pay/webhook",
  },
});
```

Pass the exact raw request body to `verifyWebhook`; parsing and re-serializing it invalidates the signature.
