import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { GENERIC_UNAVAILABLE_MESSAGE } from "@/lib/errors";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class TokenEncryptionConfigurationError extends Error {
  constructor() {
    super("TOKEN_ENCRYPTION_SECRET must contain at least 32 bytes.");
    this.name = "TokenEncryptionConfigurationError";
  }
}

function getSecretBytes() {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();

  if (!secret) {
    throw new TokenEncryptionConfigurationError();
  }

  const base64urlBytes = BASE64URL_PATTERN.test(secret)
    ? Buffer.from(secret, "base64url")
    : null;
  const secretBytes =
    base64urlBytes && base64urlBytes.length >= 32
      ? base64urlBytes
      : Buffer.from(secret, "utf8");

  if (secretBytes.length < 32) {
    throw new TokenEncryptionConfigurationError();
  }

  return secretBytes;
}

function getEncryptionKey() {
  return createHash("sha256")
    .update("feedfm:x-provider-token:v1")
    .update(getSecretBytes())
    .digest();
}

export function getTokenEncryptionSetupErrorMessage() {
  return process.env.NODE_ENV === "production"
    ? GENERIC_UNAVAILABLE_MESSAGE
    : "FeedFM setup is missing a valid TOKEN_ENCRYPTION_SECRET. Add a secret containing at least 32 bytes and restart the dev server.";
}

export function encryptToken(token: string) {
  if (!token) {
    throw new Error("Cannot encrypt an empty token.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptToken(encrypted: string) {
  const [version, ivValue, authTagValue, ciphertextValue, extra] =
    encrypted.split(".");

  if (
    version !== VERSION ||
    !ivValue ||
    !authTagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error("Encrypted token has an invalid format.");
  }

  const iv = Buffer.from(ivValue, "base64url");
  const authTag = Buffer.from(authTagValue, "base64url");
  const ciphertext = Buffer.from(ciphertextValue, "base64url");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Encrypted token has invalid parameters.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
