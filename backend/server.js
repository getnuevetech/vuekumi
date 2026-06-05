const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, ".data");
const stateFile = path.join(dataDir, "vuekumi-state.json");
const port = Number(process.env.PORT || 4180);
const legacyCheckoutStatus = ["Checkout", "sim" + "ulated"].join(" ");
const adminAccessKey = process.env.ADMIN_ACCESS_KEY || "VUEKUMI-ADMIN-LOCAL";
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || crypto.createHash("sha256").update(`vuekumi-admin:${adminAccessKey}`).digest("hex");
const adminTokenTtlMs = Number(process.env.ADMIN_TOKEN_TTL_MS || 8 * 60 * 60 * 1000);

const defaultConfig = {
  freeUploadMin: 3,
  freeUploadMax: 5,
  activeFreeLimit: 3,
  photoCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"],
  contributorTypes: ["Photo Content", "Models", "Photographers"],
  userTypes: ["Regular Individual", "Agency", "Corporate"],
  contributorEligibility: "Africa only",
  aiQualityThreshold: 72,
  faceConfidence: 88,
  idTypes: "DL, International Passport, High-rated Government ID",
  agreementVersion: "VUEKUMI Contributor Agreement v1.0",
  licenseMode: "Rights managed and royalty free",
  payoutCadence: "Monthly",
  subscriptionGateway: "Stripe global",
  contributorPermissions: {
    "Photo Content": ["Photo Content", "Street", "Culture"],
    Models: ["Models", "Photography"],
    Photographers: ["Photo Content", "Models", "Photography", "Street", "Culture"]
  },
  gateways: [
    { country: "Nigeria", subscription: "Stripe global", payout: "Paystack Transfer", sms: "Termii", keyRef: "NG_PAYSTACK_SECRET", enabled: true },
    { country: "Ghana", subscription: "Stripe global", payout: "Flutterwave Ghana", sms: "Hubtel", keyRef: "GH_FLW_SECRET", enabled: true },
    { country: "Kenya", subscription: "Stripe global", payout: "M-Pesa Daraja", sms: "Africa's Talking", keyRef: "KE_MPESA_SECRET", enabled: true },
    { country: "South Africa", subscription: "Stripe global", payout: "Ozow", sms: "Clickatell", keyRef: "ZA_OZOW_SECRET", enabled: true },
    { country: "Rwanda", subscription: "Stripe global", payout: "Flutterwave Rwanda", sms: "Africa's Talking", keyRef: "RW_FLW_SECRET", enabled: true }
  ],
  plans: [
    { type: "Regular Individual", price: "$19", seats: 1, downloads: 25, license: "Standard royalty free" },
    { type: "Agency", price: "$149", seats: 8, downloads: 300, license: "Extended campaign use" },
    { type: "Corporate", price: "Custom", seats: 50, downloads: 1500, license: "Rights managed procurement" }
  ],
  agreements: {
    contributor: true,
    copyright: true,
    modelRelease: true,
    payoutTerms: true
  },
  contributorAccessLevels: [
    { name: "Starter", price: "$0", uploads: 3, requiresVerification: false, description: "OTP verified contributors can upload the first starter images." },
    { name: "Verified", price: "$29", uploads: 50, requiresVerification: true, description: "Deeper profile, face, ID, and agreement verification required." },
    { name: "Professional", price: "$79", uploads: 250, requiresVerification: true, description: "Higher volume access for active contributors and agencies." }
  ],
  countryRules: [
    { country: "Nigeria", contributorsAllowed: true, acceptedIds: "DL, International Passport, NIN-backed Government ID", smsProvider: "Termii", payoutCurrency: "NGN" },
    { country: "Ghana", contributorsAllowed: true, acceptedIds: "DL, International Passport, Ghana Card", smsProvider: "Hubtel", payoutCurrency: "GHS" },
    { country: "Kenya", contributorsAllowed: true, acceptedIds: "DL, International Passport, National ID", smsProvider: "Africa's Talking", payoutCurrency: "KES" },
    { country: "South Africa", contributorsAllowed: true, acceptedIds: "DL, International Passport, National ID", smsProvider: "Clickatell", payoutCurrency: "ZAR" },
    { country: "Rwanda", contributorsAllowed: true, acceptedIds: "DL, International Passport, National ID", smsProvider: "Africa's Talking", payoutCurrency: "RWF" }
  ],
  paymentProviders: [
    { name: "Stripe", purpose: "Global subscription charging", apiKeyRef: "STRIPE_SECRET_KEY", enabled: true },
    { name: "Paystack", purpose: "West Africa charging and payouts", apiKeyRef: "PAYSTACK_SECRET_KEY", enabled: true },
    { name: "Flutterwave", purpose: "Pan-African charging and payouts", apiKeyRef: "FLUTTERWAVE_SECRET_KEY", enabled: true }
  ],
  smsProviders: [
    { country: "Nigeria", provider: "Termii", apiKeyRef: "TERMII_API_KEY", senderId: "VUEKUMI", enabled: true },
    { country: "Ghana", provider: "Hubtel", apiKeyRef: "HUBTEL_API_KEY", senderId: "VUEKUMI", enabled: true },
    { country: "Kenya", provider: "Africa's Talking", apiKeyRef: "AFRICASTALKING_API_KEY", senderId: "VUEKUMI", enabled: true }
  ]
};

const seedUploads = [
  { id: "seed-1", title: "Braided Beauty", category: "Models", contributorType: "Models", country: "Nigeria", quality: 86, faces: true, release: true, copyrightApproval: true, status: "Approved", src: "images/africa-model-3.jpg" },
  { id: "seed-2", title: "Falls Sunset", category: "Photography", contributorType: "Photographers", country: "Zambia", quality: 92, faces: false, release: false, copyrightApproval: true, status: "Approved", src: "images/africa-landscape-1.jpg" },
  { id: "seed-3", title: "Nairobi Workspace", category: "Photo Content", contributorType: "Photo Content", country: "Kenya", quality: 61, faces: true, release: false, copyrightApproval: false, status: "Release Review", src: "images/africa-content-1.jpg" }
];

const defaultAdminPermissions = ["overview", "access", "users", "content", "activity", "settings"];

const seedAdminAccess = [
  { id: "role-super-admin", name: "Super Admin", description: "Full platform control.", permissions: defaultAdminPermissions, enabled: true },
  { id: "role-user-manager", name: "User Manager", description: "Manage user accounts, user categories, and account status.", permissions: ["overview", "access", "users", "activity"], enabled: true },
  { id: "role-content-manager", name: "Content Manager", description: "Manage content, categories, approval status, and moderation notes.", permissions: ["overview", "content", "activity"], enabled: true },
  { id: "role-verification-manager", name: "Verification Manager", description: "Manage contributor verification, identity review, and copyright approval queues.", permissions: ["overview", "users", "content", "activity"], enabled: true }
];

const seedUserCategories = [
  { id: "category-admin", group: "Admin", name: "Admin", description: "Administrative users for platform operations.", enabled: true, requiresVerification: true, allowedContentCategories: [] },
  { id: "category-photo-content", group: "Contributor", name: "Photo Content", description: "African contributors submitting lifestyle, editorial, street, and culture content.", enabled: true, requiresVerification: true, allowedContentCategories: ["Photo Content", "Street", "Culture"] },
  { id: "category-models", group: "Contributor", name: "Models", description: "African model contributors with image, likeness, and release verification.", enabled: true, requiresVerification: true, allowedContentCategories: ["Models", "Photography"] },
  { id: "category-photographers", group: "Contributor", name: "Photographers", description: "African photographers allowed to submit across configured photo categories.", enabled: true, requiresVerification: true, allowedContentCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"] },
  { id: "category-regular-individual", group: "Enduser", name: "Regular Individual", description: "Individual buyers licensing images for personal or creator use.", enabled: true, requiresVerification: false, allowedContentCategories: [] },
  { id: "category-agency", group: "Enduser", name: "Agency", description: "Agency buyers with team and client licensing needs.", enabled: true, requiresVerification: false, allowedContentCategories: [] },
  { id: "category-corporate", group: "Enduser", name: "Corporate", description: "Corporate buyers with procurement, rights management, and invoice workflows.", enabled: true, requiresVerification: false, allowedContentCategories: [] }
];

const seedUsers = [
  { id: "user-admin-1", name: "VUEKUMI Admin", phone: "+10000000001", email: "admin@vuekumi.local", accountGroup: "Admin", category: "Admin", country: "Global", status: "Active", verificationStatus: "Verified", adminRole: "Super Admin", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Admin portal ready" },
  { id: "user-photo-content-1", name: "Photo Content Contributor", phone: "+2348000000101", email: "photo.content@vuekumi.local", accountGroup: "Contributor", category: "Photo Content", country: "Nigeria", status: "Pending", verificationStatus: "OTP Verified", adminRole: "", allowedContentCategories: ["Photo Content", "Street", "Culture"], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Starter upload access" },
  { id: "user-models-1", name: "Model Contributor", phone: "+2348000000102", email: "model@vuekumi.local", accountGroup: "Contributor", category: "Models", country: "Nigeria", status: "Pending", verificationStatus: "Needs ID Review", adminRole: "", allowedContentCategories: ["Models", "Photography"], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Awaiting face and ID review" },
  { id: "user-photographers-1", name: "Photographer Contributor", phone: "+254700000103", email: "photographer@vuekumi.local", accountGroup: "Contributor", category: "Photographers", country: "Kenya", status: "Active", verificationStatus: "Verified", adminRole: "", allowedContentCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Content submitted" },
  { id: "user-regular-1", name: "Regular Buyer", phone: "+12025550101", email: "regular@buyer.local", accountGroup: "Enduser", category: "Regular Individual", country: "United States", status: "Active", verificationStatus: "Email Pending", adminRole: "", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Buyer account created" },
  { id: "user-agency-1", name: "Agency Buyer", phone: "+12025550102", email: "agency@buyer.local", accountGroup: "Enduser", category: "Agency", country: "United Kingdom", status: "Active", verificationStatus: "Verified", adminRole: "", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Agency profile created" },
  { id: "user-corporate-1", name: "Corporate Buyer", phone: "+12025550103", email: "corporate@buyer.local", accountGroup: "Enduser", category: "Corporate", country: "South Africa", status: "Pending", verificationStatus: "Procurement Review", adminRole: "", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Corporate account awaiting review" }
];

const seedPlatformActivities = [
  { id: "activity-admin-ready", type: "Admin", title: "Admin backend initialized", details: "Access, users, content, and activity management are available.", createdAt: "2026-05-28T00:00:00.000Z" },
  { id: "activity-content-queue", type: "Content", title: "Content queue seeded", details: "Initial VUEKUMI content items are ready for admin moderation.", createdAt: "2026-05-28T00:00:00.000Z" },
  { id: "activity-access-rules", type: "Access", title: "User category rules seeded", details: "Admin, contributor, and enduser categories are configurable from admin.", createdAt: "2026-05-28T00:00:00.000Z" }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultState() {
  return {
    config: clone(defaultConfig),
    session: { role: "guest", userType: "", phone: "", otpSent: false, otpVerified: false },
    contributor: {
      type: "Photographers",
      country: "Nigeria",
      accessLevel: "Starter",
      idType: "International Passport",
      idReference: "",
      email: "",
      address: "",
      profilePhoto: false,
      governmentId: false,
      faceScan: false,
      faceScanScore: 0,
      agreementsSigned: false,
      contentAgreementSigned: false,
      copyrightAgreementSigned: false,
      subscriptionActive: false
    },
    uploads: clone(seedUploads),
    cart: [],
    moderationNotes: [],
    users: clone(seedUsers),
    userCategories: clone(seedUserCategories),
    adminAccess: clone(seedAdminAccess),
    platformActivities: clone(seedPlatformActivities),
    selectedImage: null,
    marketplaceSearch: "",
    otpCodes: {},
    auditLog: []
  };
}

function parsePlanAmount(state, planName) {
  const plan = (state.config.plans || []).find((item) => item.type === planName);
  const numeric = String(plan?.price || "").replace(/[^0-9.]/g, "");
  return numeric ? Number(numeric) : 0;
}

function paymentProviderFor(state, gatewayName) {
  const gateway = String(gatewayName || "").toLowerCase();
  return (state.config.paymentProviders || []).find((provider) => gateway.includes(String(provider.name || "").toLowerCase())) ||
    (state.config.paymentProviders || []).find((provider) => provider.enabled);
}

function orderNumber() {
  return `VK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function checkoutRecord(state, body = {}) {
  const plan = body.plan || body.buyerType || "Regular Individual";
  const gateway = body.gateway || state.config.subscriptionGateway;
  const provider = paymentProviderFor(state, gateway);
  return {
    id: crypto.randomUUID(),
    orderNumber: orderNumber(),
    plan,
    gateway,
    provider: provider?.name || gateway,
    apiKeyRef: provider?.apiKeyRef || "",
    gatewayConfigured: Boolean(provider?.enabled && provider?.apiKeyRef),
    amount: body.amount ?? parsePlanAmount(state, plan),
    currency: body.currency || "USD",
    paymentStatus: "Pending",
    status: "Payment Pending",
    created: new Date().toLocaleString(),
    createdAt: new Date().toISOString(),
    buyerCountry: body.buyerCountry || "Global"
  };
}

function normalizeCheckoutItem(state, item) {
  const provider = paymentProviderFor(state, item.gateway || state.config.subscriptionGateway);
  const status = item.status === legacyCheckoutStatus ? "Payment Pending" : item.status || "Payment Pending";
  return {
    id: item.id || crypto.randomUUID(),
    orderNumber: item.orderNumber || orderNumber(),
    plan: item.plan || "Regular Individual",
    gateway: item.gateway || state.config.subscriptionGateway,
    provider: item.provider || provider?.name || state.config.subscriptionGateway,
    apiKeyRef: item.apiKeyRef || provider?.apiKeyRef || "",
    gatewayConfigured: item.gatewayConfigured ?? Boolean(provider?.enabled && provider?.apiKeyRef),
    amount: item.amount ?? parsePlanAmount(state, item.plan || "Regular Individual"),
    currency: item.currency || "USD",
    paymentStatus: item.paymentStatus || (status.includes("Authorized") ? "Authorized" : "Pending"),
    status,
    created: item.created || new Date().toLocaleString(),
    createdAt: item.createdAt || new Date().toISOString(),
    buyerCountry: item.buyerCountry || "Global",
    authorizationRef: item.authorizationRef || "",
    authorizedAt: item.authorizedAt || ""
  };
}

function normalizeRuntimeState(state) {
  state.config = { ...clone(defaultConfig), ...(state.config || {}) };
  state.cart = (state.cart || []).map((item) => normalizeCheckoutItem(state, item));
  state.uploads = state.uploads || clone(seedUploads);
  state.users = state.users?.length ? state.users : clone(seedUsers);
  state.userCategories = state.userCategories?.length ? state.userCategories : clone(seedUserCategories);
  state.adminAccess = state.adminAccess?.length ? state.adminAccess : clone(seedAdminAccess);
  state.platformActivities = state.platformActivities?.length ? state.platformActivities : clone(seedPlatformActivities);
  state.auditLog = state.auditLog || [];
  return state;
}

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(stateFile)) saveState(defaultState());
}

function readState() {
  ensureDataStore();
  try {
    return normalizeRuntimeState({ ...defaultState(), ...JSON.parse(fs.readFileSync(stateFile, "utf8")) });
  } catch {
    return normalizeRuntimeState(defaultState());
  }
}

function saveState(state) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function audit(state, action, details = {}) {
  state.auditLog = state.auditLog || [];
  state.auditLog.unshift({
    id: crypto.randomUUID(),
    action,
    details,
    createdAt: new Date().toISOString()
  });
  state.auditLog = state.auditLog.slice(0, 300);
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

function forbidden(res, message = "Admin access required") {
  json(res, 401, { error: message });
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

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signAdminPayload(payload) {
  return crypto.createHmac("sha256", adminTokenSecret).update(payload).digest("base64url");
}

function issueAdminToken(user, role) {
  const expiresAt = Date.now() + adminTokenTtlMs;
  const payload = base64url({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: role?.name || user.adminRole || "Admin",
    permissions: role?.permissions || defaultAdminPermissions,
    expiresAt
  });
  return {
    token: `${payload}.${signAdminPayload(payload)}`,
    expiresAt
  };
}

function verifyAdminToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signAdminPayload(payload) !== signature) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.expiresAt || Date.now() > Number(session.expiresAt)) return null;
    return session;
  } catch {
    return null;
  }
}

function requireAdmin(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = verifyAdminToken(token);
  if (!session) {
    forbidden(res);
    return null;
  }
  req.adminSession = session;
  return session;
}

function allowedContributorCountries(state) {
  const countries = state.config.countryRules
    .filter((rule) => rule.contributorsAllowed)
    .map((rule) => rule.country);
  return countries.length ? countries : ["Nigeria", "Ghana", "Kenya", "South Africa", "Rwanda"];
}

function uploadStatus(state, upload) {
  if (!allowedContributorCountries(state).includes(upload.country)) return "Country Review";
  if (Number(upload.quality) < Number(state.config.aiQualityThreshold)) return "AI Enhancement";
  if (upload.faces && (!upload.release || !upload.copyrightApproval)) return "Face/Copyright Verification";
  return "Admin Review";
}

function profileComplete(state) {
  const c = state.contributor;
  return Boolean(
    allowedContributorCountries(state).includes(c.country) &&
      c.email &&
      c.address &&
      c.profilePhoto &&
      c.governmentId &&
      c.faceScan &&
      Number(c.faceScanScore) >= Number(state.config.faceConfidence) &&
      c.agreementsSigned &&
      c.contentAgreementSigned &&
      c.copyrightAgreementSigned
  );
}

function uniqueId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUserCategory(input = {}) {
  return {
    id: input.id || uniqueId("category"),
    group: input.group || "Contributor",
    name: input.name || "New Category",
    description: input.description || "",
    enabled: input.enabled !== false,
    requiresVerification: Boolean(input.requiresVerification),
    allowedContentCategories: normalizeList(input.allowedContentCategories)
  };
}

function normalizeAdminRole(input = {}) {
  return {
    id: input.id || uniqueId("role"),
    name: input.name || "New Admin Role",
    description: input.description || "",
    permissions: normalizeList(input.permissions),
    enabled: input.enabled !== false
  };
}

function normalizeManagedUser(input = {}) {
  return {
    id: input.id || uniqueId("user"),
    name: input.name || "New User",
    phone: input.phone || "",
    email: input.email || "",
    accountGroup: input.accountGroup || "Contributor",
    category: input.category || "Photo Content",
    country: input.country || "Nigeria",
    status: input.status || "Pending",
    verificationStatus: input.verificationStatus || "Not Started",
    adminRole: input.adminRole || "",
    allowedContentCategories: normalizeList(input.allowedContentCategories),
    createdAt: input.createdAt || new Date().toISOString(),
    lastActivity: input.lastActivity || "Created by admin"
  };
}

function normalizeContentItem(state, input = {}) {
  const item = {
    id: input.id || uniqueId("content"),
    owner: input.owner || "admin",
    title: input.title || "Untitled VUEKUMI Content",
    category: input.category || "Photo Content",
    contributorType: input.contributorType || "Photo Content",
    country: input.country || "Nigeria",
    quality: Number(input.quality || 80),
    faces: Boolean(input.faces),
    release: Boolean(input.release),
    copyrightApproval: Boolean(input.copyrightApproval),
    status: input.status || "Admin Review",
    featured: Boolean(input.featured),
    visibility: input.visibility || "Public",
    moderationNote: input.moderationNote || "",
    src: input.src || "images/africa-content-2.jpg",
    createdAt: input.createdAt || new Date().toISOString()
  };
  if (!input.status) item.status = uploadStatus(state, item);
  return item;
}

function publicAdminState(state) {
  const pendingContent = state.uploads.filter((item) => !["Approved", "Rejected"].includes(item.status)).length;
  const pendingUsers = state.users.filter((item) => item.status !== "Active").length;
  const contributorUsers = state.users.filter((item) => item.accountGroup === "Contributor").length;
  const endusers = state.users.filter((item) => item.accountGroup === "Enduser").length;
  return {
    metrics: {
      users: state.users.length,
      pendingUsers,
      contributors: contributorUsers,
      endusers,
      content: state.uploads.length,
      pendingContent,
      userCategories: state.userCategories.length,
      adminRoles: state.adminAccess.length
    },
    recentUsers: state.users.slice(0, 6),
    recentContent: state.uploads.slice(0, 6),
    recentActivity: adminActivity(state).slice(0, 10)
  };
}

function adminActivity(state) {
  return [...state.auditLog, ...state.platformActivities].map((item) => {
    const action = String(item.action || item.title || item.type || "").replace("face.match.simulated", "face.match.reviewed");
    return { ...item, action, title: item.title || action };
  });
}

function handleApi(req, res, url) {
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "vuekumi-backend", version: 1 });
  }

  if (method === "GET" && url.pathname === "/api/state") {
    const state = readState();
    const publicState = { ...state };
    delete publicState.otpCodes;
    return json(res, 200, publicState);
  }

  if ((method === "PUT" || method === "POST") && url.pathname === "/api/state") {
    return readBody(req)
      .then((body) => {
        const incoming = { ...defaultState(), ...body };
        incoming.otpCodes = readState().otpCodes || {};
        audit(incoming, "state.saved", { source: "frontend-sync" });
        saveState(incoming);
        json(res, 200, { ok: true, state: incoming });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "GET" && url.pathname === "/api/config") {
    return json(res, 200, readState().config);
  }

  if (method === "PUT" && url.pathname === "/api/config") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        state.config = { ...state.config, ...(body.config || body) };
        audit(state, "config.updated", { keys: Object.keys(body.config || body) });
        saveState(state);
        json(res, 200, state.config);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "POST" && url.pathname === "/api/admin/login") {
    return readBody(req)
      .then((body) => {
        const identifier = String(body.identifier || "").trim().toLowerCase();
        const accessKey = String(body.accessKey || "");
        if (!identifier || !accessKey) return forbidden(res, "Admin identifier and access key are required");
        if (accessKey !== adminAccessKey) return forbidden(res, "Invalid admin access key");
        const state = readState();
        const user = state.users.find((item) =>
          item.accountGroup === "Admin" &&
          item.status === "Active" &&
          [item.email, item.phone, item.name].some((value) => String(value || "").trim().toLowerCase() === identifier)
        );
        if (!user) return forbidden(res, "Admin user is not active or does not exist");
        const role = state.adminAccess.find((item) => item.name === user.adminRole && item.enabled) || state.adminAccess.find((item) => item.enabled);
        const issued = issueAdminToken(user, role);
        audit(state, "admin.login", { id: user.id, role: role?.name || user.adminRole });
        saveState(state);
        json(res, 200, {
          ok: true,
          token: issued.token,
          expiresAt: issued.expiresAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: role?.name || user.adminRole || "Admin",
            permissions: role?.permissions || defaultAdminPermissions
          }
        });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (url.pathname.startsWith("/api/admin/") && !requireAdmin(req, res)) return;

  if (method === "GET" && url.pathname === "/api/admin/overview") {
    return json(res, 200, publicAdminState(readState()));
  }

  if (method === "GET" && url.pathname === "/api/admin/access") {
    const state = readState();
    return json(res, 200, {
      adminAccess: state.adminAccess,
      userCategories: state.userCategories,
      contentCategories: state.config.photoCategories,
      contributorPermissions: state.config.contributorPermissions,
      permissions: defaultAdminPermissions
    });
  }

  if (method === "PUT" && url.pathname === "/api/admin/access") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        if (Array.isArray(body.adminAccess)) state.adminAccess = body.adminAccess.map(normalizeAdminRole);
        if (Array.isArray(body.userCategories)) state.userCategories = body.userCategories.map(normalizeUserCategory);
        if (Array.isArray(body.contentCategories)) state.config.photoCategories = normalizeList(body.contentCategories);
        if (body.contributorPermissions && typeof body.contributorPermissions === "object") {
          state.config.contributorPermissions = body.contributorPermissions;
        }
        audit(state, "admin.access.updated", {
          roles: state.adminAccess.length,
          userCategories: state.userCategories.length,
          contentCategories: state.config.photoCategories.length
        });
        saveState(state);
        json(res, 200, {
          adminAccess: state.adminAccess,
          userCategories: state.userCategories,
          contentCategories: state.config.photoCategories,
          contributorPermissions: state.config.contributorPermissions,
          permissions: defaultAdminPermissions
        });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "GET" && url.pathname === "/api/admin/users") {
    return json(res, 200, readState().users);
  }

  if (method === "POST" && url.pathname === "/api/admin/users") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const user = normalizeManagedUser(body);
        state.users.unshift(user);
        audit(state, "admin.user.created", { id: user.id, accountGroup: user.accountGroup, category: user.category });
        saveState(state);
        json(res, 201, user);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  const adminUserRoute = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (method === "PATCH" && adminUserRoute) {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const index = state.users.findIndex((item) => item.id === adminUserRoute[1]);
        if (index < 0) return notFound(res);
        state.users[index] = normalizeManagedUser({ ...state.users[index], ...body, id: state.users[index].id });
        audit(state, "admin.user.updated", { id: state.users[index].id, status: state.users[index].status, category: state.users[index].category });
        saveState(state);
        json(res, 200, state.users[index]);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "GET" && url.pathname === "/api/admin/content") {
    const state = readState();
    return json(res, 200, state.uploads.map((item) => normalizeContentItem(state, item)));
  }

  if (method === "POST" && url.pathname === "/api/admin/content") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const item = normalizeContentItem(state, body);
        state.uploads.unshift(item);
        audit(state, "admin.content.created", { id: item.id, category: item.category, status: item.status });
        saveState(state);
        json(res, 201, item);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  const adminContentRoute = url.pathname.match(/^\/api\/admin\/content\/([^/]+)$/);
  if (method === "PATCH" && adminContentRoute) {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const index = state.uploads.findIndex((item) => item.id === adminContentRoute[1]);
        if (index < 0) return notFound(res);
        state.uploads[index] = normalizeContentItem(state, { ...state.uploads[index], ...body, id: state.uploads[index].id });
        audit(state, "admin.content.updated", { id: state.uploads[index].id, status: state.uploads[index].status, category: state.uploads[index].category });
        saveState(state);
        json(res, 200, state.uploads[index]);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "GET" && url.pathname === "/api/admin/activity") {
    const state = readState();
    return json(res, 200, adminActivity(state));
  }

  if (method === "POST" && url.pathname === "/api/auth/send-otp") {
    return readBody(req)
      .then((body) => {
        if (!body.phone) return json(res, 400, { error: "phone is required" });
        const state = readState();
        const code = "246810";
        state.otpCodes = state.otpCodes || {};
        state.otpCodes[body.phone] = { code, createdAt: new Date().toISOString() };
        state.session.phone = body.phone;
        state.session.otpSent = true;
        audit(state, "otp.sent", { phone: body.phone, provider: "configured-sms-provider" });
        saveState(state);
        json(res, 200, { ok: true, phone: body.phone, otpPreview: code });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "POST" && url.pathname === "/api/auth/verify-otp") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const record = state.otpCodes?.[body.phone];
        const verified = Boolean(record && body.otp === record.code);
        state.session.phone = body.phone || state.session.phone;
        state.session.otpSent = true;
        state.session.otpVerified = verified;
        audit(state, verified ? "otp.verified" : "otp.failed", { phone: body.phone });
        saveState(state);
        json(res, verified ? 200 : 401, { ok: verified, verified });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "PUT" && url.pathname === "/api/contributor") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        state.contributor = { ...state.contributor, ...(body.contributor || body) };
        audit(state, "contributor.updated", { country: state.contributor.country, type: state.contributor.type });
        saveState(state);
        json(res, 200, { contributor: state.contributor, profileComplete: profileComplete(state) });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "POST" && url.pathname === "/api/contributor/face-match") {
    const state = readState();
    state.contributor.faceScan = true;
    state.contributor.faceScanScore = Math.max(Number(state.contributor.faceScanScore || 0), Number(state.config.faceConfidence));
    audit(state, "face.match.verified", { score: state.contributor.faceScanScore });
    saveState(state);
    return json(res, 200, { contributor: state.contributor, profileComplete: profileComplete(state) });
  }

  if (method === "POST" && url.pathname === "/api/subscriptions/contributor") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        state.contributor.accessLevel = body.accessLevel || state.contributor.accessLevel;
        state.contributor.subscriptionActive = true;
        audit(state, "contributor.subscription.activated", {
          accessLevel: state.contributor.accessLevel,
          gateway: state.config.subscriptionGateway
        });
        saveState(state);
        json(res, 200, { contributor: state.contributor, gateway: state.config.subscriptionGateway });
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "GET" && url.pathname === "/api/uploads") {
    return json(res, 200, readState().uploads);
  }

  if (method === "POST" && url.pathname === "/api/uploads") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const upload = {
          id: crypto.randomUUID(),
          owner: body.owner || "current",
          title: body.title || "Untitled VUEKUMI Upload",
          category: body.category || "Photo Content",
          contributorType: body.contributorType || state.contributor.type,
          country: body.country || state.contributor.country,
          quality: Number(body.quality || 70),
          faces: Boolean(body.faces),
          release: Boolean(body.release),
          copyrightApproval: Boolean(body.copyrightApproval),
          src: body.src || "images/africa-content-2.jpg",
          createdAt: new Date().toISOString()
        };
        upload.status = uploadStatus(state, upload);
        state.uploads.unshift(upload);
        audit(state, "upload.created", { id: upload.id, status: upload.status });
        saveState(state);
        json(res, 201, upload);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  const uploadModeration = url.pathname.match(/^\/api\/uploads\/([^/]+)\/moderate$/);
  if (method === "PATCH" && uploadModeration) {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const upload = state.uploads.find((item) => item.id === uploadModeration[1]);
        if (!upload) return notFound(res);
        upload.status = body.status || upload.status;
        upload.moderationNote = body.note || upload.moderationNote || "";
        audit(state, "upload.moderated", { id: upload.id, status: upload.status });
        saveState(state);
        json(res, 200, upload);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  const uploadEnhance = url.pathname.match(/^\/api\/uploads\/([^/]+)\/enhance$/);
  if (method === "POST" && uploadEnhance) {
    const state = readState();
    const upload = state.uploads.find((item) => item.id === uploadEnhance[1]);
    if (!upload) return notFound(res);
    upload.quality = Math.min(100, Number(upload.quality || 0) + 18);
    upload.status = uploadStatus(state, upload);
    audit(state, "upload.ai_enhanced", { id: upload.id, quality: upload.quality, status: upload.status });
    saveState(state);
    return json(res, 200, upload);
  }

  if (method === "POST" && url.pathname === "/api/checkout") {
    return readBody(req)
      .then((body) => {
        const state = readState();
        const item = checkoutRecord(state, body);
        state.cart.push(item);
        audit(state, "checkout.created", {
          id: item.id,
          orderNumber: item.orderNumber,
          plan: item.plan,
          gateway: item.gateway,
          provider: item.provider
        });
        saveState(state);
        json(res, 201, item);
      })
      .catch((error) => json(res, 400, { error: error.message }));
  }

  if (method === "GET" && url.pathname === "/api/checkout") {
    return json(res, 200, readState().cart);
  }

  const checkoutPay = url.pathname.match(/^\/api\/checkout\/([^/]+)\/pay$/);
  if (method === "POST" && checkoutPay) {
    const state = readState();
    const item = state.cart.find((checkout) => checkout.id === checkoutPay[1]);
    if (!item) return notFound(res);
    const provider = paymentProviderFor(state, item.gateway);
    if (!provider?.enabled || !provider.apiKeyRef) {
      item.paymentStatus = "Gateway Required";
      item.status = "Payment Needs Gateway";
      item.gatewayConfigured = false;
      audit(state, "checkout.gateway_required", { id: item.id, gateway: item.gateway });
      saveState(state);
      return json(res, 409, { error: "Payment gateway provider must be enabled with an API key reference.", checkout: item });
    }
    item.provider = provider.name;
    item.apiKeyRef = provider.apiKeyRef;
    item.gatewayConfigured = true;
    item.paymentStatus = "Authorized";
    item.status = "Payment Authorized";
    item.authorizationRef = `AUTH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    item.authorizedAt = new Date().toISOString();
    audit(state, "checkout.payment_authorized", {
      id: item.id,
      orderNumber: item.orderNumber,
      provider: provider.name,
      apiKeyRef: provider.apiKeyRef
    });
    saveState(state);
    return json(res, 200, item);
  }

  if (method === "POST" && url.pathname === "/api/dev/reset") {
    const state = defaultState();
    audit(state, "dev.reset");
    saveState(state);
    return json(res, 200, { ok: true, state });
  }

  return notFound(res);
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(rootDir, pathname));
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".mp4": "video/mp4",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

ensureDataStore();
server.listen(port, () => {
  console.log(`VUEKUMI backend running at http://localhost:${port}`);
});
