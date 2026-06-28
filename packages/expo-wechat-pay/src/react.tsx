import { useCallback, useEffect, useState } from "react";
import {
  WeChatPayError,
  type CreatePaymentInput,
  type PaymentResult,
  type PaymentStatus,
} from "@chinafast/core-wechat-pay";
import type { ExpoWeChatPay } from "./index";

export function useWeChatPay(payments: ExpoWeChatPay) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult>();
  const [error, setError] = useState<WeChatPayError>();
  const [status, setStatus] = useState<PaymentStatus>();

  useEffect(() => {
    if (!result) return;
    setStatus(undefined);
    const controller = payments.watch(result.orderId, setStatus);
    return () => controller.stop();
  }, [payments, result]);

  const pay = useCallback(
    async (input: CreatePaymentInput) => {
      setLoading(true);
      setError(undefined);
      try {
        const next = await payments.pay(input);
        setResult(next);
        return next;
      } catch (cause) {
        const next =
          cause instanceof WeChatPayError
            ? cause
            : new WeChatPayError("PAYMENT_FAILED", "Payment failed.", cause);
        setError(next);
        throw next;
      } finally {
        setLoading(false);
      }
    },
    [payments],
  );

  return { pay, loading, result, error, status };
}
