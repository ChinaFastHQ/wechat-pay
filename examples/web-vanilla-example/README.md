# Vanilla web WeChat Pay example

Self-contained framework-free checkout with its own backend.

- `web-app/` — plain JavaScript Vite app: renders Native QR on desktop, redirects to H5 on mobile, and uses JSAPI inside WeChat.
- `server/` — Express backend in mock mode by default; switch to live mode with merchant credentials.

## Run

```bash
pnpm install
pnpm build

# terminal 1
pnpm --filter web-vanilla-wechat-pay-example-server dev

# terminal 2
pnpm --filter web-vanilla-wechat-pay-example dev
```

See `web-app/README.md` for JSAPI `openId` caveats and `server/README.md` for live-mode credentials.
