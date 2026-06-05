const {
  clone,
  normalizeList,
  normalizeUser,
  normalizeContributorProfile,
  normalizeAsset,
  normalizeOrder,
  uniqueId,
  orderNumber
} = require("./store");
const { ADMIN_PERMISSIONS } = require("./defaults");

function allowedContributorCountries(state) {
  const countries = (state.config.countryRules || [])
    .filter((rule) => rule.contributorsAllowed)
    .map((rule) => rule.country);
  return countries.length ? countries : ["Nigeria", "Ghana", "Kenya", "South Africa", "Rwanda"];
}

function userCategory(state, group, name) {
  return state.access.userCategories.find((category) =>
    category.enabled &&
    category.group === group &&
    category.name === name
  );
}

function allowedCategoriesForContributor(state, contributorType) {
  const category = userCategory(state, "Contributor", contributorType);
  const configured = category?.allowedContentCategories?.length
    ? category.allowedContentCategories
    : state.config.contributorPermissions?.[contributorType];
  return normalizeList(configured);
}

function starterUploadLimit(state) {
  const min = Number(state.config.freeUploadMin || 3);
  const max = Number(state.config.freeUploadMax || 5);
  const active = Number(state.config.activeFreeLimit || min);
  return Math.max(min, Math.min(max, active));
}

function accessLevel(state, profile) {
  return (state.config.contributorAccessLevels || []).find((item) => item.name === profile.accessLevel) ||
    state.config.contributorAccessLevels?.[0] ||
    { name: "Starter", uploads: starterUploadLimit(state), requiresVerification: false };
}

function profileComplete(state, profile) {
  return Boolean(
    profile &&
      allowedContributorCountries(state).includes(profile.country) &&
      profile.email &&
      profile.address &&
      profile.profilePhoto &&
      profile.governmentId &&
      profile.faceScan &&
      Number(profile.faceScanScore || 0) >= Number(state.config.faceConfidence || 88) &&
      profile.agreementsSigned &&
      profile.contentAgreementSigned &&
      profile.copyrightAgreementSigned
  );
}

function syncUserFromContributor(state, user, profile) {
  user.category = profile.type;
  user.country = profile.country;
  user.email = profile.email || user.email;
  user.allowedContentCategories = allowedCategoriesForContributor(state, profile.type);
  user.verificationStatus = profileComplete(state, profile) ? "Verified" : "OTP Verified";
  user.status = allowedContributorCountries(state).includes(profile.country)
    ? (profileComplete(state, profile) ? "Active" : "Pending")
    : "Blocked";
  user.lastActivity = profileComplete(state, profile) ? "Contributor profile verified" : "Contributor profile in progress";
  profile.verificationStatus = user.verificationStatus;
  profile.updatedAt = new Date().toISOString();
  return user;
}

function findContributorProfile(state, userId) {
  return state.contributorProfiles.find((profile) => profile.userId === userId);
}

function findOrCreateContributorByPhone(state, phone) {
  const cleanPhone = String(phone || "").trim();
  let user = state.users.find((item) => item.accountGroup === "Contributor" && item.phone === cleanPhone);
  if (!user) {
    user = normalizeUser({
      name: `Contributor ${cleanPhone}`,
      phone: cleanPhone,
      accountGroup: "Contributor",
      category: "Photographers",
      country: allowedContributorCountries(state)[0] || "Nigeria",
      status: "Pending",
      verificationStatus: "OTP Verified",
      allowedContentCategories: allowedCategoriesForContributor(state, "Photographers"),
      lastActivity: "Phone OTP verified"
    });
    state.users.unshift(user);
  }

  let profile = findContributorProfile(state, user.id);
  if (!profile) {
    profile = normalizeContributorProfile({
      userId: user.id,
      type: user.category,
      country: user.country,
      email: user.email,
      verificationStatus: user.verificationStatus
    }, user);
    state.contributorProfiles.unshift(profile);
  }

  syncUserFromContributor(state, user, profile);
  return { user, profile };
}

function contributorUploadCount(state, userId) {
  return state.assets.filter((asset) => asset.owner === userId).length;
}

function contributorUploadAccess(state, user, profile) {
  const used = contributorUploadCount(state, user.id);
  const starterLimit = starterUploadLimit(state);
  if (used < starterLimit) return { ok: true, used, limit: starterLimit, mode: "starter" };

  const level = accessLevel(state, profile);
  const paidLimit = Number(level.uploads || starterLimit);
  if (profile.subscriptionActive && profileComplete(state, profile) && used < paidLimit) {
    return { ok: true, used, limit: paidLimit, mode: "paid" };
  }

  return {
    ok: false,
    used,
    limit: profile.subscriptionActive ? paidLimit : starterLimit,
    mode: profile.subscriptionActive ? "verification-required" : "subscription-required",
    error: `Starter upload limit reached. Complete deeper verification and activate paid access to upload more than ${starterLimit} images.`
  };
}

function uploadStatus(state, asset) {
  if (!allowedContributorCountries(state).includes(asset.country)) return "Country Review";
  if (Number(asset.quality) < Number(state.config.aiQualityThreshold || 72)) return "AI Enhancement";
  if (asset.faces && (!asset.release || !asset.copyrightApproval)) return "Face/Copyright Verification";
  return "Admin Review";
}

function createAssetForContributor(state, user, profile, input = {}) {
  const contributorType = input.contributorType || profile.type;
  const category = input.category || "Photo Content";
  const country = input.country || profile.country;
  const allowedCategories = allowedCategoriesForContributor(state, contributorType);

  if (!allowedContributorCountries(state).includes(country)) {
    return { errorStatus: 403, error: "Contributors must be from an admin-approved African country." };
  }

  if (!allowedCategories.includes(category)) {
    return { errorStatus: 403, error: `${contributorType} contributors cannot post ${category}. Admin can update this access matrix.` };
  }

  const uploadAccess = contributorUploadAccess(state, user, profile);
  if (!uploadAccess.ok) return { errorStatus: 402, error: uploadAccess.error, uploadAccess };

  const asset = normalizeAsset({
    ...input,
    owner: user.id,
    category,
    contributorType,
    country,
    status: ""
  });
  asset.status = uploadStatus(state, asset);
  asset.visibility = asset.status === "Approved" ? "Public" : "Internal Review";
  state.assets.unshift(asset);

  if (asset.faces) {
    state.faceApprovalCases.unshift({
      id: uniqueId("face-case"),
      assetId: asset.id,
      owner: user.id,
      status: asset.release && asset.copyrightApproval ? "Release On File" : "Needs Release/Copyright Approval",
      createdAt: new Date().toISOString()
    });
  }

  if (asset.status === "AI Enhancement") {
    state.aiJobs.unshift({
      id: uniqueId("ai-job"),
      assetId: asset.id,
      status: "Queued",
      qualityBefore: asset.quality,
      createdAt: new Date().toISOString()
    });
  }

  return { asset, uploadAccess: contributorUploadAccess(state, user, profile) };
}

function paymentProviderFor(state, gatewayName) {
  const gateway = String(gatewayName || "").toLowerCase();
  return (state.config.paymentProviders || []).find((provider) => gateway.includes(String(provider.name || "").toLowerCase())) ||
    (state.config.paymentProviders || []).find((provider) => provider.enabled);
}

function planAmount(state, planName) {
  const plan = (state.config.plans || []).find((item) => item.type === planName);
  const numeric = String(plan?.price || "").replace(/[^0-9.]/g, "");
  return numeric ? Number(numeric) : 0;
}

function createOrder(state, input = {}) {
  const plan = input.plan || input.buyerType || "Regular Individual";
  const gateway = input.gateway || state.config.subscriptionGateway;
  const provider = paymentProviderFor(state, gateway);
  return normalizeOrder({
    id: uniqueId("order"),
    orderNumber: orderNumber(),
    buyerUserId: input.buyerUserId || "",
    buyerType: input.buyerType || plan,
    buyerCountry: input.buyerCountry || "Global",
    plan,
    gateway,
    provider: provider?.name || gateway,
    apiKeyRef: provider?.apiKeyRef || "",
    gatewayConfigured: Boolean(provider?.enabled && provider?.apiKeyRef),
    providerCredentialsLoaded: Boolean(provider?.apiKeyRef && process.env[provider.apiKeyRef]),
    amount: input.amount ?? planAmount(state, plan),
    currency: input.currency || "USD",
    paymentStatus: "Pending",
    status: "Payment Pending"
  });
}

function authorizeOrder(state, order) {
  const provider = paymentProviderFor(state, order.gateway);
  if (!provider?.enabled || !provider.apiKeyRef) {
    order.paymentStatus = "Gateway Required";
    order.status = "Payment Needs Gateway";
    order.gatewayConfigured = false;
    return { statusCode: 409, order, error: "Payment gateway provider must be enabled with an API key reference." };
  }

  order.provider = provider.name;
  order.apiKeyRef = provider.apiKeyRef;
  order.gatewayConfigured = true;
  order.providerCredentialsLoaded = Boolean(process.env[provider.apiKeyRef]);

  if (!order.providerCredentialsLoaded) {
    order.paymentStatus = "Pending Provider Credentials";
    order.status = "Provider Credentials Required";
    return { statusCode: 202, order };
  }

  order.paymentStatus = "Authorized";
  order.status = "Payment Authorized";
  order.authorizationRef = `AUTH-${require("crypto").randomBytes(4).toString("hex").toUpperCase()}`;
  order.authorizedAt = new Date().toISOString();
  return { statusCode: 200, order };
}

function createLicenseFromOrder(state, order, assetId = "") {
  const license = {
    id: uniqueId("license"),
    orderId: order.id,
    assetId,
    buyerUserId: order.buyerUserId || "",
    plan: order.plan,
    licenseMode: state.config.licenseMode,
    downloadsRemaining: (state.config.plans || []).find((plan) => plan.type === order.plan)?.downloads || 0,
    status: order.paymentStatus === "Authorized" ? "Active" : "Pending Payment",
    createdAt: new Date().toISOString()
  };
  state.licenses.unshift(license);
  return license;
}

function integrationMatrix(state) {
  return {
    paymentProviders: (state.config.paymentProviders || []).map((provider) => ({
      ...provider,
      credentialsLoaded: Boolean(provider.apiKeyRef && process.env[provider.apiKeyRef])
    })),
    countryGateways: (state.config.gateways || []).map((gateway) => ({
      ...gateway,
      credentialsLoaded: Boolean(gateway.keyRef && process.env[gateway.keyRef])
    })),
    smsProviders: (state.config.smsProviders || []).map((provider) => ({
      ...provider,
      credentialsLoaded: Boolean(provider.apiKeyRef && process.env[provider.apiKeyRef])
    }))
  };
}

function publicContributorState(state, userId = "") {
  const profile = userId ? findContributorProfile(state, userId) : state.contributorProfiles[0];
  return profile || normalizeContributorProfile();
}

function publicState(state, contributorClaims = null) {
  const contributor = publicContributorState(state, contributorClaims?.sub);
  return {
    config: clone(state.config),
    session: { role: "guest", userType: "", phone: "", otpSent: false, otpVerified: false },
    contributor,
    uploads: state.assets.map((asset) => clone(asset)),
    cart: state.orders.map((order) => clone(order)),
    moderationNotes: state.moderationCases.map((item) => clone(item)),
    selectedImage: state.marketplace.selectedImage,
    marketplaceSearch: state.marketplace.search,
    integrations: integrationMatrix(state)
  };
}

function adminOverview(state) {
  const pendingContent = state.assets.filter((asset) => !["Approved", "Rejected"].includes(asset.status)).length;
  const pendingUsers = state.users.filter((user) => user.status !== "Active").length;
  return {
    metrics: {
      users: state.users.length,
      pendingUsers,
      contributors: state.users.filter((user) => user.accountGroup === "Contributor").length,
      endusers: state.users.filter((user) => user.accountGroup === "Enduser").length,
      content: state.assets.length,
      pendingContent,
      userCategories: state.access.userCategories.length,
      adminRoles: state.access.roles.length,
      licenses: state.licenses.length,
      orders: state.orders.length
    },
    recentUsers: state.users.slice(0, 6),
    recentContent: state.assets.slice(0, 6),
    recentActivity: adminActivity(state).slice(0, 10),
    integrations: integrationMatrix(state)
  };
}

function adminActivity(state) {
  return [...state.auditLog, ...state.platformActivities].map((item) => ({
    ...item,
    action: item.action || item.title || item.type || "activity",
    title: item.title || item.action || item.type || "Activity"
  }));
}

function permissionList() {
  return ADMIN_PERMISSIONS;
}

module.exports = {
  allowedContributorCountries,
  allowedCategoriesForContributor,
  starterUploadLimit,
  accessLevel,
  profileComplete,
  syncUserFromContributor,
  findContributorProfile,
  findOrCreateContributorByPhone,
  contributorUploadAccess,
  uploadStatus,
  createAssetForContributor,
  paymentProviderFor,
  createOrder,
  authorizeOrder,
  createLicenseFromOrder,
  integrationMatrix,
  publicState,
  adminOverview,
  adminActivity,
  permissionList
};
