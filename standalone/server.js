const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data");
const stateFile = process.env.STATE_FILE ? path.resolve(process.env.STATE_FILE) : path.join(dataDir, "state.json");
const port = Number(process.env.PORT || 4280);

const adminAccessKey = process.env.ADMIN_ACCESS_KEY || "VUEKUMI-STANDALONE-LOCAL";
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || crypto.createHash("sha256").update(`standalone-admin:${adminAccessKey}`).digest("hex");
const contributorTokenSecret = process.env.CONTRIBUTOR_TOKEN_SECRET || crypto.createHash("sha256").update(`standalone-contributor:${adminAccessKey}`).digest("hex");
const buyerTokenSecret = process.env.BUYER_TOKEN_SECRET || crypto.createHash("sha256").update(`standalone-buyer:${adminAccessKey}`).digest("hex");
const tokenTtlMs = Number(process.env.TOKEN_TTL_MS || 8 * 60 * 60 * 1000);

if (process.env.NODE_ENV === "production") {
  const missing = ["ADMIN_ACCESS_KEY", "ADMIN_TOKEN_SECRET", "CONTRIBUTOR_TOKEN_SECRET", "BUYER_TOKEN_SECRET"].filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing production secrets: ${missing.join(", ")}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function defaultState() {
  return {
    schemaVersion: 1,
    settings: {
      platformName: "VUEKUMI",
      tagline: "African stock photography for modern teams.",
      defaultCurrency: "USD",
      freeUploadLimit: 3,
      aiQualityThreshold: 72,
      faceConfidence: 88,
      contributorEligibility: "Africa only",
      acceptedIds: ["DL", "International Passport", "High-rated Government ID"],
      paymentProviders: [
        { name: "Stripe", purpose: "Global subscriptions", apiKeyRef: "STRIPE_SECRET_KEY", enabled: true },
        { name: "Paystack", purpose: "West Africa payments and payouts", apiKeyRef: "PAYSTACK_SECRET_KEY", enabled: true },
        { name: "Flutterwave", purpose: "Pan-African payments and payouts", apiKeyRef: "FLUTTERWAVE_SECRET_KEY", enabled: true }
      ],
      smsProviders: [
        { country: "Nigeria", provider: "Termii", apiKeyRef: "TERMII_API_KEY", enabled: true },
        { country: "Ghana", provider: "Hubtel", apiKeyRef: "HUBTEL_API_KEY", enabled: true },
        { country: "Kenya", provider: "Africa's Talking", apiKeyRef: "AFRICASTALKING_API_KEY", enabled: true }
      ],
      countryRules: [
        { country: "Nigeria", contributorsAllowed: true, acceptedIds: "DL, International Passport, NIN-backed Government ID", payoutGateway: "Paystack Transfer", payoutCurrency: "NGN" },
        { country: "Ghana", contributorsAllowed: true, acceptedIds: "DL, International Passport, Ghana Card", payoutGateway: "Flutterwave Ghana", payoutCurrency: "GHS" },
        { country: "Kenya", contributorsAllowed: true, acceptedIds: "DL, International Passport, National ID", payoutGateway: "M-Pesa Daraja", payoutCurrency: "KES" },
        { country: "South Africa", contributorsAllowed: true, acceptedIds: "DL, International Passport, National ID", payoutGateway: "Ozow", payoutCurrency: "ZAR" },
        { country: "Rwanda", contributorsAllowed: true, acceptedIds: "DL, International Passport, National ID", payoutGateway: "Flutterwave Rwanda", payoutCurrency: "RWF" }
      ],
      contributorPermissions: {
        "Photo Content": ["Photo Content", "Street", "Culture"],
        Models: ["Models", "Photography"],
        Photographers: ["Photo Content", "Models", "Photography", "Street", "Culture"]
      }
    },
    roles: [
      { id: "role-owner", name: "Owner", permissions: ["dashboard", "frontpage", "users", "contributors", "assets", "commerce", "settings", "audit"], enabled: true },
      { id: "role-content", name: "Content Manager", permissions: ["dashboard", "assets", "contributors", "audit"], enabled: true },
      { id: "role-support", name: "Support", permissions: ["dashboard", "users", "contributors", "audit"], enabled: true }
    ],
    categories: {
      contributors: ["Photo Content", "Models", "Photographers"],
      photos: ["Photo Content", "Models", "Photography", "Street", "Culture"],
      buyers: ["Regular Individual", "Agency", "Corporate"]
    },
    users: [
      { id: "admin-1", name: "VUEKUMI Admin", email: "admin@vuekumi.local", phone: "+10000000001", group: "Admin", category: "Owner", country: "Global", status: "Active", verificationStatus: "Verified", role: "Owner", createdAt: now() },
      { id: "contrib-1", name: "Amina Lens", email: "amina@vuekumi.local", phone: "+2348000001001", group: "Contributor", category: "Photographers", country: "Nigeria", status: "Pending", verificationStatus: "Needs ID Review", role: "", createdAt: now() },
      { id: "buyer-1", name: "Agency Buyer", email: "agency@buyer.local", phone: "+12025550101", group: "Buyer", category: "Agency", country: "United States", status: "Active", verificationStatus: "Email Pending", role: "", createdAt: now() }
    ],
    contributors: [
      { id: "profile-1", userId: "contrib-1", type: "Photographers", country: "Nigeria", accessLevel: "Starter", faceScore: 0, profilePhoto: false, governmentId: false, agreements: false, subscriptionActive: false, payoutGateway: "Paystack Transfer", allowedCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"] }
    ],
    assets: seedAssets(),
    orders: [],
    licenses: [],
    frontpage: {
      nav: [
        { label: "Explore", href: "#collections" },
        { label: "Contributors", href: "#contributors" },
        { label: "Licensing", href: "#plans" }
      ],
      sections: [
        { id: "hero", type: "hero", enabled: true, order: 1, eyebrow: "African Stock Photography", title: "VUEKUMI", subtitle: "Discover, license, and manage authentic African visual stories.", ctaLabel: "Explore collection", secondaryCtaLabel: "Become a contributor" },
        { id: "categories", type: "categoryStrip", enabled: true, order: 2, title: "Browse categories" },
        { id: "featured", type: "masonry", enabled: true, order: 3, title: "Featured African imagery", assetIds: ["asset-1", "asset-2", "asset-3", "asset-4", "asset-5", "asset-6"] },
        { id: "contributors", type: "contributors", enabled: true, order: 4, title: "Contributor network" },
        { id: "plans", type: "plans", enabled: true, order: 5, title: "License plans" }
      ],
      footer: {
        headline: "VUEKUMI",
        body: "African stock photography, contributor verification, and rights-aware licensing."
      },
      seo: {
        title: "VUEKUMI - African Stock Photography",
        description: "License authentic African stock photography for creators, agencies, and corporate teams."
      }
    },
    plans: [
      { id: "plan-regular", type: "Regular Individual", price: "$19", seats: 1, downloads: 25, license: "Standard royalty free" },
      { id: "plan-agency", type: "Agency", price: "$149", seats: 8, downloads: 300, license: "Extended campaign use" },
      { id: "plan-corporate", type: "Corporate", price: "Custom", seats: 50, downloads: 1500, license: "Rights managed procurement" }
    ],
    sessions: {},
    audit: []
  };
}

function seedAssets() {
  const items = [
    ["asset-1", "Lagos Gold", "Street", "Nigeria", "Amina Lens", 88],
    ["asset-2", "Kente Portrait", "Culture", "Ghana", "Ama Studio", 91],
    ["asset-3", "Nairobi Workspace", "Photo Content", "Kenya", "Achieng Studio", 78],
    ["asset-4", "Studio Model Release", "Models", "South Africa", "Nomsa Faces", 84],
    ["asset-5", "Market Textures", "Culture", "Rwanda", "Kigali House", 82],
    ["asset-6", "Savannah Transit", "Photography", "Tanzania", "Ayo Travel", 89],
    ["asset-7", "Festival Movement", "Street", "Senegal", "Dakar Archive", 76],
    ["asset-8", "Royal Editorial", "Models", "Ethiopia", "Saba Works", 86]
  ];
  return items.map(([assetId, title, category, country, contributor, quality], index) => ({
    id: assetId,
    title,
    category,
    country,
    contributor,
    contributorType: category === "Models" ? "Models" : "Photographers",
    quality,
    status: index < 6 ? "Approved" : "Admin Review",
    visibility: index < 6 ? "Public" : "Internal Review",
    faces: category === "Models",
    release: category === "Models",
    copyrightApproval: index < 6,
    colorA: ["#c27a1c", "#6f2c22", "#1c5943", "#1a1a1a", "#d8a843", "#265f73", "#7c3a2e", "#f0e3d0"][index],
    colorB: ["#28170b", "#d9a441", "#0b1c16", "#d8d8d8", "#4f2d18", "#102b3c", "#1a1110", "#3c2a21"][index],
    createdAt: now()
  }));
}

function now() {
  return new Date().toISOString();
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(stateFile)) writeState(defaultState());
}

function readState() {
  ensureStore();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(stateFile, "utf8")));
  } catch {
    return normalizeState(defaultState());
  }
}

function writeState(state) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(normalizeState(state), null, 2));
}

function normalizeState(state) {
  const base = defaultState();
  return {
    ...base,
    ...state,
    settings: { ...base.settings, ...(state.settings || {}) },
    categories: { ...base.categories, ...(state.categories || {}) },
    frontpage: {
      ...base.frontpage,
      ...(state.frontpage || {}),
      seo: { ...base.frontpage.seo, ...(state.frontpage?.seo || {}) },
      footer: { ...base.frontpage.footer, ...(state.frontpage?.footer || {}) }
    },
    users: Array.isArray(state.users) ? state.users : base.users,
    contributors: Array.isArray(state.contributors) ? state.contributors : base.contributors,
    assets: Array.isArray(state.assets) ? state.assets : base.assets,
    plans: Array.isArray(state.plans) ? state.plans : base.plans,
    orders: Array.isArray(state.orders) ? state.orders : [],
    licenses: Array.isArray(state.licenses) ? state.licenses : [],
    sessions: state.sessions || {},
    audit: Array.isArray(state.audit) ? state.audit : []
  };
}

function audit(state, action, details = {}, actor = "system") {
  state.audit.unshift({ id: id("audit"), action, details, actor, createdAt: now() });
  state.audit = state.audit.slice(0, 500);
}

function sign(kind, payload) {
  const secret = kind === "admin" ? adminTokenSecret : kind === "buyer" ? buyerTokenSecret : contributorTokenSecret;
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function issueToken(kind, user) {
  const expiresAt = Date.now() + tokenTtlMs;
  const sessionId = id(`${kind}-session`);
  const payload = Buffer.from(JSON.stringify({ kind, sessionId, sub: user.id, role: user.role || user.category, expiresAt })).toString("base64url");
  return { token: `${payload}.${sign(kind, payload)}`, expiresAt, sessionId };
}

function verifyToken(kind, token, state) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (sign(kind, payload) !== signature) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (claims.kind !== kind || Date.now() > Number(claims.expiresAt)) return null;
    const session = state.sessions[claims.sessionId];
    if (!session || session.token !== token) return null;
    const user = state.users.find((item) => item.id === claims.sub);
    if (!user || user.status !== "Active") return null;
    return { ...claims, user };
  } catch {
    return null;
  }
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function requireAdmin(req, res, state) {
  const claims = verifyToken("admin", bearer(req), state);
  if (!claims) {
    json(res, 401, { error: "Admin session required" });
    return null;
  }
  return claims;
}

function publicPayload(state) {
  return {
    settings: state.settings,
    categories: state.categories,
    frontpage: state.frontpage,
    assets: state.assets.filter((asset) => asset.visibility === "Public" && asset.status === "Approved"),
    plans: state.plans
  };
}

function adminPayload(state) {
  return {
    metrics: {
      users: state.users.length,
      contributors: state.users.filter((user) => user.group === "Contributor").length,
      assets: state.assets.length,
      pendingAssets: state.assets.filter((asset) => asset.status !== "Approved").length,
      orders: state.orders.length,
      licenses: state.licenses.length
    },
    settings: state.settings,
    categories: state.categories,
    frontpage: state.frontpage,
    users: state.users,
    contributors: state.contributors.map((profile) => ({ ...profile, user: state.users.find((user) => user.id === profile.userId) })),
    assets: state.assets,
    plans: state.plans,
    orders: state.orders,
    licenses: state.licenses,
    roles: state.roles,
    audit: state.audit,
    integrations: integrationStatus(state)
  };
}

function integrationStatus(state) {
  return {
    paymentProviders: state.settings.paymentProviders.map((item) => ({ ...item, credentialsLoaded: Boolean(item.apiKeyRef && process.env[item.apiKeyRef]) })),
    smsProviders: state.settings.smsProviders.map((item) => ({ ...item, credentialsLoaded: Boolean(item.apiKeyRef && process.env[item.apiKeyRef]) })),
    countryRules: state.settings.countryRules
  };
}

function upsert(list, input, prefix) {
  const item = { ...input, id: input.id || id(prefix) };
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index >= 0) list[index] = { ...list[index], ...item };
  else list.unshift(item);
  return index >= 0 ? list[index] : item;
}

async function handleApi(req, res, url) {
  const state = readState();
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true, service: "vuekumi-standalone", version: 1 });
  if (method === "GET" && url.pathname === "/api/public") return json(res, 200, publicPayload(state));

  if (method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);
    const user = state.users.find((item) => item.group === "Admin" && item.status === "Active" && [item.email, item.phone, item.name].map((value) => String(value || "").toLowerCase()).includes(String(body.identifier || "").trim().toLowerCase()));
    if (!user || body.accessKey !== adminAccessKey) return json(res, 401, { error: "Invalid admin credentials" });
    const session = issueToken("admin", user);
    state.sessions[session.sessionId] = { token: session.token, userId: user.id, createdAt: now(), expiresAt: session.expiresAt };
    audit(state, "admin.login", { userId: user.id }, user.id);
    writeState(state);
    return json(res, 200, { token: session.token, expiresAt: session.expiresAt, user });
  }

  if (url.pathname.startsWith("/api/admin/")) {
    const admin = requireAdmin(req, res, state);
    if (!admin) return;

    if (method === "GET" && url.pathname === "/api/admin/state") return json(res, 200, adminPayload(state));

    if (method === "PUT" && url.pathname === "/api/admin/frontpage") {
      const body = await readBody(req);
      state.frontpage = { ...state.frontpage, ...body.frontpage };
      audit(state, "frontpage.updated", {}, admin.sub);
      writeState(state);
      return json(res, 200, { frontpage: state.frontpage });
    }

    if (method === "PUT" && url.pathname === "/api/admin/settings") {
      const body = await readBody(req);
      state.settings = { ...state.settings, ...body.settings };
      if (body.categories) state.categories = { ...state.categories, ...body.categories };
      if (Array.isArray(body.plans)) state.plans = body.plans;
      audit(state, "settings.updated", { keys: Object.keys(body.settings || {}) }, admin.sub);
      writeState(state);
      return json(res, 200, { settings: state.settings, categories: state.categories, plans: state.plans });
    }

    if (method === "POST" && url.pathname === "/api/admin/users") {
      const item = upsert(state.users, { ...(await readBody(req)), createdAt: now() }, "user");
      if (item.group === "Contributor" && !state.contributors.some((profile) => profile.userId === item.id)) {
        state.contributors.unshift({ id: id("profile"), userId: item.id, type: item.category, country: item.country, accessLevel: "Starter", faceScore: 0, profilePhoto: false, governmentId: false, agreements: false, subscriptionActive: false, payoutGateway: "", allowedCategories: state.settings.contributorPermissions[item.category] || [] });
      }
      audit(state, "user.saved", { id: item.id }, admin.sub);
      writeState(state);
      return json(res, 200, { user: item });
    }

    if (method === "POST" && url.pathname === "/api/admin/contributors") {
      const input = await readBody(req);
      const item = upsert(state.contributors, input, "profile");
      const user = state.users.find((record) => record.id === item.userId);
      if (user) {
        user.category = item.type;
        user.country = item.country;
        user.verificationStatus = item.faceScore >= state.settings.faceConfidence && item.governmentId && item.agreements ? "Verified" : "Needs ID Review";
        user.status = user.verificationStatus === "Verified" ? "Active" : user.status;
      }
      audit(state, "contributor.saved", { id: item.id }, admin.sub);
      writeState(state);
      return json(res, 200, { contributor: item });
    }

    if (method === "POST" && url.pathname === "/api/admin/assets") {
      const input = await readBody(req);
      const item = upsert(state.assets, { ...input, createdAt: input.createdAt || now() }, "asset");
      if (item.quality < state.settings.aiQualityThreshold) item.status = "AI Enhancement";
      if (item.faces && (!item.release || !item.copyrightApproval)) item.status = "Face/Copyright Verification";
      audit(state, "asset.saved", { id: item.id, status: item.status }, admin.sub);
      writeState(state);
      return json(res, 200, { asset: item });
    }

    if (method === "POST" && url.pathname === "/api/admin/orders") {
      const order = upsert(state.orders, { ...(await readBody(req)), createdAt: now(), status: "Payment Pending" }, "order");
      audit(state, "order.saved", { id: order.id }, admin.sub);
      writeState(state);
      return json(res, 200, { order });
    }

    if (method === "POST" && url.pathname === "/api/admin/roles") {
      const role = upsert(state.roles, await readBody(req), "role");
      audit(state, "role.saved", { id: role.id }, admin.sub);
      writeState(state);
      return json(res, 200, { role });
    }
  }

  json(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin") pathname = "/admin.html";
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) return json(res, 404, { error: "Not found" });
  fs.readFile(filePath, (error, content) => {
    if (error && !path.extname(filePath)) {
      return fs.readFile(`${filePath}.html`, (htmlError, htmlContent) => {
        if (htmlError) return json(res, 404, { error: "Not found" });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlContent);
      });
    }
    if (error) return json(res, 404, { error: "Not found" });
    const ext = path.extname(filePath);
    const type = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error) => json(res, 500, { error: error.message }));
    return;
  }
  serveStatic(req, res, url);
}).listen(port, () => {
  console.log(`VUEKUMI standalone running at http://localhost:${port}`);
});
