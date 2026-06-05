const http = require("http");
const fs = require("fs");
const path = require("path");
const { rootDir, readState, writeState, audit, normalizeConfig, normalizeRole, normalizeUserCategory, normalizeUser, normalizeAsset, uniqueId } = require("./store");
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

async function handleApi(req, res, url) {
  const method = req.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      service: "vuekumi-backend",
      version: 2,
      backend: "redesigned-domain-api"
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
    const body = await readBody(req);
    if (!body.phone) return json(res, 400, { error: "phone is required" });
    const state = readState();
    const code = randomOtp();
    state.otpChallenges[String(body.phone).trim()] = {
      code,
      purpose: body.purpose || "contributor-login",
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + otpTtlMs
    };
    audit(state, "otp.sent", { phone: body.phone, provider: "country-sms-provider" });
    writeState(state);
    const payload = { ok: true, phone: body.phone };
    if (process.env.NODE_ENV !== "production") payload.otpPreview = code;
    return json(res, 200, payload);
  }

  if (method === "POST" && url.pathname === "/api/auth/verify-otp") {
    const body = await readBody(req);
    const phone = String(body.phone || "").trim();
    const state = readState();
    const challenge = state.otpChallenges[phone];
    const verified = Boolean(challenge && Date.now() <= Number(challenge.expiresAt) && body.otp === challenge.code);
    if (!verified) {
      audit(state, "otp.failed", { phone });
      writeState(state);
      return json(res, 401, { ok: false, verified: false });
    }

    const { user, profile } = findOrCreateContributorByPhone(state, phone);
    user.verificationStatus = "OTP Verified";
    user.lastActivity = "Phone OTP verified";
    const issued = issueContributorSession(state, user, profile);
    delete state.otpChallenges[phone];
    audit(state, "otp.verified", { phone, userId: user.id }, user.id);
    writeState(state);
    return json(res, 200, {
      ok: true,
      verified: true,
      token: issued.token,
      expiresAt: issued.expiresAt,
      user,
      contributor: profile
    });
  }

  if (method === "PUT" && url.pathname === "/api/contributor") {
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
    state.contributorProfiles[index] = require("./store").normalizeContributorProfile(nextProfile, auth.user);
    syncUserFromContributor(state, auth.user, state.contributorProfiles[index]);
    audit(state, "contributor.updated", { userId: auth.user.id, country: nextProfile.country, type: nextProfile.type }, auth.user.id);
    writeState(state);
    return json(res, 200, { contributor: state.contributorProfiles[index], profileComplete: profileComplete(state, state.contributorProfiles[index]) });
  }

  if (method === "POST" && url.pathname === "/api/contributor/face-match") {
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

  if (method === "POST" && url.pathname === "/api/subscriptions/contributor") {
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

  if (method === "GET" && url.pathname === "/api/uploads") {
    return json(res, 200, readState().assets);
  }

  if (method === "POST" && url.pathname === "/api/uploads") {
    const state = readState();
    const auth = requireContributor(req, res, state);
    if (!auth) return;
    const result = createAssetForContributor(state, auth.user, auth.profile, await readBody(req));
    if (result.error) return json(res, result.errorStatus || 400, { error: result.error, uploadAccess: result.uploadAccess });
    syncUserFromContributor(state, auth.user, auth.profile);
    audit(state, "upload.created", { id: result.asset.id, userId: auth.user.id, status: result.asset.status }, auth.user.id);
    writeState(state);
    return json(res, 201, { ...result.asset, uploadAccess: result.uploadAccess });
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
    const state = readState();
    const order = createOrder(state, await readBody(req));
    state.orders.push(order);
    audit(state, "checkout.created", { id: order.id, orderNumber: order.orderNumber, plan: order.plan, gateway: order.gateway, provider: order.provider });
    writeState(state);
    return json(res, 201, order);
  }

  if (method === "GET" && url.pathname === "/api/checkout") {
    return json(res, 200, readState().orders);
  }

  const checkoutPay = url.pathname.match(/^\/api\/checkout\/([^/]+)\/pay$/);
  if (method === "POST" && checkoutPay) {
    const state = readState();
    const order = state.orders.find((item) => item.id === checkoutPay[1]);
    if (!order) return notFound(res);
    const result = authorizeOrder(state, order);
    if (result.order.paymentStatus === "Authorized") createLicenseFromOrder(state, result.order);
    audit(state, result.order.paymentStatus === "Authorized" ? "checkout.payment_authorized" : "checkout.provider_pending", {
      id: order.id,
      orderNumber: order.orderNumber,
      provider: order.provider,
      apiKeyRef: order.apiKeyRef
    });
    writeState(state);
    if (result.error) return json(res, result.statusCode, { error: result.error, checkout: result.order });
    return json(res, result.statusCode, result.order);
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
