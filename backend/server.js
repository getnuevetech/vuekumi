const http = require("http");
const fs = require("fs");
const path = require("path");
const { rootDir, readState, writeState, audit, normalizeConfig, normalizeRole, normalizeUserCategory, normalizeUser, normalizeContributorProfile, normalizeAsset, uniqueId } = require("./store");
const { adminAccessKey, adminTokenTtlMs, contributorTokenTtlMs, otpTtlMs, issueToken, verifyToken, bearerToken, randomOtp } = require("./auth");
const {
  allowedContributorCountries,
  allowedCategoriesForContributor,
  profileComplete,
  syncUserFromContributor,
  findContributorProfile,
  findOrCreateContributorByPhone,
  createAssetForContributor,
  uploadStatus,
  createOrder,
  authorizeOrder,
  createLicenseFromOrder,
  integrationMatrix,
  publicState,
  adminOverview,
  adminActivity,
  permissionList
} = require("./platform");

const port = Number(process.env.PORT || 4180);

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

function forbidden(res, message = "Access denied") {
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

function requireAdmin(req, res, state = readState()) {
  const claims = verifyToken("admin", bearerToken(req));
  if (!claims) {
    forbidden(res, "Admin access required");
    return null;
  }
  const saved = state.sessions.admins?.[claims.sessionId];
  const user = state.users.find((item) => item.id === claims.sub && item.accountGroup === "Admin" && item.status === "Active");
  if (!saved || saved.token !== bearerToken(req) || !user) {
    forbidden(res, "Admin session is invalid");
    return null;
  }
  req.adminSession = { ...claims, user };
  return req.adminSession;
}

function requireAdminPermission(req, res, permission) {
  const permissions = req.adminSession?.permissions || [];
  if (permissions.includes(permission) || permissions.includes("settings")) return true;
  json(res, 403, { error: `${permission} permission required` });
  return false;
}

function contributorClaimsFromRequest(req, state) {
  const claims = verifyToken("contributor", bearerToken(req));
  if (!claims) return null;
  const saved = state.sessions.contributors?.[claims.sessionId];
  const user = state.users.find((item) => item.id === claims.sub && item.accountGroup === "Contributor");
  if (!saved || saved.token !== bearerToken(req) || !user || !["Active", "Pending"].includes(user.status)) return null;
  return { ...claims, user };
}

function requireContributor(req, res, state) {
  const claims = contributorClaimsFromRequest(req, state);
  if (!claims) {
    forbidden(res, "Contributor phone verification required");
    return null;
  }
  const profile = findContributorProfile(state, claims.sub);
  if (!profile) {
    forbidden(res, "Contributor profile required");
    return null;
  }
  req.contributorSession = claims;
  return { claims, user: claims.user, profile };
}

function activeRoleForUser(state, user) {
  return state.access.roles.find((role) => role.enabled && role.name === user.adminRole) ||
    state.access.roles.find((role) => role.enabled);
}

function publicAdminUser(user, role) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: role?.name || user.adminRole || "Admin",
    permissions: role?.permissions || permissionList()
  };
}

function issueAdminSession(state, user, role) {
  const sessionId = uniqueId("admin-session");
  const issued = issueToken("admin", {
    sessionId,
    sub: user.id,
    role: role?.name || user.adminRole || "Admin",
    permissions: role?.permissions || permissionList()
  }, adminTokenTtlMs);
  state.sessions.admins[sessionId] = {
    token: issued.token,
    userId: user.id,
    role: role?.name || user.adminRole || "Admin",
    expiresAt: issued.expiresAt,
    createdAt: new Date().toISOString()
  };
  return issued;
}

function issueContributorSession(state, user, profile) {
  const sessionId = uniqueId("contributor-session");
  const issued = issueToken("contributor", {
    sessionId,
    sub: user.id,
    phone: user.phone,
    category: profile.type,
    country: profile.country
  }, contributorTokenTtlMs);
  state.sessions.contributors[sessionId] = {
    token: issued.token,
    userId: user.id,
    phone: user.phone,
    category: profile.type,
    expiresAt: issued.expiresAt,
    createdAt: new Date().toISOString()
  };
  return issued;
}

function platformContract() {
  return {
    name: "VUEKUMI Platform API",
    version: 2,
    status: "new-backend",
    legacyAdminBackend: {
      retained: true,
      reason: "Existing admin.html/admin.js remain active as a fallback while the new /admin-v2.html backend is reviewed.",
      routes: ["/api/admin/login", "/api/admin/overview", "/api/admin/access", "/api/admin/users", "/api/admin/content", "/api/admin/activity"]
    },
    legacyPublicWrappers: {
      retained: true,
      reason: "Current public overlay still calls old /api/* paths and should migrate to /api/v2/* next.",
      routes: ["/api/state", "/api/auth/*", "/api/contributor", "/api/uploads", "/api/checkout"]
    },
    routes: {
      platform: ["GET /api/v2/health", "GET /api/v2/platform", "GET /api/v2/config", "GET /api/v2/integrations"],
      auth: ["POST /api/v2/auth/otp/send", "POST /api/v2/auth/otp/verify"],
      contributor: [
        "GET /api/v2/contributors/me",
        "PUT|PATCH /api/v2/contributors/me",
        "POST /api/v2/contributors/me/face-match",
        "POST /api/v2/contributors/me/access"
      ],
      assets: ["GET /api/v2/assets", "POST /api/v2/assets"],
      commerce: ["GET /api/v2/orders", "POST /api/v2/orders", "POST /api/v2/orders/:id/pay", "GET /api/v2/licenses"],
      admin: [
        "POST /api/v2/admin/login",
        "GET /api/v2/admin/dashboard",
        "GET|PUT /api/v2/admin/access",
        "GET|PUT /api/v2/admin/config",
        "GET|POST /api/v2/admin/users",
        "PATCH /api/v2/admin/users/:id",
        "GET /api/v2/admin/contributors",
        "GET|POST /api/v2/admin/assets",
        "PATCH /api/v2/admin/assets/:id",
        "POST /api/v2/admin/assets/:id/enhance",
        "GET /api/v2/admin/commerce",
        "GET|PUT /api/v2/admin/integrations",
        "GET /api/v2/admin/activity"
      ]
    }
  };
}

function adminDashboardV2(state) {
  const overview = adminOverview(state);
  return {
    ...overview,
    queues: {
      identityReview: state.contributorProfiles.filter((profile) => !profileComplete(state, profile)).length,
      aiEnhancement: state.aiJobs.filter((job) => job.status !== "Enhanced").length,
      faceApproval: state.faceApprovalCases.filter((item) => !String(item.status || "").toLowerCase().includes("release on file")).length,
      moderation: state.assets.filter((asset) => !["Approved", "Rejected"].includes(asset.status)).length,
      paymentCredentials: integrationMatrix(state).paymentProviders.filter((provider) => provider.enabled && !provider.credentialsLoaded).length
    },
    contentMosaic: state.assets.slice(0, 18),
    contributorProfiles: state.contributorProfiles.slice(0, 8),
    orders: state.orders.slice(0, 8),
    licenses: state.licenses.slice(0, 8)
  };
}

function adminContributorRecords(state) {
  return state.contributorProfiles.map((profile) => {
    const user = state.users.find((item) => item.id === profile.userId) || {};
    return {
      ...profile,
      user,
      profileComplete: profileComplete(state, profile),
      allowedCategories: allowedCategoriesForContributor(state, profile.type)
    };
  });
}

function adminCommerceState(state) {
  return {
    orders: state.orders,
    licenses: state.licenses,
    payouts: state.payouts,
    plans: state.config.plans,
    paymentProviders: integrationMatrix(state).paymentProviders,
    countryGateways: integrationMatrix(state).countryGateways
  };
}

async function sendOtpChallenge(req, res, options = {}) {
  const body = await readBody(req);
  if (!body.phone) return json(res, 400, { error: "phone is required" });
  const state = readState();
  const phone = String(body.phone).trim();
  const code = randomOtp();
  const expiresAt = Date.now() + otpTtlMs;
  state.otpChallenges[phone] = {
    code,
    purpose: body.purpose || "contributor-login",
    createdAt: new Date().toISOString(),
    expiresAt
  };
  audit(state, "otp.sent", { phone, provider: "country-sms-provider", apiVersion: options.apiVersion || "legacy" });
  writeState(state);
  const payload = { ok: true, phone };
  if (options.apiVersion === "v2") payload.challenge = { purpose: state.otpChallenges[phone].purpose, expiresAt };
  if (process.env.NODE_ENV !== "production") payload.otpPreview = code;
  return json(res, 200, payload);
}

async function verifyContributorOtp(req, res, options = {}) {
  const body = await readBody(req);
  const phone = String(body.phone || "").trim();
  const state = readState();
  const challenge = state.otpChallenges[phone];
  const verified = Boolean(challenge && Date.now() <= Number(challenge.expiresAt) && body.otp === challenge.code);
  if (!verified) {
    audit(state, "otp.failed", { phone, apiVersion: options.apiVersion || "legacy" });
    writeState(state);
    return json(res, 401, { ok: false, verified: false });
  }

  const { user, profile } = findOrCreateContributorByPhone(state, phone);
  user.verificationStatus = "OTP Verified";
  user.lastActivity = "Phone OTP verified";
  const issued = issueContributorSession(state, user, profile);
  delete state.otpChallenges[phone];
  audit(state, "otp.verified", { phone, userId: user.id, apiVersion: options.apiVersion || "legacy" }, user.id);
  writeState(state);
  return json(res, 200, {
    ok: true,
    verified: true,
    token: issued.token,
    expiresAt: issued.expiresAt,
    session: options.apiVersion === "v2" ? { token: issued.token, expiresAt: issued.expiresAt, type: "contributor" } : undefined,
    user,
    contributor: profile
  });
}

function contributorMe(req, res) {
  const state = readState();
  const auth = requireContributor(req, res, state);
  if (!auth) return;
  return json(res, 200, {
    user: auth.user,
    contributor: auth.profile,
    profileComplete: profileComplete(state, auth.profile),
    allowedCountries: allowedContributorCountries(state),
    allowedCategories: allowedCategoriesForContributor(state, auth.profile.type)
  });
}

async function updateContributorProfile(req, res) {
  const state = readState();
  const auth = requireContributor(req, res, state);
  if (!auth) return;
  const body = await readBody(req);
  const nextProfile = {
    ...auth.profile,
    ...(body.contributor || body),
    userId: auth.user.id
  };
  if (!allowedContributorCountries(state).includes(nextProfile.country)) {
    return json(res, 403, { error: "VUEKUMI currently accepts contributors only from admin-approved African countries." });
  }
  const index = state.contributorProfiles.findIndex((profile) => profile.userId === auth.user.id);
  state.contributorProfiles[index] = normalizeContributorProfile(nextProfile, auth.user);
  syncUserFromContributor(state, auth.user, state.contributorProfiles[index]);
  audit(state, "contributor.updated", { userId: auth.user.id, country: nextProfile.country, type: nextProfile.type }, auth.user.id);
  writeState(state);
  return json(res, 200, {
    contributor: state.contributorProfiles[index],
    profileComplete: profileComplete(state, state.contributorProfiles[index]),
    allowedCategories: allowedCategoriesForContributor(state, state.contributorProfiles[index].type)
  });
}

function runContributorFaceMatch(req, res) {
  const state = readState();
  const auth = requireContributor(req, res, state);
  if (!auth) return;
  auth.profile.faceScan = true;
  auth.profile.faceScanScore = Math.max(Number(auth.profile.faceScanScore || 0), Number(state.config.faceConfidence || 88));
  syncUserFromContributor(state, auth.user, auth.profile);
  audit(state, "face.match.verified", { userId: auth.user.id, score: auth.profile.faceScanScore }, auth.user.id);
  writeState(state);
  return json(res, 200, { contributor: auth.profile, profileComplete: profileComplete(state, auth.profile) });
}

async function activateContributorAccess(req, res) {
  const state = readState();
  const auth = requireContributor(req, res, state);
  if (!auth) return;
  const body = await readBody(req);
  const level = (state.config.contributorAccessLevels || []).find((item) => item.name === (body.accessLevel || auth.profile.accessLevel));
  if (!level) return json(res, 400, { error: "Unknown contributor access level" });
  if (level.requiresVerification && !profileComplete(state, auth.profile)) {
    return json(res, 403, { error: "Complete profile, face, ID, and agreement verification before activating this access level." });
  }
  auth.profile.accessLevel = level.name;
  auth.profile.subscriptionActive = true;
  syncUserFromContributor(state, auth.user, auth.profile);
  audit(state, "contributor.subscription.activated", { userId: auth.user.id, accessLevel: level.name, gateway: state.config.subscriptionGateway }, auth.user.id);
  writeState(state);
  return json(res, 200, { contributor: auth.profile, gateway: state.config.subscriptionGateway });
}

async function createContributorAsset(req, res, options = {}) {
  const state = readState();
  const auth = requireContributor(req, res, state);
  if (!auth) return;
  const result = createAssetForContributor(state, auth.user, auth.profile, await readBody(req));
  if (result.error) return json(res, result.errorStatus || 400, { error: result.error, uploadAccess: result.uploadAccess });
  syncUserFromContributor(state, auth.user, auth.profile);
  audit(state, "upload.created", { id: result.asset.id, userId: auth.user.id, status: result.asset.status, apiVersion: options.apiVersion || "legacy" }, auth.user.id);
  writeState(state);
  if (options.apiVersion === "v2") return json(res, 201, { asset: result.asset, uploadAccess: result.uploadAccess });
  return json(res, 201, { ...result.asset, uploadAccess: result.uploadAccess });
}

async function createBuyerOrder(req, res, options = {}) {
  const state = readState();
  const order = createOrder(state, await readBody(req));
  state.orders.push(order);
  audit(state, "checkout.created", { id: order.id, orderNumber: order.orderNumber, plan: order.plan, gateway: order.gateway, provider: order.provider, apiVersion: options.apiVersion || "legacy" });
  writeState(state);
  if (options.apiVersion === "v2") return json(res, 201, { order });
  return json(res, 201, order);
}

function payBuyerOrder(req, res, orderId, options = {}) {
  const state = readState();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return notFound(res);
  const result = authorizeOrder(state, order);
  const license = result.order.paymentStatus === "Authorized" ? createLicenseFromOrder(state, result.order) : null;
  audit(state, result.order.paymentStatus === "Authorized" ? "checkout.payment_authorized" : "checkout.provider_pending", {
    id: order.id,
    orderNumber: order.orderNumber,
    provider: order.provider,
    apiKeyRef: order.apiKeyRef,
    apiVersion: options.apiVersion || "legacy"
  });
  writeState(state);
  if (result.error) return json(res, result.statusCode, { error: result.error, checkout: result.order });
  if (options.apiVersion === "v2") return json(res, result.statusCode, { order: result.order, license });
  return json(res, result.statusCode, result.order);
}

async function handleV2Api(req, res, url) {
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/v2/health") {
    return json(res, 200, { ok: true, service: "vuekumi-platform-api", version: 2, contract: platformContract() });
  }

  if (method === "GET" && url.pathname === "/api/v2/platform") {
    const state = readState();
    return json(res, 200, {
      platform: state.platform,
      config: state.config,
      accessModel: {
        contributorTypes: state.config.contributorTypes,
        photoCategories: state.config.photoCategories,
        enduserTypes: state.config.userTypes,
        contributorPermissions: state.config.contributorPermissions,
        countryRules: state.config.countryRules
      },
      integrations: integrationMatrix(state),
      contract: platformContract()
    });
  }

  if (method === "GET" && url.pathname === "/api/v2/config") return json(res, 200, readState().config);
  if (method === "GET" && url.pathname === "/api/v2/integrations") return json(res, 200, integrationMatrix(readState()));

  if (method === "POST" && url.pathname === "/api/v2/admin/login") {
    const body = await readBody(req);
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
    const role = activeRoleForUser(state, user);
    const issued = issueAdminSession(state, user, role);
    audit(state, "admin.v2.login", { id: user.id, role: role?.name || user.adminRole }, user.id);
    writeState(state);
    return json(res, 200, {
      ok: true,
      session: { token: issued.token, expiresAt: issued.expiresAt, type: "admin" },
      user: publicAdminUser(user, role),
      contract: platformContract()
    });
  }

  if (url.pathname.startsWith("/api/v2/admin/")) {
    const state = readState();
    if (!requireAdmin(req, res, state)) return;

    if (method === "GET" && url.pathname === "/api/v2/admin/dashboard") {
      if (!requireAdminPermission(req, res, "overview")) return;
      return json(res, 200, adminDashboardV2(state));
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/access") {
      if (!requireAdminPermission(req, res, "access")) return;
      return json(res, 200, {
        roles: state.access.roles,
        userCategories: state.access.userCategories,
        photoCategories: state.config.photoCategories,
        contributorTypes: state.config.contributorTypes,
        enduserTypes: state.config.userTypes,
        contributorPermissions: state.config.contributorPermissions,
        permissions: permissionList()
      });
    }

    if (method === "PUT" && url.pathname === "/api/v2/admin/access") {
      if (!requireAdminPermission(req, res, "access")) return;
      const body = await readBody(req);
      if (Array.isArray(body.roles)) state.access.roles = body.roles.map(normalizeRole);
      if (Array.isArray(body.userCategories)) state.access.userCategories = body.userCategories.map(normalizeUserCategory);
      if (Array.isArray(body.photoCategories)) state.config.photoCategories = body.photoCategories;
      if (Array.isArray(body.contributorTypes)) state.config.contributorTypes = body.contributorTypes;
      if (Array.isArray(body.enduserTypes)) state.config.userTypes = body.enduserTypes;
      if (body.contributorPermissions && typeof body.contributorPermissions === "object") state.config.contributorPermissions = body.contributorPermissions;
      audit(state, "admin.v2.access.updated", { roles: state.access.roles.length, userCategories: state.access.userCategories.length }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, {
        roles: state.access.roles,
        userCategories: state.access.userCategories,
        photoCategories: state.config.photoCategories,
        contributorTypes: state.config.contributorTypes,
        enduserTypes: state.config.userTypes,
        contributorPermissions: state.config.contributorPermissions,
        permissions: permissionList()
      });
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/config") {
      if (!requireAdminPermission(req, res, "settings")) return;
      return json(res, 200, { config: state.config, contract: platformContract() });
    }

    if (method === "PUT" && url.pathname === "/api/v2/admin/config") {
      if (!requireAdminPermission(req, res, "settings")) return;
      const body = await readBody(req);
      state.config = normalizeConfig({ ...state.config, ...(body.config || body) });
      audit(state, "admin.v2.config.updated", { keys: Object.keys(body.config || body) }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, { config: state.config });
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/users") {
      if (!requireAdminPermission(req, res, "users")) return;
      return json(res, 200, { items: state.users, count: state.users.length });
    }

    if (method === "POST" && url.pathname === "/api/v2/admin/users") {
      if (!requireAdminPermission(req, res, "users")) return;
      const user = normalizeUser(await readBody(req));
      state.users.unshift(user);
      if (user.accountGroup === "Contributor" && !findContributorProfile(state, user.id)) {
        state.contributorProfiles.unshift(normalizeContributorProfile({ userId: user.id, type: user.category, country: user.country }, user));
      }
      audit(state, "admin.v2.user.created", { id: user.id, accountGroup: user.accountGroup, category: user.category }, req.adminSession.sub);
      writeState(state);
      return json(res, 201, { user });
    }

    const v2AdminUserRoute = url.pathname.match(/^\/api\/v2\/admin\/users\/([^/]+)$/);
    if (method === "PATCH" && v2AdminUserRoute) {
      if (!requireAdminPermission(req, res, "users")) return;
      const index = state.users.findIndex((item) => item.id === v2AdminUserRoute[1]);
      if (index < 0) return notFound(res);
      state.users[index] = normalizeUser({ ...state.users[index], ...(await readBody(req)), id: state.users[index].id });
      const profile = findContributorProfile(state, state.users[index].id);
      if (profile) syncUserFromContributor(state, state.users[index], profile);
      audit(state, "admin.v2.user.updated", { id: state.users[index].id, status: state.users[index].status, category: state.users[index].category }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, { user: state.users[index] });
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/contributors") {
      if (!requireAdminPermission(req, res, "users")) return;
      const items = adminContributorRecords(state);
      return json(res, 200, { items, count: items.length, allowedCountries: allowedContributorCountries(state) });
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/assets") {
      if (!requireAdminPermission(req, res, "content")) return;
      return json(res, 200, { items: state.assets, aiJobs: state.aiJobs, faceApprovalCases: state.faceApprovalCases, count: state.assets.length });
    }

    if (method === "POST" && url.pathname === "/api/v2/admin/assets") {
      if (!requireAdminPermission(req, res, "content")) return;
      const asset = normalizeAsset(await readBody(req));
      asset.status = asset.status || uploadStatus(state, asset);
      state.assets.unshift(asset);
      audit(state, "admin.v2.asset.created", { id: asset.id, category: asset.category, status: asset.status }, req.adminSession.sub);
      writeState(state);
      return json(res, 201, { asset });
    }

    const v2AdminAssetRoute = url.pathname.match(/^\/api\/v2\/admin\/assets\/([^/]+)$/);
    if (method === "PATCH" && v2AdminAssetRoute) {
      if (!requireAdminPermission(req, res, "content")) return;
      const index = state.assets.findIndex((item) => item.id === v2AdminAssetRoute[1]);
      if (index < 0) return notFound(res);
      state.assets[index] = normalizeAsset({ ...state.assets[index], ...(await readBody(req)), id: state.assets[index].id });
      state.assets[index].visibility = state.assets[index].status === "Approved" ? "Public" : state.assets[index].visibility;
      state.moderationCases.unshift({ id: uniqueId("moderation"), assetId: state.assets[index].id, status: state.assets[index].status, note: state.assets[index].moderationNote || "", createdAt: new Date().toISOString() });
      audit(state, "admin.v2.asset.updated", { id: state.assets[index].id, status: state.assets[index].status, category: state.assets[index].category }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, { asset: state.assets[index] });
    }

    const v2AdminEnhanceRoute = url.pathname.match(/^\/api\/v2\/admin\/assets\/([^/]+)\/enhance$/);
    if (method === "POST" && v2AdminEnhanceRoute) {
      if (!requireAdminPermission(req, res, "content")) return;
      const asset = state.assets.find((item) => item.id === v2AdminEnhanceRoute[1]);
      if (!asset) return notFound(res);
      const previousQuality = Number(asset.quality || 0);
      asset.quality = Math.min(100, previousQuality + 18);
      asset.status = uploadStatus(state, asset);
      state.aiJobs.unshift({ id: uniqueId("ai-job"), assetId: asset.id, status: "Enhanced", qualityBefore: previousQuality, qualityAfter: asset.quality, createdAt: new Date().toISOString() });
      audit(state, "admin.v2.asset.enhanced", { id: asset.id, quality: asset.quality, status: asset.status }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, { asset });
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/commerce") {
      if (!requireAdminPermission(req, res, "overview")) return;
      return json(res, 200, adminCommerceState(state));
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/integrations") {
      if (!requireAdminPermission(req, res, "settings")) return;
      return json(res, 200, { integrations: integrationMatrix(state), config: state.config });
    }

    if (method === "PUT" && url.pathname === "/api/v2/admin/integrations") {
      if (!requireAdminPermission(req, res, "settings")) return;
      const body = await readBody(req);
      if (Array.isArray(body.paymentProviders)) state.config.paymentProviders = body.paymentProviders;
      if (Array.isArray(body.gateways)) state.config.gateways = body.gateways;
      if (Array.isArray(body.smsProviders)) state.config.smsProviders = body.smsProviders;
      if (body.subscriptionGateway) state.config.subscriptionGateway = body.subscriptionGateway;
      audit(state, "admin.v2.integrations.updated", {
        paymentProviders: state.config.paymentProviders.length,
        countryGateways: state.config.gateways.length,
        smsProviders: state.config.smsProviders.length
      }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, { integrations: integrationMatrix(state), config: state.config });
    }

    if (method === "GET" && url.pathname === "/api/v2/admin/activity") {
      if (!requireAdminPermission(req, res, "activity")) return;
      return json(res, 200, { items: adminActivity(state), auditLog: state.auditLog, platformActivities: state.platformActivities });
    }
  }

  if (method === "POST" && url.pathname === "/api/v2/auth/otp/send") return sendOtpChallenge(req, res, { apiVersion: "v2" });
  if (method === "POST" && url.pathname === "/api/v2/auth/otp/verify") return verifyContributorOtp(req, res, { apiVersion: "v2" });
  if (method === "GET" && url.pathname === "/api/v2/contributors/me") return contributorMe(req, res);
  if ((method === "PUT" || method === "PATCH") && url.pathname === "/api/v2/contributors/me") return updateContributorProfile(req, res);
  if (method === "POST" && url.pathname === "/api/v2/contributors/me/face-match") return runContributorFaceMatch(req, res);
  if (method === "POST" && url.pathname === "/api/v2/contributors/me/access") return activateContributorAccess(req, res);
  if (method === "GET" && url.pathname === "/api/v2/assets") {
    const state = readState();
    return json(res, 200, { items: state.assets, count: state.assets.length });
  }
  if (method === "POST" && url.pathname === "/api/v2/assets") return createContributorAsset(req, res, { apiVersion: "v2" });
  if (method === "GET" && url.pathname === "/api/v2/orders") {
    const state = readState();
    return json(res, 200, { items: state.orders, count: state.orders.length });
  }
  if (method === "POST" && url.pathname === "/api/v2/orders") return createBuyerOrder(req, res, { apiVersion: "v2" });
  const orderPay = url.pathname.match(/^\/api\/v2\/orders\/([^/]+)\/pay$/);
  if (method === "POST" && orderPay) return payBuyerOrder(req, res, orderPay[1], { apiVersion: "v2" });
  if (method === "GET" && url.pathname === "/api/v2/licenses") {
    const state = readState();
    return json(res, 200, { items: state.licenses, count: state.licenses.length });
  }

  return notFound(res);
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";

  if (url.pathname.startsWith("/api/v2/")) {
    return handleV2Api(req, res, url);
  }

  if (method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      service: "vuekumi-backend",
      version: 2,
      backend: "redesigned-domain-api",
      newBackend: "/api/v2",
      legacyAdminBackend: "/api/admin"
    });
  }

  if (method === "GET" && url.pathname === "/api/state") {
    const state = readState();
    return json(res, 200, publicState(state, contributorClaimsFromRequest(req, state)));
  }

  if ((method === "PUT" || method === "POST") && url.pathname === "/api/state") {
    const state = readState();
    if (!requireAdmin(req, res, state) || !requireAdminPermission(req, res, "settings")) return;
    const body = await readBody(req);
    const nextState = readState();
    nextState.config = normalizeConfig(body.config || body);
    audit(nextState, "state.config_saved", { source: "admin-state-sync" }, req.adminSession.sub);
    writeState(nextState);
    return json(res, 200, { ok: true, state: publicState(nextState) });
  }

  if (method === "GET" && url.pathname === "/api/config") {
    return json(res, 200, readState().config);
  }

  if (method === "PUT" && url.pathname === "/api/config") {
    const state = readState();
    if (!requireAdmin(req, res, state) || !requireAdminPermission(req, res, "settings")) return;
    const body = await readBody(req);
    state.config = normalizeConfig({ ...state.config, ...(body.config || body) });
    audit(state, "config.updated", { keys: Object.keys(body.config || body) }, req.adminSession.sub);
    writeState(state);
    return json(res, 200, state.config);
  }

  if (method === "GET" && url.pathname === "/api/integrations") {
    const state = readState();
    return json(res, 200, integrationMatrix(state));
  }

  if (method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);
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

    const role = activeRoleForUser(state, user);
    const issued = issueAdminSession(state, user, role);
    audit(state, "admin.login", { id: user.id, role: role?.name || user.adminRole }, user.id);
    writeState(state);
    return json(res, 200, {
      ok: true,
      token: issued.token,
      expiresAt: issued.expiresAt,
      user: publicAdminUser(user, role)
    });
  }

  if (url.pathname.startsWith("/api/admin/")) {
    const state = readState();
    if (!requireAdmin(req, res, state)) return;

    if (method === "GET" && url.pathname === "/api/admin/overview") {
      if (!requireAdminPermission(req, res, "overview")) return;
      return json(res, 200, adminOverview(state));
    }

    if (method === "GET" && url.pathname === "/api/admin/access") {
      if (!requireAdminPermission(req, res, "access")) return;
      return json(res, 200, {
        adminAccess: state.access.roles,
        userCategories: state.access.userCategories,
        contentCategories: state.config.photoCategories,
        contributorPermissions: state.config.contributorPermissions,
        permissions: permissionList()
      });
    }

    if (method === "PUT" && url.pathname === "/api/admin/access") {
      if (!requireAdminPermission(req, res, "access")) return;
      const body = await readBody(req);
      if (Array.isArray(body.adminAccess)) state.access.roles = body.adminAccess.map(normalizeRole);
      if (Array.isArray(body.userCategories)) state.access.userCategories = body.userCategories.map(normalizeUserCategory);
      if (Array.isArray(body.contentCategories)) state.config.photoCategories = body.contentCategories;
      if (body.contributorPermissions && typeof body.contributorPermissions === "object") {
        state.config.contributorPermissions = body.contributorPermissions;
      }
      audit(state, "admin.access.updated", {
        roles: state.access.roles.length,
        userCategories: state.access.userCategories.length,
        contentCategories: state.config.photoCategories.length
      }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, {
        adminAccess: state.access.roles,
        userCategories: state.access.userCategories,
        contentCategories: state.config.photoCategories,
        contributorPermissions: state.config.contributorPermissions,
        permissions: permissionList()
      });
    }

    if (method === "GET" && url.pathname === "/api/admin/users") {
      if (!requireAdminPermission(req, res, "users")) return;
      return json(res, 200, state.users);
    }

    if (method === "POST" && url.pathname === "/api/admin/users") {
      if (!requireAdminPermission(req, res, "users")) return;
      const user = normalizeUser(await readBody(req));
      state.users.unshift(user);
      if (user.accountGroup === "Contributor" && !findContributorProfile(state, user.id)) {
        state.contributorProfiles.unshift(require("./store").normalizeContributorProfile({ userId: user.id, type: user.category, country: user.country }, user));
      }
      audit(state, "admin.user.created", { id: user.id, accountGroup: user.accountGroup, category: user.category }, req.adminSession.sub);
      writeState(state);
      return json(res, 201, user);
    }

    const adminUserRoute = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (method === "PATCH" && adminUserRoute) {
      if (!requireAdminPermission(req, res, "users")) return;
      const index = state.users.findIndex((item) => item.id === adminUserRoute[1]);
      if (index < 0) return notFound(res);
      state.users[index] = normalizeUser({ ...state.users[index], ...(await readBody(req)), id: state.users[index].id });
      const profile = findContributorProfile(state, state.users[index].id);
      if (profile) syncUserFromContributor(state, state.users[index], profile);
      audit(state, "admin.user.updated", { id: state.users[index].id, status: state.users[index].status, category: state.users[index].category }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, state.users[index]);
    }

    if (method === "GET" && url.pathname === "/api/admin/content") {
      if (!requireAdminPermission(req, res, "content")) return;
      return json(res, 200, state.assets);
    }

    if (method === "POST" && url.pathname === "/api/admin/content") {
      if (!requireAdminPermission(req, res, "content")) return;
      const asset = normalizeAsset(await readBody(req));
      asset.status = asset.status || uploadStatus(state, asset);
      state.assets.unshift(asset);
      audit(state, "admin.content.created", { id: asset.id, category: asset.category, status: asset.status }, req.adminSession.sub);
      writeState(state);
      return json(res, 201, asset);
    }

    const adminContentRoute = url.pathname.match(/^\/api\/admin\/content\/([^/]+)$/);
    if (method === "PATCH" && adminContentRoute) {
      if (!requireAdminPermission(req, res, "content")) return;
      const index = state.assets.findIndex((item) => item.id === adminContentRoute[1]);
      if (index < 0) return notFound(res);
      state.assets[index] = normalizeAsset({ ...state.assets[index], ...(await readBody(req)), id: state.assets[index].id });
      audit(state, "admin.content.updated", { id: state.assets[index].id, status: state.assets[index].status, category: state.assets[index].category }, req.adminSession.sub);
      writeState(state);
      return json(res, 200, state.assets[index]);
    }

    if (method === "GET" && url.pathname === "/api/admin/activity") {
      if (!requireAdminPermission(req, res, "activity")) return;
      return json(res, 200, adminActivity(state));
    }
  }

  if (method === "POST" && url.pathname === "/api/auth/send-otp") {
    return sendOtpChallenge(req, res);
  }

  if (method === "POST" && url.pathname === "/api/auth/verify-otp") {
    return verifyContributorOtp(req, res);
  }

  if (method === "PUT" && url.pathname === "/api/contributor") {
    return updateContributorProfile(req, res);
  }

  if (method === "POST" && url.pathname === "/api/contributor/face-match") {
    return runContributorFaceMatch(req, res);
  }

  if (method === "POST" && url.pathname === "/api/subscriptions/contributor") {
    return activateContributorAccess(req, res);
  }

  if (method === "GET" && url.pathname === "/api/uploads") {
    return json(res, 200, readState().assets);
  }

  if (method === "POST" && url.pathname === "/api/uploads") {
    return createContributorAsset(req, res);
  }

  const uploadModeration = url.pathname.match(/^\/api\/uploads\/([^/]+)\/moderate$/);
  if (method === "PATCH" && uploadModeration) {
    const state = readState();
    if (!requireAdmin(req, res, state) || !requireAdminPermission(req, res, "content")) return;
    const body = await readBody(req);
    const asset = state.assets.find((item) => item.id === uploadModeration[1]);
    if (!asset) return notFound(res);
    asset.status = body.status || asset.status;
    asset.visibility = asset.status === "Approved" ? "Public" : "Internal Review";
    asset.moderationNote = body.note || asset.moderationNote || "";
    state.moderationCases.unshift({ id: uniqueId("moderation"), assetId: asset.id, status: asset.status, note: asset.moderationNote, createdAt: new Date().toISOString() });
    audit(state, "upload.moderated", { id: asset.id, status: asset.status }, req.adminSession.sub);
    writeState(state);
    return json(res, 200, asset);
  }

  const uploadEnhance = url.pathname.match(/^\/api\/uploads\/([^/]+)\/enhance$/);
  if (method === "POST" && uploadEnhance) {
    const state = readState();
    if (!requireAdmin(req, res, state) || !requireAdminPermission(req, res, "content")) return;
    const asset = state.assets.find((item) => item.id === uploadEnhance[1]);
    if (!asset) return notFound(res);
    const previousQuality = Number(asset.quality || 0);
    asset.quality = Math.min(100, previousQuality + 18);
    asset.status = uploadStatus(state, asset);
    state.aiJobs.unshift({ id: uniqueId("ai-job"), assetId: asset.id, status: "Enhanced", qualityBefore: previousQuality, qualityAfter: asset.quality, createdAt: new Date().toISOString() });
    audit(state, "upload.ai_enhanced", { id: asset.id, quality: asset.quality, status: asset.status }, req.adminSession.sub);
    writeState(state);
    return json(res, 200, asset);
  }

  if (method === "POST" && url.pathname === "/api/checkout") {
    return createBuyerOrder(req, res);
  }

  if (method === "GET" && url.pathname === "/api/checkout") {
    return json(res, 200, readState().orders);
  }

  const checkoutPay = url.pathname.match(/^\/api\/checkout\/([^/]+)\/pay$/);
  if (method === "POST" && checkoutPay) {
    return payBuyerOrder(req, res, checkoutPay[1]);
  }

  if (method === "POST" && url.pathname === "/api/dev/reset") {
    const state = readState();
    if (process.env.NODE_ENV === "production") return notFound(res);
    if (!requireAdmin(req, res, state) || !requireAdminPermission(req, res, "settings")) return;
    const fresh = require("./store").initialState();
    audit(fresh, "dev.reset", {}, req.adminSession.sub);
    writeState(fresh);
    return json(res, 200, { ok: true, state: publicState(fresh) });
  }

  return notFound(res);
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(rootDir, pathname));
  if (!filePath.startsWith(rootDir)) return notFound(res);
  fs.readFile(filePath, (error, content) => {
    if (error) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".webp": "image/webp"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error) => {
      json(res, 500, { error: error.message || "Internal server error" });
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(port, () => {
  console.log(`VUEKUMI backend running at http://localhost:${port}`);
});
