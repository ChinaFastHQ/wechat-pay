# Expo example

1. Run the example server in `../server`.
2. Copy `.env.example` to `.env` and use an app ID registered for the example bundle/package IDs.
3. Run `pnpm android` or `pnpm ios` to create a development build. Expo Go is unsupported because WeChat Pay needs native code.

For a physical phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN URL or a public HTTPS URL.
