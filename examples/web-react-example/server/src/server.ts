import cors from "cors";
import "dotenv/config";
import express from "express";
import { WeChatPayServerError, createWeChatPayServer } from "@chinafast/server-wechat-pay";

const port = Number(process.env.PORT || 4000);
const live = process.env.CHINA_PAY_MODE === "live";
const platformSerial = process.env.WECHAT_PLATFORM_SERIAL || "";
const platformCertificate = process.env.WECHAT_PLATFORM_CERTIFICATE?.replace(/\\n/g, "\n") || "";
const payments = createWeChatPayServer({
  mode: live ? "live" : "mock",
  credentials: live
    ? {
        appId: process.env.WECHAT_APP_ID,
        merchantId: process.env.WECHAT_MERCHANT_ID,
        apiV3Key: process.env.WECHAT_API_V3_KEY,
        privateKey: process.env.WECHAT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        certificateSerialNo: process.env.WECHAT_CERTIFICATE_SERIAL_NO,
        platformCertificates: { [platformSerial]: platformCertificate },
        notifyUrl: process.env.WECHAT_NOTIFY_URL,
      }
    : undefined,
  products: {
    coffee: {
      amount: 300,
      currency: "CNY",
      subject: "Example coffee",
      description: "One coffee from the ChinaFast example",
    },
    lunch: { amount: 2500, currency: "CNY", subject: "Example lunch" },
  },
});

const app = express();
app.use(cors({ origin: true }));

function asyncHandler(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

app.post(
  "/wechat-pay/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const result = await payments.verifyWebhook({ headers: req.headers, rawBody: req.body });
    console.log("Verified WeChat event", result.event);
    res.json({ code: "SUCCESS", message: "SUCCESS" });
  }),
);

app.use(express.json());
app.get("/wechat-pay/products", (_req, res) => res.json(payments.listProducts()));
app.post(
  "/wechat-pay/orders",
  asyncHandler(async (req, res) => {
    const clientIp = req.ip?.replace(/^::ffff:/, "") || "127.0.0.1";
    res.json(await payments.createOrder({ ...req.body, clientIp: req.body.clientIp || clientIp }));
  }),
);
app.get(
  "/wechat-pay/orders/:orderId",
  asyncHandler(async (req, res) => {
    res.json(await payments.queryOrder({ orderId: routeParam(req.params.orderId) }));
  }),
);
app.post(
  "/wechat-pay/orders/:orderId/close",
  asyncHandler(async (req, res) => {
    res.json(await payments.closeOrder(routeParam(req.params.orderId)));
  }),
);
app.post(
  "/wechat-pay/refunds",
  asyncHandler(async (req, res) => {
    res.json(await payments.refund(req.body));
  }),
);

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const known = error instanceof WeChatPayServerError;
    res.status(known ? 400 : 500).json({
      error: {
        code: error instanceof WeChatPayServerError ? error.code : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  },
);

app.listen(port, () =>
  console.log(
    `WeChat Pay example server listening on http://localhost:${port} (${live ? "live" : "mock"})`,
  ),
);
