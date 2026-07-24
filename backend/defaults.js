const ADMIN_PERMISSIONS = ["overview", "access", "users", "content", "activity", "settings"];

const defaultConfig = {
  platformName: "VUEKUMI",
  contributorEligibility: "Africa only",
  freeUploadMin: 3,
  freeUploadMax: 5,
  activeFreeLimit: 3,
  photoCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"],
  contributorTypes: ["Photo Content", "Models", "Photographers"],
  userTypes: ["Regular Individual", "Agency", "Corporate"],
  contributorPermissions: {
    "Photo Content": ["Photo Content", "Street", "Culture"],
    Models: ["Models", "Photography"],
    Photographers: ["Photo Content", "Models", "Photography", "Street", "Culture"]
  },
  aiQualityThreshold: 72,
  faceConfidence: 88,
  idTypes: "DL, International Passport, High-rated Government ID",
  acceptedIdentityDocuments: ["DL", "International Passport", "High-rated Government ID"],
  agreementVersion: "VUEKUMI Contributor Agreement v1.0",
  licenseMode: "Rights managed and royalty free",
  payoutCadence: "Monthly",
  subscriptionGateway: "Stripe global",
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
  gateways: [
    { country: "Nigeria", subscription: "Stripe global", payout: "Paystack Transfer", sms: "Termii", keyRef: "NG_PAYSTACK_SECRET", enabled: true },
    { country: "Ghana", subscription: "Stripe global", payout: "Flutterwave Ghana", sms: "Hubtel", keyRef: "GH_FLW_SECRET", enabled: true },
    { country: "Kenya", subscription: "Stripe global", payout: "M-Pesa Daraja", sms: "Africa's Talking", keyRef: "KE_MPESA_SECRET", enabled: true },
    { country: "South Africa", subscription: "Stripe global", payout: "Ozow", sms: "Clickatell", keyRef: "ZA_OZOW_SECRET", enabled: true },
    { country: "Rwanda", subscription: "Stripe global", payout: "Flutterwave Rwanda", sms: "Africa's Talking", keyRef: "RW_FLW_SECRET", enabled: true }
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
  ],
  plans: [
    { type: "Regular Individual", price: "$19", seats: 1, downloads: 25, license: "Standard royalty free" },
    { type: "Agency", price: "$149", seats: 8, downloads: 300, license: "Extended campaign use" },
    { type: "Corporate", price: "Custom", seats: 50, downloads: 1500, license: "Rights managed procurement" }
  ]
};

const defaultRoles = [
  { id: "role-super-admin", name: "Super Admin", description: "Full platform control.", permissions: ADMIN_PERMISSIONS, enabled: true },
  { id: "role-user-manager", name: "User Manager", description: "Manage user accounts, user categories, and account status.", permissions: ["overview", "access", "users", "activity"], enabled: true },
  { id: "role-content-manager", name: "Content Manager", description: "Manage content, categories, approval status, and moderation notes.", permissions: ["overview", "content", "activity"], enabled: true },
  { id: "role-verification-manager", name: "Verification Manager", description: "Manage contributor verification, identity review, and copyright approval queues.", permissions: ["overview", "users", "content", "activity"], enabled: true }
];

const defaultUserCategories = [
  { id: "category-admin", group: "Admin", name: "Admin", description: "Administrative users for platform operations.", enabled: true, requiresVerification: true, allowedContentCategories: [] },
  { id: "category-photo-content", group: "Contributor", name: "Photo Content", description: "African contributors submitting lifestyle, editorial, street, and culture content.", enabled: true, requiresVerification: true, allowedContentCategories: ["Photo Content", "Street", "Culture"] },
  { id: "category-models", group: "Contributor", name: "Models", description: "African model contributors with image, likeness, and release verification.", enabled: true, requiresVerification: true, allowedContentCategories: ["Models", "Photography"] },
  { id: "category-photographers", group: "Contributor", name: "Photographers", description: "African photographers allowed to submit across configured photo categories.", enabled: true, requiresVerification: true, allowedContentCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"] },
  { id: "category-regular-individual", group: "Enduser", name: "Regular Individual", description: "Individual buyers licensing images for personal or creator use.", enabled: true, requiresVerification: false, allowedContentCategories: [] },
  { id: "category-agency", group: "Enduser", name: "Agency", description: "Agency buyers with team and client licensing needs.", enabled: true, requiresVerification: false, allowedContentCategories: [] },
  { id: "category-corporate", group: "Enduser", name: "Corporate", description: "Corporate buyers with procurement, rights management, and invoice workflows.", enabled: true, requiresVerification: false, allowedContentCategories: [] }
];

const defaultUsers = [
  { id: "user-admin-1", name: "VUEKUMI Admin", phone: "+10000000001", email: "admin@vuekumi.local", accountGroup: "Admin", category: "Admin", country: "Global", status: "Active", verificationStatus: "Verified", adminRole: "Super Admin", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Admin portal ready" },
  { id: "user-photo-content-1", name: "Photo Content Contributor", phone: "+2348000000101", email: "photo.content@vuekumi.local", accountGroup: "Contributor", category: "Photo Content", country: "Nigeria", status: "Pending", verificationStatus: "OTP Verified", adminRole: "", allowedContentCategories: ["Photo Content", "Street", "Culture"], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Starter upload access" },
  { id: "user-models-1", name: "Model Contributor", phone: "+2348000000102", email: "model@vuekumi.local", accountGroup: "Contributor", category: "Models", country: "Nigeria", status: "Pending", verificationStatus: "Needs ID Review", adminRole: "", allowedContentCategories: ["Models", "Photography"], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Awaiting face and ID review" },
  { id: "user-photographers-1", name: "Photographer Contributor", phone: "+254700000103", email: "photographer@vuekumi.local", accountGroup: "Contributor", category: "Photographers", country: "Kenya", status: "Active", verificationStatus: "Verified", adminRole: "", allowedContentCategories: ["Photo Content", "Models", "Photography", "Street", "Culture"], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Content submitted" },
  { id: "user-regular-1", name: "Regular Buyer", phone: "+12025550101", email: "regular@buyer.local", accountGroup: "Enduser", category: "Regular Individual", country: "United States", status: "Active", verificationStatus: "Email Pending", adminRole: "", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Buyer account created" },
  { id: "user-agency-1", name: "Agency Buyer", phone: "+12025550102", email: "agency@buyer.local", accountGroup: "Enduser", category: "Agency", country: "United Kingdom", status: "Active", verificationStatus: "Verified", adminRole: "", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Agency profile created" },
  { id: "user-corporate-1", name: "Corporate Buyer", phone: "+12025550103", email: "corporate@buyer.local", accountGroup: "Enduser", category: "Corporate", country: "South Africa", status: "Pending", verificationStatus: "Procurement Review", adminRole: "", allowedContentCategories: [], createdAt: "2026-05-28T00:00:00.000Z", lastActivity: "Corporate account awaiting review" }
];

const defaultContributorProfiles = [
  {
    id: "profile-photographers-1",
    userId: "user-photographers-1",
    type: "Photographers",
    country: "Kenya",
    accessLevel: "Professional",
    idType: "International Passport",
    idReference: "KE-PASSPORT-DEMO",
    email: "photographer@vuekumi.local",
    address: "Nairobi, Kenya",
    profilePhoto: true,
    governmentId: true,
    faceScan: true,
    faceScanScore: 92,
    agreementsSigned: true,
    contentAgreementSigned: true,
    copyrightAgreementSigned: true,
    subscriptionActive: true,
    verificationStatus: "Verified",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z"
  }
];

const defaultAssets = [
  { id: "seed-1", owner: "user-models-1", title: "Braided Beauty", category: "Models", contributorType: "Models", country: "Nigeria", quality: 86, faces: true, release: true, copyrightApproval: true, status: "Approved", visibility: "Public", src: "images/africa-model-3.jpg", createdAt: "2026-05-28T00:00:00.000Z" },
  { id: "seed-2", owner: "user-photographers-1", title: "Falls Sunset", category: "Photography", contributorType: "Photographers", country: "Zambia", quality: 92, faces: false, release: false, copyrightApproval: true, status: "Approved", visibility: "Public", src: "images/africa-landscape-1.jpg", createdAt: "2026-05-28T00:00:00.000Z" },
  { id: "seed-3", owner: "user-photo-content-1", title: "Nairobi Workspace", category: "Photo Content", contributorType: "Photo Content", country: "Kenya", quality: 61, faces: true, release: false, copyrightApproval: false, status: "Release Review", visibility: "Internal Review", src: "images/africa-content-1.jpg", createdAt: "2026-05-28T00:00:00.000Z" }
];

const defaultActivities = [
  { id: "activity-admin-ready", type: "Admin", title: "Admin backend initialized", details: "Access, users, content, and activity management are available.", createdAt: "2026-05-28T00:00:00.000Z" },
  { id: "activity-content-queue", type: "Content", title: "Content queue seeded", details: "Initial VUEKUMI content items are ready for admin moderation.", createdAt: "2026-05-28T00:00:00.000Z" },
  { id: "activity-access-rules", type: "Access", title: "User category rules seeded", details: "Admin, contributor, and enduser categories are configurable from admin.", createdAt: "2026-05-28T00:00:00.000Z" }
];

module.exports = {
  ADMIN_PERMISSIONS,
  defaultConfig,
  defaultRoles,
  defaultUserCategories,
  defaultUsers,
  defaultContributorProfiles,
  defaultAssets,
  defaultActivities
};
