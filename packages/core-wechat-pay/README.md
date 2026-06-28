# @chinafast/core-wechat-pay

Shared, runtime-independent WeChat Pay types, channel selection, errors, and backend HTTP client. This package only supports one-time WeChat Pay transactions.

```ts
import { createWeChatPayClient } from "@chinafast/core-wechat-pay";

const client = createWeChatPayClient({ apiBaseUrl: "https://api.example.com" });
const order = await client.createPayment({ productId: "coffee", channel: "native" });
```
