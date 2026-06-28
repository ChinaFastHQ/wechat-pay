# ChinaFast WeChat Pay

A small, focused WeChat Pay workspace for one-time payments. It intentionally excludes other providers and repeated-payment APIs.

## Packages

| Package                        | Responsibility                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `@chinafast/core-wechat-pay`   | Shared contracts, automatic channel policy, errors, and backend HTTP client                         |
| `@chinafast/web-wechat-pay`    | Browser H5 redirects, Official Account JSAPI, desktop Native QR, and a React hook                   |
| `@chinafast/expo-wechat-pay`   | Native WeChat App Pay module, Expo config plugin, and a React hook                                  |
| `@chinafast/server-wechat-pay` | WeChat Pay API v3 signing, App/H5/JSAPI/Native orders, query, close, refunds, and verified webhooks |

The split mirrors the runtime-oriented structure of `wechat-auth`: portable policy is isolated from web, Expo native, and trusted server code. Merchant keys never enter either client package.

## Examples

Each example is self-contained — its own frontend plus its own Express backend in the same folder.

- `examples/expo-example`: `expo-app/` (native App Pay) + `server/`.
- `examples/web-react-example`: `web-app/` (React + Vite checkout) + `server/`.
- `examples/web-vanilla-example`: `web-app/` (framework-free checkout) + `server/`.

```bash
pnpm install
pnpm build
pnpm test

# terminal 1
pnpm --filter web-react-wechat-pay-example-server dev

# terminal 2
pnpm --filter web-react-wechat-pay-example dev
```

Mock mode is the default and needs no merchant credentials. See each example's top-level README before testing real payments.

## Payment flow

1. The web or Expo package selects its appropriate one-time WeChat Pay channel.
2. `@chinafast/core-wechat-pay` asks your backend to create an order.
3. `@chinafast/server-wechat-pay` signs a WeChat Pay API v3 request using merchant credentials.
4. The client launches WeChat, redirects to H5, invokes JSAPI, or displays the Native Pay QR URL.
5. Your backend verifies the signed webhook or queries the order before fulfilment.

Amounts are integer fen. Never trust client-supplied prices for known products; configure products on the server and send only `productId` from the app.

## Requirements

- Node.js 20 or newer
- A WeChat Pay merchant account for live mode
- A WeChat Open Platform mobile app for Expo App Pay
- Registered H5/JSAPI domains and an Official Account `openId` flow where those channels are used
- An Expo development build or standalone app; Expo Go cannot load the native SDK

## License

MIT
