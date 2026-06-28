import { createWebWeChatPay } from "@chinafast/web-wechat-pay";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
const payments = createWebWeChatPay({ apiBaseUrl });
const button = document.querySelector("#pay");
const output = document.querySelector("#output");
const qr = document.querySelector("#qr");
const statusLine = document.querySelector("#status");

let controller;

button.addEventListener("click", async () => {
  button.disabled = true;
  output.textContent = "Creating payment…";
  controller?.stop();
  try {
    const result = await payments.pay({ productId: "coffee" });
    output.textContent = JSON.stringify(result, null, 2);
    if (result.qr) {
      const image = document.createElement("img");
      image.alt = "WeChat Pay QR code";
      image.src = result.qr;
      qr.replaceChildren(image);
    }
    controller = payments.watch(result.orderId, (status) => {
      statusLine.textContent = `Server status: ${status.status}`;
      if (status.status === "paid") statusLine.classList.add("paid");
    });
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
});
