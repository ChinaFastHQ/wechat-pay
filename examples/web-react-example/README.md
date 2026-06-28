# React web WeChat Pay example

Self-contained React checkout with its own backend.

- `web-app/` — Vite + React app that renders a QR code on desktop, redirects to H5 on mobile, and uses JSAPI inside WeChat.
- `server/` — Express backend in mock mode by default; switch to live mode with merchant credentials.

## Run

```bash
pnpm install
pnpm build

# terminal 1
pnpm --filter web-react-wechat-pay-example-server dev

# terminal 2
pnpm --filter web-react-wechat-pay-example dev
```

See `web-app/README.md` for H5/JSAPI caveats and `server/README.md` for live-mode credentials.
