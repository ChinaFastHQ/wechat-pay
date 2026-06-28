import {
  createCipheriv,
  createDecipheriv,
  createSign,
  createVerify,
  randomBytes,
} from "node:crypto";
import { WeChatPayServerError } from "./errors";

export function nonce(length = 16): string {
  return randomBytes(length).toString("hex").slice(0, length);
}

export function rsaSign(privateKey: string, message: string): string {
  return createSign("RSA-SHA256").update(message).sign(privateKey, "base64");
}

export function rsaVerify(publicKey: string, message: string, signature: string): boolean {
  return createVerify("RSA-SHA256").update(message).verify(publicKey, signature, "base64");
}

export function decryptResource(
  apiV3Key: string,
  resource: { ciphertext: string; nonce: string; associated_data?: string },
): unknown {
  if (Buffer.byteLength(apiV3Key) !== 32) {
    throw new WeChatPayServerError("INVALID_CONFIG", "apiV3Key must contain exactly 32 bytes.");
  }
  try {
    const encrypted = Buffer.from(resource.ciphertext, "base64");
    const data = encrypted.subarray(0, -16);
    const tag = encrypted.subarray(-16);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(apiV3Key),
      Buffer.from(resource.nonce),
    );
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(resource.associated_data ?? ""));
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
  } catch (cause) {
    throw new WeChatPayServerError(
      "INVALID_WEBHOOK",
      "Could not decrypt the WeChat webhook resource.",
      cause,
    );
  }
}

export function encryptResourceForTest(
  apiV3Key: string,
  value: unknown,
  resourceNonce = "test-resource",
  associatedData = "resource",
) {
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(apiV3Key), Buffer.from(resourceNonce));
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    nonce: resourceNonce,
    associated_data: associatedData,
  };
}
