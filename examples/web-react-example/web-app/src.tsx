import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { createWebWeChatPay } from "@chinafast/web-wechat-pay";
import { useWeChatPay } from "@chinafast/web-wechat-pay/react";
import "./style.css";

function App() {
  const payments = useMemo(
    () =>
      createWebWeChatPay({ apiBaseUrl: import.meta.env.VITE_API_URL || "http://localhost:4000" }),
    [],
  );
  const { pay, loading, result, error, qr, status } = useWeChatPay(payments);
  return (
    <main>
      <span className="eyebrow">@chinafast/web-wechat-pay</span>
      <h1>Buy a coffee with WeChat</h1>
      <p>The SDK chooses Native QR on desktop, H5 on mobile, and JSAPI inside WeChat.</p>
      <button disabled={loading} onClick={() => pay({ productId: "coffee" })}>
        {loading ? "Creating order…" : "Pay ¥3.00"}
      </button>
      {qr ? (
        <section>
          <img src={qr} alt="WeChat Pay QR code" />
          <strong>Scan in WeChat</strong>
        </section>
      ) : null}
      {status ? <p className={`status ${status.status}`}>Server status: {status.status}</p> : null}
      {result?.channel ? <small>Channel: {result.channel}</small> : null}
      {error ? (
        <p className="error">
          {error.code}: {error.message}
        </p>
      ) : null}
      <small>Products must only be fulfilled after the backend verifies payment.</small>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
