const fs = require("fs");
const path = require("path");
const {
  defaultConfig,
  defaultRoles,
  defaultUserCategories,
  defaultUsers,
  defaultContributorProfiles,
  defaultAssets,
  defaultActivities
} = require("./defaults");

const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, ".data");
const stateFile = process.env.STATE_FILE ? path.resolve(process.env.STATE_FILE) : path.join(dataDir, "vuekumi-state.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeConfig(config = {}) {
  return {
    ...clone(defaultConfig),
    ...config,
    agreements: { ...clone(defaultConfig.agreements), ...(config.agreements || {}) },
    contributorPermissions: { ...clone(defaultConfig.contributorPermissions), ...(config.contributorPermissions || {}) },
    photoCategories: normalizeList(config.photoCategories || defaultConfig.photoCategories),
    contributorTypes: normalizeList(config.contributorTypes || defaultConfig.contributorTypes),
    userTypes: normalizeList(config.userTypes || defaultConfig.userTypes),
    countryRules: Array.isArray(config.countryRules) ? config.countryRules : clone(defaultConfig.countryRules),
    gateways: Array.isArray(config.gateways) ? config.gateways : clone(defaultConfig.gateways),
    paymentProviders: Array.isArray(config.paymentProviders) ? config.paymentProviders : clone(defaultConfig.paymentProviders),
    smsProviders: Array.isArray(config.smsProviders) ? config.smsProviders : clone(defaultConfig.smsProviders),
    plans: Array.isArray(config.plans) ? config.plans : clone(defaultConfig.plans),
    contributorAccessLevels: Array.isArray(config.contributorAccessLevels)
      ? config.contributorAccessLevels
      : clone(defaultConfig.contributorAccessLevels)
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function initialState() {
  return {
    schemaVersion: 2,
    platform: {
      name: "VUEKUMI",
      publicTemplate: "supplied-kimi-stock-photo-layout",
      market: "African stock photo marketplace"
    },
    config: clone(defaultConfig),
    access: {
      roles: clone(defaultRoles),
      userCategories: clone(defaultUserCategories)
    },
    users: clone(defaultUsers),
    contributorProfiles: clone(defaultContributorProfiles),
    assets: clone(defaultAssets),
    moderationCases: [],
    aiJobs: [],
    faceApprovalCases: [],
    orders: [],
    licenses: [],
    payouts: [],
    sessions: {
      admins: {},
      contributors: {},
      buyers: {}
    },
    otpChallenges: {},
    auditLog: [],
    platformActivities: clone(defaultActivities),
    marketplace: {
      selectedImage: null,
      search: ""
    }
  };
}

function normalizeRole(input = {}) {
  return {
    id: input.id || uniqueId("role"),
    name: input.name || "New Admin Role",
    description: input.description || "",
    permissions: normalizeList(input.permissions),
    enabled: input.enabled !== false
  };
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

function normalizeUser(input = {}) {
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

function normalizeContributorProfile(input = {}, user = {}) {
  return {
    id: input.id || uniqueId("profile"),
    userId: input.userId || user.id || "",
    type: input.type || user.category || "Photographers",
    country: input.country || user.country || "Nigeria",
    accessLevel: input.accessLevel || "Starter",
    idType: input.idType || "International Passport",
    idReference: input.idReference || "",
    email: input.email || user.email || "",
    address: input.address || "",
    profilePhoto: Boolean(input.profilePhoto),
    governmentId: Boolean(input.governmentId),
    faceScan: Boolean(input.faceScan),
    faceScanScore: Number(input.faceScanScore || 0),
    agreementsSigned: Boolean(input.agreementsSigned),
    contentAgreementSigned: Boolean(input.contentAgreementSigned),
    copyrightAgreementSigned: Boolean(input.copyrightAgreementSigned),
    subscriptionActive: Boolean(input.subscriptionActive),
    verificationStatus: input.verificationStatus || user.verificationStatus || "Not Started",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString()
  };
}

function normalizeAsset(input = {}) {
  return {
    id: input.id || uniqueId("asset"),
    owner: input.owner || "unknown",
    title: input.title || "Untitled VUEKUMI Upload",
    category: input.category || "Photo Content",
    contributorType: input.contributorType || "Photo Content",
    country: input.country || "Nigeria",
    quality: Number(input.quality || 70),
    faces: Boolean(input.faces),
    release: Boolean(input.release),
    copyrightApproval: Boolean(input.copyrightApproval),
    status: input.status || "Admin Review",
    visibility: input.visibility || (input.status === "Approved" ? "Public" : "Internal Review"),
    moderationNote: input.moderationNote || "",
    src: input.src || "images/africa-content-2.jpg",
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function normalizeOrder(input = {}) {
  return {
    id: input.id || uniqueId("order"),
    orderNumber: input.orderNumber || orderNumber(),
    buyerUserId: input.buyerUserId || "",
    buyerType: input.buyerType || input.plan || "Regular Individual",
    buyerCountry: input.buyerCountry || "Global",
    plan: input.plan || input.buyerType || "Regular Individual",
    gateway: input.gateway || "",
    provider: input.provider || "",
    apiKeyRef: input.apiKeyRef || "",
    gatewayConfigured: Boolean(input.gatewayConfigured),
    providerCredentialsLoaded: Boolean(input.providerCredentialsLoaded),
    amount: Number(input.amount || 0),
    currency: input.currency || "USD",
    paymentStatus: input.paymentStatus || "Pending",
    status: input.status || "Payment Pending",
    authorizationRef: input.authorizationRef || "",
    authorizedAt: input.authorizedAt || "",
    created: input.created || new Date().toLocaleString(),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function normalizeState(input = {}) {
  const base = initialState();
  const state = {
    ...base,
    ...input,
    schemaVersion: 2,
    platform: { ...base.platform, ...(input.platform || {}) },
    config: normalizeConfig(input.config || {}),
    access: {
      roles: (input.access?.roles || input.adminAccess || base.access.roles).map(normalizeRole),
      userCategories: (input.access?.userCategories || input.userCategories || base.access.userCategories).map(normalizeUserCategory)
    },
    users: (input.users?.length ? input.users : base.users).map(normalizeUser),
    contributorProfiles: (input.contributorProfiles || []).map((profile) => normalizeContributorProfile(profile)),
    assets: (input.assets || input.uploads || base.assets).map(normalizeAsset),
    moderationCases: Array.isArray(input.moderationCases) ? input.moderationCases : [],
    aiJobs: Array.isArray(input.aiJobs) ? input.aiJobs : [],
    faceApprovalCases: Array.isArray(input.faceApprovalCases) ? input.faceApprovalCases : [],
    orders: (input.orders || input.cart || []).map(normalizeOrder),
    licenses: Array.isArray(input.licenses) ? input.licenses : [],
    payouts: Array.isArray(input.payouts) ? input.payouts : [],
    sessions: {
      admins: input.sessions?.admins || {},
      contributors: input.sessions?.contributors || input.contributorSessions || {},
      buyers: input.sessions?.buyers || {}
    },
    otpChallenges: input.otpChallenges || input.otpCodes || {},
    auditLog: Array.isArray(input.auditLog) ? input.auditLog : [],
    platformActivities: Array.isArray(input.platformActivities) ? input.platformActivities : base.platformActivities,
    marketplace: {
      selectedImage: input.marketplace?.selectedImage || input.selectedImage || null,
      search: input.marketplace?.search || input.marketplaceSearch || ""
    }
  };

  if (!state.contributorProfiles.length) {
    state.contributorProfiles = state.users
      .filter((user) => user.accountGroup === "Contributor")
      .map((user) => normalizeContributorProfile(input.contributor || {}, user));
  }

  return state;
}

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(stateFile)) writeState(initialState());
}

function readState() {
  ensureDataStore();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(stateFile, "utf8")));
  } catch {
    return normalizeState(initialState());
  }
}

function writeState(state) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(normalizeState(state), null, 2));
}

function audit(state, action, details = {}, actor = "system") {
  state.auditLog = state.auditLog || [];
  state.auditLog.unshift({
    id: uniqueId("audit"),
    action,
    actor,
    details,
    createdAt: new Date().toISOString()
  });
  state.auditLog = state.auditLog.slice(0, 500);
}

function uniqueId(prefix) {
  return `${prefix}-${cryptoRandomId()}`;
}

function orderNumber() {
  return `VK-${Date.now().toString(36).toUpperCase()}-${cryptoRandomId().slice(0, 4).toUpperCase()}`;
}

function cryptoRandomId() {
  return require("crypto").randomUUID();
}

module.exports = {
  rootDir,
  stateFile,
  clone,
  normalizeList,
  normalizeConfig,
  normalizeRole,
  normalizeUserCategory,
  normalizeUser,
  normalizeContributorProfile,
  normalizeAsset,
  normalizeOrder,
  initialState,
  readState,
  writeState,
  audit,
  uniqueId,
  orderNumber
};
