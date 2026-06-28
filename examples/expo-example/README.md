# Expo WeChat Pay example

Self-contained Expo App Pay flow with its own backend.

- `expo-app/` — Expo development build that opens the native WeChat payment sheet.
- `server/` — Express backend in mock mode by default; switch to live mode with merchant credentials.

## Run

```bash
pnpm install
pnpm build

# terminal 1
pnpm --filter expo-wechat-pay-example-server dev

# terminal 2
pnpm --filter expo-wechat-pay-example android   # or ios
```

See `expo-app/README.md` for native build notes and `server/README.md` for live-mode credentials.
