const crypto = require("crypto");

const adminAccessKey = process.env.ADMIN_ACCESS_KEY || "VUEKUMI-ADMIN-LOCAL";
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || crypto.createHash("sha256").update(`vuekumi-admin:${adminAccessKey}`).digest("hex");
const contributorTokenSecret = process.env.CONTRIBUTOR_TOKEN_SECRET || crypto.createHash("sha256").update(`vuekumi-contributor:${adminAccessKey}`).digest("hex");
const buyerTokenSecret = process.env.BUYER_TOKEN_SECRET || crypto.createHash("sha256").update(`vuekumi-buyer:${adminAccessKey}`).digest("hex");

const adminTokenTtlMs = Number(process.env.ADMIN_TOKEN_TTL_MS || 8 * 60 * 60 * 1000);
const contributorTokenTtlMs = Number(process.env.CONTRIBUTOR_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const buyerTokenTtlMs = Number(process.env.BUYER_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const otpTtlMs = Number(process.env.OTP_TTL_MS || 10 * 60 * 1000);

if (process.env.NODE_ENV === "production") {
  const required = ["ADMIN_ACCESS_KEY", "ADMIN_TOKEN_SECRET", "CONTRIBUTOR_TOKEN_SECRET", "BUYER_TOKEN_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing production secrets: ${missing.join(", ")}`);
  }
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function issueToken(kind, claims, ttlMs = contributorTokenTtlMs) {
  const expiresAt = Date.now() + ttlMs;
  const secret = secretFor(kind);
  const payload = base64url({ kind, ...claims, expiresAt });
  return {
    token: `${payload}.${sign(secret, payload)}`,
    expiresAt
  };
}

function verifyToken(kind, token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const secret = secretFor(kind);
  if (!payload || !signature || sign(secret, payload) !== signature) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (claims.kind !== kind || !claims.expiresAt || Date.now() > Number(claims.expiresAt)) return null;
    return claims;
  } catch {
    return null;
  }
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function secretFor(kind) {
  if (kind === "admin") return adminTokenSecret;
  if (kind === "buyer") return buyerTokenSecret;
  return contributorTokenSecret;
}

function randomOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = {
  adminAccessKey,
  adminTokenTtlMs,
  contributorTokenTtlMs,
  buyerTokenTtlMs,
  otpTtlMs,
  issueToken,
  verifyToken,
  bearerToken,
  randomOtp
};
