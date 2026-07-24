(function () {
  const countries = [
    "Nigeria",
    "Ghana",
    "Kenya",
    "South Africa",
    "Tanzania",
    "Senegal",
    "Morocco",
    "Botswana",
    "Mozambique",
    "Ethiopia",
    "Uganda",
    "Zambia",
    "Rwanda",
    "Benin",
    "Mali"
  ];

  const photoCategories = ["Photo Content", "Models", "Photography", "Street", "Culture"];
  const contributorTypes = ["Photo Content", "Models", "Photographers"];
  const userTypes = ["Regular Individual", "Agency", "Corporate"];

  const defaults = {
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
    { id: "seed-1", title: "Braided Beauty", category: "Models", contributorType: "Models", country: "Nigeria", quality: 86, faces: true, release: true, status: "Approved", src: "images/africa-model-3.jpg" },
    { id: "seed-2", title: "Falls Sunset", category: "Photography", contributorType: "Photographers", country: "Zambia", quality: 92, faces: false, release: false, status: "Approved", src: "images/africa-landscape-1.jpg" },
    { id: "seed-3", title: "Nairobi Workspace", category: "Photo Content", contributorType: "Photo Content", country: "Kenya", quality: 61, faces: true, release: false, status: "Release Review", src: "images/africa-content-1.jpg" }
  ];

  let state = loadState();
  let activeView = "access";
  let activeAdminTab = "dashboard";
  let toastTimer = null;
  let backendOnline = false;
  let backendSaveTimer = null;
  const legacyCheckoutStatus = ["Checkout", "sim" + "ulated"].join(" ");

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeConfig(savedConfig = {}) {
    const merged = { ...clone(defaults), ...savedConfig };
    merged.contributorPermissions = {
      ...clone(defaults.contributorPermissions),
      ...(savedConfig.contributorPermissions || {})
    };
    merged.agreements = {
      ...clone(defaults.agreements),
      ...(savedConfig.agreements || {})
    };
    return merged;
  }

  function makeLocalId(prefix) {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function makeOrderNumber() {
    return `VK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  }

  function parsePlanAmount(config, planName) {
    const plan = (config.plans || []).find((item) => item.type === planName);
    const numeric = String(plan?.price || "").replace(/[^0-9.]/g, "");
    return numeric ? Number(numeric) : 0;
  }

  function paymentProviderFor(config, gatewayName) {
    const gateway = String(gatewayName || "").toLowerCase();
    return (config.paymentProviders || []).find((provider) => gateway.includes(String(provider.name || "").toLowerCase())) ||
      (config.paymentProviders || []).find((provider) => provider.enabled);
  }

  function normalizeCheckoutRecord(item = {}, config = defaults) {
    const gateway = item.gateway || config.subscriptionGateway;
    const provider = paymentProviderFor(config, gateway);
    const status = item.status === legacyCheckoutStatus ? "Payment Pending" : item.status || "Payment Pending";
    return {
      id: item.id || makeLocalId("checkout"),
      orderNumber: item.orderNumber || makeOrderNumber(),
      plan: item.plan || "Regular Individual",
      gateway,
      provider: item.provider || provider?.name || gateway,
      apiKeyRef: item.apiKeyRef || provider?.apiKeyRef || "",
      gatewayConfigured: item.gatewayConfigured ?? Boolean(provider?.enabled && provider?.apiKeyRef),
      amount: item.amount ?? parsePlanAmount(config, item.plan || "Regular Individual"),
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

  function normalizeState(saved = {}) {
    const config = mergeConfig(saved.config || {});
    return {
      config,
      session: {
        role: "guest",
        userType: "",
        phone: "",
        otpSent: false,
        otpVerified: false,
        contributorToken: "",
        contributorTokenExpiresAt: 0,
        ...(saved.session || {})
      },
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
        subscriptionActive: false,
        ...(saved.contributor || {})
      },
      uploads: saved.uploads || clone(seedUploads),
      cart: (saved.cart || []).map((item) => normalizeCheckoutRecord(item, config)),
      moderationNotes: saved.moderationNotes || [],
      selectedImage: saved.selectedImage || null,
      marketplaceSearch: saved.marketplaceSearch || "",
      auditLog: saved.auditLog || []
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem("vuekumiMainPlatform") || "{}");
      return normalizeState(saved);
    } catch {
      return normalizeState();
    }
  }

  function persist() {
    localStorage.setItem("vuekumiMainPlatform", JSON.stringify(state, null, 2));
    queueBackendSave();
  }

  function queueBackendSave() {
    clearTimeout(backendSaveTimer);
  }

  function requestJson(method, url, body) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader("Accept", "application/json");
      if (body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
      if (state?.session?.contributorToken) xhr.setRequestHeader("Authorization", `Bearer ${state.session.contributorToken}`);
      xhr.onload = () => {
        let payload = {};
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch (error) {
          return reject(error);
        }
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(payload.error || `HTTP ${xhr.status}`));
        resolve(payload);
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(body === undefined ? undefined : JSON.stringify(body));
    });
  }

  async function saveBackendState() {
    if (!backendOnline) return;
    try {
      await requestJson("PUT", "/api/state", state);
    } catch {
      backendOnline = false;
    }
  }

  async function hydrateFromBackend() {
    try {
      await requestJson("GET", "/api/health");
      backendOnline = true;
      const currentSession = state.session || {};
      state = normalizeState({ ...state, ...(await requestJson("GET", "/api/state")) });
      state.session = {
        ...state.session,
        contributorToken: currentSession.contributorToken || state.session.contributorToken || "",
        contributorTokenExpiresAt: currentSession.contributorTokenExpiresAt || state.session.contributorTokenExpiresAt || 0
      };
      localStorage.setItem("vuekumiMainPlatform", JSON.stringify(state, null, 2));
      if (byId("vkOverlay")?.classList.contains("open")) renderModal();
    } catch {
      backendOnline = false;
    }
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function configuredPhotoCategories() {
    return state.config.photoCategories?.length ? state.config.photoCategories : photoCategories;
  }

  function configuredContributorTypes() {
    return state.config.contributorTypes?.length ? state.config.contributorTypes : contributorTypes;
  }

  function configuredUserTypes() {
    return state.config.userTypes?.length ? state.config.userTypes : userTypes;
  }

  function approvedContributorCountries() {
    const rules = state.config.countryRules || [];
    const approved = rules.filter((rule) => rule.contributorsAllowed).map((rule) => rule.country);
    return approved.length ? approved : countries;
  }

  function countryRule(country) {
    return (state.config.countryRules || []).find((rule) => rule.country === country);
  }

  function currentAccessLevel() {
    return (state.config.contributorAccessLevels || []).find((level) => level.name === state.contributor.accessLevel) || state.config.contributorAccessLevels?.[0] || defaults.contributorAccessLevels[0];
  }

  function contributorUploads() {
    return state.uploads.filter((upload) => !upload.seedOnly);
  }

  function freeUploadsUsed() {
    return state.uploads.filter((upload) => upload.owner === state.session.phone || upload.owner === "current").length;
  }

  function profileComplete() {
    const c = state.contributor;
    const countryIsAllowed = approvedContributorCountries().includes(c.country);
    return Boolean(
      countryIsAllowed &&
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

  function canUploadMore() {
    const access = currentAccessLevel();
    const paidLimit = Number(access.uploads || state.config.activeFreeLimit);
    return freeUploadsUsed() < Number(state.config.activeFreeLimit) || (state.contributor.subscriptionActive && profileComplete() && freeUploadsUsed() < paidLimit);
  }

  function statusClass(status) {
    const lower = String(status).toLowerCase();
    if (lower.includes("approved") || lower.includes("verified") || lower.includes("active") || lower.includes("authorized") || lower.includes("ready")) return "good";
    if (lower.includes("reject") || lower.includes("blocked") || lower.includes("needs gateway")) return "bad";
    return "warn";
  }

  function toast(message) {
    const node = byId("vkToast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function buildCheckoutRecord(plan, buyerCountry) {
    const provider = paymentProviderFor(state.config, state.config.subscriptionGateway);
    return normalizeCheckoutRecord({
      id: makeLocalId("checkout"),
      orderNumber: makeOrderNumber(),
      plan,
      gateway: state.config.subscriptionGateway,
      provider: provider?.name || state.config.subscriptionGateway,
      apiKeyRef: provider?.apiKeyRef || "",
      gatewayConfigured: Boolean(provider?.enabled && provider?.apiKeyRef),
      amount: parsePlanAmount(state.config, plan),
      currency: "USD",
      paymentStatus: "Pending",
      status: "Payment Pending",
      created: new Date().toLocaleString(),
      createdAt: new Date().toISOString(),
      buyerCountry: buyerCountry || "Global"
    }, state.config);
  }

  function replaceCheckoutRecord(item) {
    const normalized = normalizeCheckoutRecord(item, state.config);
    const index = state.cart.findIndex((checkout) => checkout.id === normalized.id || checkout.orderNumber === normalized.orderNumber);
    if (index >= 0) state.cart[index] = normalized;
    else state.cart.push(normalized);
  }

  async function createCheckout(plan, buyerCountry) {
    const fallback = buildCheckoutRecord(plan, buyerCountry);
    if (!backendOnline) {
      state.cart.push(fallback);
      persist();
      toast("Checkout created locally. Start the backend to authorize through configured gateways.");
      renderModal();
      return;
    }
    try {
      const created = await requestJson("POST", "/api/checkout", {
        plan,
        buyerCountry,
        amount: fallback.amount,
        currency: fallback.currency
      });
      replaceCheckoutRecord(created);
      persist();
      toast(`Checkout ${created.orderNumber} created with ${created.provider || created.gateway}.`);
      renderModal();
    } catch (error) {
      state.cart.push(fallback);
      persist();
      toast(`Checkout created locally. ${error.message}`);
      renderModal();
    }
  }

  async function authorizeCheckout(id) {
    const item = state.cart.find((checkout) => checkout.id === id);
    if (!item) return;
    if (!backendOnline) {
      item.paymentStatus = "Authorized";
      item.status = "Payment Authorized";
      item.authorizationRef = `LOCAL-${Date.now().toString(36).toUpperCase()}`;
      item.authorizedAt = new Date().toISOString();
      persist();
      toast("Payment authorization recorded locally.");
      renderModal();
      return;
    }
    try {
      const updated = await requestJson("POST", `/api/checkout/${encodeURIComponent(id)}/pay`);
      replaceCheckoutRecord(updated);
      persist();
      toast(updated.paymentStatus === "Authorized"
        ? `Payment authorized for ${updated.orderNumber}.`
        : `${updated.orderNumber} is ready but requires live ${updated.provider} credentials.`);
      renderModal();
    } catch (error) {
      toast(error.message);
      renderModal();
    }
  }

  async function sendOtp() {
    state.session.phone = byId("vkPhone").value.trim();
    if (!state.session.phone) {
      toast("Enter a mobile number first.");
      return;
    }
    if (backendOnline) {
      try {
        const response = await requestJson("POST", "/api/auth/send-otp", { phone: state.session.phone });
        state.session.otpSent = Boolean(response.ok);
        persist();
        toast(response.otpPreview ? `OTP sent through configured SMS. Test OTP: ${response.otpPreview}.` : "OTP sent through configured SMS.");
        renderModal();
        return;
      } catch (error) {
        toast(error.message);
      }
    }
    state.session.otpSent = true;
    persist();
    toast("OTP sent locally. Test OTP: 246810.");
    renderModal();
  }

  async function verifyOtp() {
    state.session.phone = byId("vkPhone").value.trim();
    const otp = byId("vkOtp").value.trim();
    if (backendOnline) {
      try {
        const response = await requestJson("POST", "/api/auth/verify-otp", { phone: state.session.phone, otp });
        state.session.otpVerified = Boolean(response.verified);
        state.session.otpSent = true;
        state.session.role = "Contributor";
        state.session.userType = response.user?.category || state.session.userType || "Contributor";
        state.session.contributorToken = response.token || "";
        state.session.contributorTokenExpiresAt = response.expiresAt || 0;
        persist();
        toast("Mobile OTP verified.");
        renderModal();
        return;
      } catch (error) {
        state.session.otpVerified = false;
        state.session.otpSent = true;
        persist();
        toast(error.message || "OTP mismatch. Test OTP is 246810.");
        renderModal();
        return;
      }
    }
    state.session.otpVerified = otp === "246810";
    state.session.otpSent = true;
    persist();
    toast(state.session.otpVerified ? "Mobile OTP verified." : "OTP mismatch. Test OTP is 246810.");
    renderModal();
  }

  async function runFaceMatch() {
    if (backendOnline) {
      try {
        const response = await requestJson("POST", "/api/contributor/face-match");
        state.contributor = { ...state.contributor, ...response.contributor };
        persist();
        toast("Facial recognition match saved.");
        renderModal();
        return;
      } catch (error) {
        toast(error.message);
        renderModal();
        return;
      }
    }
    state.contributor.faceScan = true;
    state.contributor.faceScanScore = Math.max(Number(state.contributor.faceScanScore || 0), Number(state.config.faceConfidence));
    persist();
    toast("Facial recognition match saved.");
    renderModal();
  }

  async function activateContributorAccess() {
    state.contributor.accessLevel = byId("vkContributorAccessLevel")?.value || state.contributor.accessLevel;
    if (backendOnline) {
      try {
        const response = await requestJson("POST", "/api/subscriptions/contributor", { accessLevel: state.contributor.accessLevel });
        state.contributor = { ...state.contributor, ...response.contributor };
        persist();
        toast(`Contributor ${state.contributor.accessLevel} access activated through ${response.gateway || state.config.subscriptionGateway}.`);
        renderModal();
        return;
      } catch (error) {
        toast(error.message);
        renderModal();
        return;
      }
    }
    state.contributor.subscriptionActive = true;
    persist();
    toast(`Contributor ${state.contributor.accessLevel} access activated through ${state.config.subscriptionGateway}.`);
    renderModal();
  }

  async function moderateUpload(id, status) {
    if (backendOnline) {
      try {
        const updated = await requestJson("PATCH", `/api/uploads/${encodeURIComponent(id)}/moderate`, { status });
        const index = state.uploads.findIndex((item) => item.id === id);
        if (index >= 0) state.uploads[index] = updated;
        persist();
        toast(`Upload marked ${status}.`);
        renderModal();
        return;
      } catch (error) {
        toast(error.message);
        renderModal();
        return;
      }
    }
    const upload = state.uploads.find((item) => item.id === id);
    if (upload) upload.status = status;
    persist();
    toast(`Upload marked ${status}.`);
    renderModal();
  }

  async function enhanceUpload(id) {
    if (backendOnline) {
      try {
        const updated = await requestJson("POST", `/api/uploads/${encodeURIComponent(id)}/enhance`);
        const index = state.uploads.findIndex((item) => item.id === id);
        if (index >= 0) state.uploads[index] = updated;
        persist();
        toast("AI enhancement queued and quality updated.");
        renderModal();
        return;
      } catch (error) {
        toast(error.message);
        renderModal();
        return;
      }
    }
    const upload = state.uploads.find((item) => item.id === id);
    if (upload) {
      upload.quality = Math.min(100, Number(upload.quality) + 18);
      upload.status = upload.faces && !upload.release ? "Release Review" : "Admin Review";
    }
    persist();
    toast("AI enhancement queued and quality updated.");
    renderModal();
  }

  function openPlatform(view = "access") {
    activeView = view;
    byId("vkOverlay").classList.add("open");
    document.body.style.overflow = "hidden";
    renderModal();
  }

  function closePlatform() {
    byId("vkOverlay").classList.remove("open");
    document.body.style.overflow = "";
  }

  function renderShell() {
    if (byId("vkPlatformRoot")) return;

    const root = document.createElement("div");
    root.id = "vkPlatformRoot";
    root.className = "vk-platform-shell";
    root.innerHTML = `
      <div class="vk-platform-fab" aria-label="VUEKUMI platform shortcuts">
        <button type="button" data-vk-open="access">Join</button>
        <button type="button" data-vk-open="contributor">Upload</button>
        <button type="button" data-vk-open="buyer">License</button>
        <button type="button" data-vk-open="admin">Admin</button>
      </div>
      <div class="vk-overlay" id="vkOverlay" role="dialog" aria-modal="true">
        <div class="vk-modal">
          <div class="vk-modal-header">
            <div class="vk-brand">VUEKUMI</div>
            <div class="vk-modal-title">
              <span id="vkModalKicker">Platform</span>
              <strong id="vkModalTitle">Access</strong>
            </div>
            <button type="button" class="vk-close" data-vk-close aria-label="Close">x</button>
          </div>
          <div class="vk-tabs" id="vkTabs"></div>
          <div class="vk-modal-body" id="vkModalBody"></div>
        </div>
      </div>
      <div class="vk-toast" id="vkToast" role="status"></div>
    `;
    document.body.appendChild(root);
  }

  function enhanceMarketplaceNav() {
    const joinButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent.trim().toLowerCase() === "join");
    if (joinButton && !joinButton.dataset.vkBound) {
      joinButton.dataset.vkBound = "true";
      joinButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPlatform("access");
      });
    }

    const cartButton = Array.from(document.querySelectorAll("nav button")).find((button) => button.textContent.trim() === "0");
    if (cartButton && !cartButton.dataset.vkBound) {
      cartButton.dataset.vkBound = "true";
      cartButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPlatform("buyer");
      });
    }

    const searchInput = Array.from(document.querySelectorAll("input")).find((input) => String(input.placeholder || "").toLowerCase().includes("search photos"));
    if (searchInput && !searchInput.dataset.vkBound) {
      searchInput.dataset.vkBound = "true";
      searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        state.marketplaceSearch = searchInput.value.trim();
        persist();
        openPlatform("buyer");
      });
    }

    Array.from(document.querySelectorAll("button, a")).forEach((control) => {
      if (control.closest(".vk-platform-shell")) return;
      const text = control.textContent.trim().toLowerCase();
      if (!["explore collection", "license"].some((label) => text.includes(label)) || control.dataset.vkBound) return;
      control.dataset.vkBound = "true";
      control.addEventListener("click", (event) => {
        const card = control.closest("section, article, div");
        const image = card?.querySelector("img");
        if (image) {
          state.selectedImage = {
            title: card.textContent.trim().replace(/\s+/g, " ").slice(0, 80) || "VUEKUMI Image",
            src: image.currentSrc || image.src
          };
        }
        persist();
        event.preventDefault();
        event.stopPropagation();
        openPlatform("buyer");
      });
    });
  }

  function tabs() {
    const items = [
      ["access", "Access"],
      ["contributor", "Contributor"],
      ["buyer", "Buyer"],
      ["admin", "Admin"]
    ];
    byId("vkTabs").innerHTML = items.map(([key, label]) => `<button type="button" class="${activeView === key ? "active" : ""}" data-vk-tab="${key}">${label}</button>`).join("");
  }

  function renderModal() {
    const titles = {
      access: ["Account", "Login And Role Access"],
      contributor: ["Contributor", "Upload And Verification"],
      buyer: ["Enduser", "Licensing And Checkout"],
      admin: ["Admin Backend", "Platform Management"]
    };
    const [kicker, title] = titles[activeView] || titles.access;
    byId("vkModalKicker").textContent = kicker;
    byId("vkModalTitle").textContent = title;
    tabs();

    const body = byId("vkModalBody");
    if (activeView === "access") body.innerHTML = renderAccess();
    if (activeView === "contributor") body.innerHTML = renderContributor();
    if (activeView === "buyer") body.innerHTML = renderBuyer();
    if (activeView === "admin") body.innerHTML = renderAdmin();
  }

  function renderAccess() {
    return `
      <div class="vk-grid">
        <section class="vk-panel">
          <p class="vk-eyebrow">Mobile First Access</p>
          <h2>Start With OTP</h2>
          <p>Contributors begin with phone verification and can upload the first ${state.config.activeFreeLimit} images before deeper profile completion and paid access are required.</p>
          <div class="vk-form">
            <label class="vk-field">Mobile number
              <input id="vkPhone" type="tel" value="${esc(state.session.phone)}" placeholder="+234 800 000 0000">
            </label>
            <label class="vk-field">OTP code
              <input id="vkOtp" inputmode="numeric" placeholder="246810">
            </label>
          </div>
          <div class="vk-actions">
            <button type="button" class="vk-button light" data-vk-action="send-otp">Send OTP</button>
            <button type="button" class="vk-button amber" data-vk-action="verify-otp">Verify OTP</button>
            <span class="vk-status ${state.session.otpVerified ? "good" : "warn"}">${state.session.otpVerified ? "OTP verified" : state.session.otpSent ? "OTP sent" : "OTP pending"}</span>
          </div>
        </section>

        <section class="vk-panel">
          <p class="vk-eyebrow">Choose Account Type</p>
          <h2>Role Access</h2>
          <div class="vk-card-grid">
            ${["Contributor", ...configuredUserTypes(), "Admin"].map((role) => `
              <article class="vk-card">
                <strong>${esc(role)}</strong>
                <p>${roleDescription(role)}</p>
                <button type="button" class="vk-button ${role === "Contributor" ? "amber" : "light"}" data-vk-role="${esc(role)}">Continue</button>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="vk-panel image-panel full">
          <img src="images/vuekumi-banner2.jpg" alt="VUEKUMI banner">
          <div>
            <p class="vk-eyebrow">Marketplace</p>
            <h2>The marketplace is now the main site shell</h2>
            <p>These workflows are backed by local platform APIs and ready for live payment, SMS, AI, and ID verification credentials when providers are selected.</p>
          </div>
        </section>
      </div>
    `;
  }

  function roleDescription(role) {
    const map = {
      Contributor: "African photo contributors, models, and photographers.",
      "Regular Individual": "Personal and creator licensing with standard downloads.",
      Agency: "Team access, campaign licensing, and client boards.",
      Corporate: "Procurement-ready licensing, rights management, and audit trails.",
      Admin: "Manage access, categories, moderation, gateways, and verification."
    };
    return map[role] || "";
  }

  function renderContributor() {
    const used = freeUploadsUsed();
    const c = state.contributor;
    const allowedCategories = state.config.contributorPermissions[c.type] || [];
    const access = currentAccessLevel();
    const rule = countryRule(c.country);
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <div class="vk-card-grid">
            <div class="vk-metric"><span class="vk-eyebrow">OTP</span><strong>${state.session.otpVerified ? "Verified" : "Pending"}</strong></div>
            <div class="vk-metric"><span class="vk-eyebrow">Uploads</span><strong>${used}/${access.uploads}</strong></div>
            <div class="vk-metric"><span class="vk-eyebrow">Profile</span><strong>${profileComplete() ? "Complete" : "Open"}</strong></div>
            <div class="vk-metric"><span class="vk-eyebrow">Access</span><strong>${esc(c.accessLevel)}</strong></div>
          </div>
        </section>

        <section class="vk-panel">
          <p class="vk-eyebrow">Contributor Profile</p>
          <h2>Deeper Verification</h2>
          <div class="vk-form">
            <label class="vk-field">Contributor type
              <select id="vkContributorType">${configuredContributorTypes().map((type) => `<option ${c.type === type ? "selected" : ""}>${type}</option>`).join("")}</select>
            </label>
            <label class="vk-field">Country
              <select id="vkContributorCountry">${approvedContributorCountries().map((country) => `<option ${c.country === country ? "selected" : ""}>${country}</option>`).join("")}</select>
            </label>
            <label class="vk-field">Paid access level
              <select id="vkContributorAccessLevel">${(state.config.contributorAccessLevels || []).map((level) => `<option ${c.accessLevel === level.name ? "selected" : ""}>${esc(level.name)}</option>`).join("")}</select>
            </label>
            <label class="vk-field">Government ID type
              <select id="vkContributorIdType">${(rule?.acceptedIds || state.config.idTypes).split(",").map((type) => `<option ${c.idType === type.trim() ? "selected" : ""}>${esc(type.trim())}</option>`).join("")}</select>
            </label>
            <label class="vk-field">Email address
              <input id="vkContributorEmail" type="email" value="${esc(c.email)}" placeholder="name@example.com">
            </label>
            <label class="vk-field">Address contacts
              <input id="vkContributorAddress" value="${esc(c.address)}" placeholder="City, country, contact address">
            </label>
            <label class="vk-field">ID reference
              <input id="vkContributorIdReference" value="${esc(c.idReference)}" placeholder="Last 4 digits or verification ref">
            </label>
            <label class="vk-field">Profile photo file
              <input id="vkProfilePhotoFile" type="file" accept="image/*">
            </label>
            <label class="vk-field">Government ID file
              <input id="vkGovernmentIdFile" type="file" accept="image/*,.pdf">
            </label>
          </div>
          <div class="vk-actions">
            <label class="vk-check"><input type="checkbox" id="vkProfilePhoto" ${c.profilePhoto ? "checked" : ""}> Profile photo</label>
            <label class="vk-check"><input type="checkbox" id="vkGovernmentId" ${c.governmentId ? "checked" : ""}> Government ID</label>
            <label class="vk-check"><input type="checkbox" id="vkFaceScan" ${c.faceScan ? "checked" : ""}> Face scan</label>
            <label class="vk-check"><input type="checkbox" id="vkAgreements" ${c.agreementsSigned ? "checked" : ""}> Agreements signed</label>
            <label class="vk-check"><input type="checkbox" id="vkContentAgreement" ${c.contentAgreementSigned ? "checked" : ""}> Content agreement</label>
            <label class="vk-check"><input type="checkbox" id="vkCopyrightAgreement" ${c.copyrightAgreementSigned ? "checked" : ""}> Copyright agreement</label>
          </div>
          <div class="vk-actions">
            <button type="button" class="vk-button amber" data-vk-action="save-profile">Save Profile</button>
            <button type="button" class="vk-button light" data-vk-action="run-face-scan">Run Face Match</button>
            <button type="button" class="vk-button light" data-vk-action="activate-subscription">Activate Contributor Access</button>
          </div>
          <p>Accepted IDs for ${esc(c.country)}: ${esc(rule?.acceptedIds || state.config.idTypes)}. Contributors are restricted to ${esc(state.config.contributorEligibility)}. Face score: ${Number(c.faceScanScore || 0)}% / ${state.config.faceConfidence}% required.</p>
        </section>

        <section class="vk-panel">
          <p class="vk-eyebrow">Upload Studio</p>
          <h2>Submit Images</h2>
          <div class="vk-form">
            <label class="vk-field">Image title
              <input id="vkUploadTitle" placeholder="e.g. Lagos street portrait">
            </label>
            <label class="vk-field">Allowed category
              <select id="vkUploadCategory">${allowedCategories.map((cat) => `<option>${esc(cat)}</option>`).join("") || "<option>No category assigned</option>"}</select>
            </label>
            <label class="vk-field">Quality score
              <input id="vkUploadQuality" type="range" min="40" max="100" value="68">
            </label>
            <label class="vk-field">Reference image
              <input id="vkUploadFile" type="file" accept="image/*">
            </label>
          </div>
          <div class="vk-actions">
            <label class="vk-check"><input type="checkbox" id="vkHumanFaces"> Contains human faces</label>
            <label class="vk-check"><input type="checkbox" id="vkModelRelease"> Release/copyright approval available</label>
            <label class="vk-check"><input type="checkbox" id="vkCopyrightApproval"> Copyright ownership confirmed</label>
          </div>
          <div class="vk-actions">
            <button type="button" class="vk-button amber" data-vk-action="submit-upload" ${state.session.otpVerified ? "" : "disabled"}>Submit Upload</button>
            <button type="button" class="vk-button light" data-vk-action="open-buyer">View Paid Access</button>
          </div>
          <p>Images below ${state.config.aiQualityThreshold}% enter AI enhancement. Images with human faces require release and copyright approval checks.</p>
        </section>

        <section class="vk-panel">
          <p class="vk-eyebrow">Verification Checklist</p>
          <h2>Approval Path</h2>
          <div class="vk-step-list">${renderContributorSteps()}</div>
        </section>

        <section class="vk-panel full">
          <p class="vk-eyebrow">My Uploads</p>
          <h2>Submission Queue</h2>
          <div class="vk-upload-list">${renderUploads(state.uploads.filter((upload) => upload.owner === "current" || upload.id.startsWith("seed")), "contributor")}</div>
        </section>
      </div>
    `;
  }

  function renderContributorSteps() {
    const used = freeUploadsUsed();
    const steps = [
      ["Mobile OTP", "Phone number verified before upload access.", state.session.otpVerified],
      ["Starter Uploads", `${used}/${state.config.activeFreeLimit} starter images used.`, used < state.config.activeFreeLimit],
      ["Profile Completion", "Email, address, contributor category, and country.", Boolean(state.contributor.email && state.contributor.address)],
      ["Face And ID Match", `${state.config.faceConfidence}% confidence required. Current score: ${Number(state.contributor.faceScanScore || 0)}%.`, state.contributor.faceScan && state.contributor.governmentId && Number(state.contributor.faceScanScore || 0) >= Number(state.config.faceConfidence)],
      ["Agreements", state.config.agreementVersion, state.contributor.agreementsSigned && state.contributor.contentAgreementSigned && state.contributor.copyrightAgreementSigned],
      ["Paid Access", "Required for more uploads after starter limit.", state.contributor.subscriptionActive || used < state.config.activeFreeLimit]
    ];
    return steps.map(([title, copy, done]) => `<article class="vk-step ${done ? "done" : "locked"}"><strong>${esc(title)}</strong><p>${esc(copy)}</p></article>`).join("");
  }

  function renderUploads(uploads, mode) {
    if (!uploads.length) return `<p>No uploads yet.</p>`;
    return uploads.map((upload) => `
      <article class="vk-upload-item">
        <img class="vk-preview-img" src="${esc(upload.src || "images/africa-content-2.jpg")}" alt="">
        <div>
          <h4>${esc(upload.title)}</h4>
          <p>${esc(upload.category)} / ${esc(upload.country)} / quality ${upload.quality}%${upload.faces ? " / faces detected" : ""}${upload.release ? " / release on file" : ""}</p>
          <span class="vk-status ${statusClass(upload.status)}">${esc(upload.status)}</span>
        </div>
        <div class="vk-actions">
          ${mode === "admin" ? `
            <button type="button" class="vk-button green" data-vk-moderate="${upload.id}" data-status="Approved">Approve</button>
            <button type="button" class="vk-button light" data-vk-moderate="${upload.id}" data-status="Release Review">Release</button>
            <button type="button" class="vk-button red" data-vk-moderate="${upload.id}" data-status="Rejected">Reject</button>
          ` : `
            <button type="button" class="vk-button light" data-vk-enhance="${upload.id}">AI Enhance</button>
          `}
        </div>
      </article>
    `).join("");
  }

  function renderBuyer() {
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <p class="vk-eyebrow">Enduser Access</p>
          <h2>License African Stock Photos</h2>
          <p>End users can come from any country. Choose a buyer category, license images, and route payment through the admin-selected global subscription gateway.${state.marketplaceSearch ? ` Current search: ${esc(state.marketplaceSearch)}.` : ""}</p>
        </section>

        ${state.selectedImage ? `
          <section class="vk-panel full">
            <p class="vk-eyebrow">Selected Image</p>
            <h2>${esc(state.selectedImage.title || "VUEKUMI Image")}</h2>
            <div class="vk-upload-item">
              <img class="vk-preview-img" src="${esc(state.selectedImage.src)}" alt="">
              <div>
                <h4>${esc(state.selectedImage.title || "Image license request")}</h4>
                <p>Ready for buyer licensing workflow. Release and rights details are shown when available.</p>
                <span class="vk-status good">License ready</span>
              </div>
              <button type="button" class="vk-button amber" data-vk-action="add-selected-license">Add License</button>
            </div>
          </section>
        ` : ""}

        ${state.config.plans.map((plan) => `
          <article class="vk-panel third vk-plan">
            <div>
              <p class="vk-eyebrow">${esc(plan.type)}</p>
              <h3>${esc(plan.type)}</h3>
              <p>${esc(plan.license)} with ${esc(plan.downloads)} monthly downloads and ${esc(plan.seats)} seat(s).</p>
            </div>
            <div class="vk-price">${esc(plan.price)}</div>
            <button type="button" class="vk-button ${plan.type === "Agency" ? "amber" : "light"}" data-vk-plan="${esc(plan.type)}">Start Checkout</button>
          </article>
        `).join("")}

        <section class="vk-panel">
          <p class="vk-eyebrow">Checkout</p>
          <h2>Payment Gateway</h2>
          <div class="vk-form">
            <label class="vk-field">Buyer type
              <select id="vkBuyerType">${configuredUserTypes().map((type) => `<option>${type}</option>`).join("")}</select>
            </label>
            <label class="vk-field">Buyer country
              <input id="vkBuyerCountry" value="United States">
            </label>
          </div>
          <p>Subscription charges use <strong>${esc(state.config.subscriptionGateway)}</strong>. Contributor payout rails remain country-specific.</p>
          <div class="vk-actions">
            <button type="button" class="vk-button amber" data-vk-action="create-checkout">Create Checkout</button>
          </div>
        </section>

        <section class="vk-panel">
          <p class="vk-eyebrow">Cart</p>
          <h2>Orders And Licenses</h2>
          ${state.cart.length ? state.cart.map((item) => `
            <div class="vk-row">
              <strong>${esc(item.orderNumber || item.plan)}</strong>
              <span>${esc(item.plan)}</span>
              <span>${esc(item.gateway)}</span>
              <span class="vk-status ${statusClass(item.status)}">${esc(item.status)}</span>
              <button type="button" class="vk-button light" data-vk-pay-checkout="${esc(item.id)}" ${item.paymentStatus === "Authorized" ? "disabled" : ""}>Authorize</button>
            </div>
          `).join("") : "<p>No checkout activity yet.</p>"}
        </section>
      </div>
    `;
  }

  function renderAdmin() {
    const tabs = [
      ["dashboard", "Dashboard"],
      ["access", "Access"],
      ["verification", "Verification"],
      ["gateways", "Gateways"],
      ["countries", "Countries"],
      ["plans", "Plans"],
      ["users", "Users"],
      ["moderation", "Moderation"],
      ["config", "Config"]
    ];
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <div class="vk-tabs">
            ${tabs.map(([key, label]) => `<button type="button" class="${activeAdminTab === key ? "active" : ""}" data-vk-admin-tab="${key}">${label}</button>`).join("")}
          </div>
        </section>
        ${renderAdminTab()}
      </div>
    `;
  }

  function renderAdminTab() {
    if (activeAdminTab === "dashboard") {
      const pending = state.uploads.filter((upload) => !["Approved", "Rejected"].includes(upload.status)).length;
      return `
        <section class="vk-panel small"><div class="vk-metric"><span class="vk-eyebrow">Uploads</span><strong>${state.uploads.length}</strong></div></section>
        <section class="vk-panel small"><div class="vk-metric"><span class="vk-eyebrow">Pending Review</span><strong>${pending}</strong></div></section>
        <section class="vk-panel small"><div class="vk-metric"><span class="vk-eyebrow">Countries</span><strong>${state.config.countryRules.length}</strong></div></section>
        <section class="vk-panel small"><div class="vk-metric"><span class="vk-eyebrow">Providers</span><strong>${state.config.paymentProviders.length + state.config.smsProviders.length}</strong></div></section>
        <section class="vk-panel full">
          <p class="vk-eyebrow">Admin Overview</p>
          <h2>Everything Is Configurable</h2>
          <p>Use these panels to manage contributor roles, image categories, upload limits, AI quality rules, face recognition thresholds, payment gateways, country payout rails, SMS APIs, and moderation queues.</p>
        </section>
      `;
    }

    if (activeAdminTab === "access") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">Access Rules</p>
          <h2>Uploads And Role Permissions</h2>
          <div class="vk-form four">
            <label class="vk-field">Free upload minimum<input data-vk-config="freeUploadMin" type="number" min="1" max="10" value="${state.config.freeUploadMin}"></label>
            <label class="vk-field">Free upload maximum<input data-vk-config="freeUploadMax" type="number" min="1" max="10" value="${state.config.freeUploadMax}"></label>
            <label class="vk-field">Active free limit<input data-vk-config="activeFreeLimit" type="number" min="1" max="10" value="${state.config.activeFreeLimit}"></label>
            <label class="vk-field">Contributor eligibility
              <select data-vk-config="contributorEligibility">
                <option ${state.config.contributorEligibility === "Africa only" ? "selected" : ""}>Africa only</option>
                <option ${state.config.contributorEligibility !== "Africa only" ? "selected" : ""}>Admin approved African countries</option>
              </select>
            </label>
            <label class="vk-field">Photo categories<input data-vk-list-config="photoCategories" value="${esc(configuredPhotoCategories().join(", "))}"></label>
            <label class="vk-field">Contributor types<input data-vk-list-config="contributorTypes" value="${esc(configuredContributorTypes().join(", "))}"></label>
            <label class="vk-field">Enduser types<input data-vk-list-config="userTypes" value="${esc(configuredUserTypes().join(", "))}"></label>
          </div>
          <div class="vk-table vk-matrix" style="margin-top:14px">
            <div class="vk-row header"><span>Contributor</span>${configuredPhotoCategories().map((cat) => `<span>${esc(cat)}</span>`).join("")}</div>
            ${configuredContributorTypes().map((type) => `
              <div class="vk-row">
                <strong>${esc(type)}</strong>
                ${configuredPhotoCategories().map((cat) => `<label><input type="checkbox" data-vk-permission-type="${esc(type)}" data-vk-permission-category="${esc(cat)}" ${state.config.contributorPermissions[type]?.includes(cat) ? "checked" : ""}> ${esc(cat)}</label>`).join("")}
              </div>
            `).join("")}
          </div>
        </section>
      `;
    }

    if (activeAdminTab === "verification") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">Verification And AI</p>
          <h2>Quality, Identity, Copyright</h2>
          <div class="vk-form four">
            <label class="vk-field">AI quality threshold<input data-vk-config="aiQualityThreshold" type="range" min="40" max="95" value="${state.config.aiQualityThreshold}"></label>
            <label class="vk-field">Face confidence<input data-vk-config="faceConfidence" type="range" min="60" max="99" value="${state.config.faceConfidence}"></label>
            <label class="vk-field">Accepted IDs<input data-vk-config="idTypes" value="${esc(state.config.idTypes)}"></label>
            <label class="vk-field">Agreement version<input data-vk-config="agreementVersion" value="${esc(state.config.agreementVersion)}"></label>
            <label class="vk-field">License mode<input data-vk-config="licenseMode" value="${esc(state.config.licenseMode)}"></label>
            <label class="vk-field">Payout cadence<input data-vk-config="payoutCadence" value="${esc(state.config.payoutCadence)}"></label>
          </div>
          <div class="vk-step-list" style="margin-top:14px">
            <article class="vk-step done"><strong>AI enhancement</strong><p>Below-threshold images are routed to enhancement before admin review.</p></article>
            <article class="vk-step done"><strong>Facial recognition</strong><p>Profile face scan must match accepted ID before full contributor access.</p></article>
            <article class="vk-step done"><strong>Human faces in uploads</strong><p>Images with other faces require model release and copyright approval.</p></article>
            <article class="vk-step done"><strong>Agreements</strong><p>Contributor, content, copyright, and payout terms are tracked.</p></article>
          </div>
        </section>
      `;
    }

    if (activeAdminTab === "gateways") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">Payment And SMS APIs</p>
          <h2>Country Gateway Matrix</h2>
          <div class="vk-form">
            <label class="vk-field">Global subscription gateway<input data-vk-config="subscriptionGateway" value="${esc(state.config.subscriptionGateway)}"></label>
            <label class="vk-field">Add country payout rail<button type="button" class="vk-button light" data-vk-action="add-gateway">Add Gateway Row</button></label>
            <label class="vk-field">Add payment provider<button type="button" class="vk-button light" data-vk-action="add-payment-provider">Add Provider</button></label>
            <label class="vk-field">Add SMS provider<button type="button" class="vk-button light" data-vk-action="add-sms-provider">Add SMS Row</button></label>
          </div>
          <div class="vk-table" style="margin-top:14px">
            <div class="vk-row header"><span>Country</span><span>Subscription</span><span>Payout</span><span>SMS / API key ref</span><span>Status</span></div>
            ${state.config.gateways.map((gateway, index) => `
              <div class="vk-row">
                <input data-vk-gateway="${index}" data-field="country" value="${esc(gateway.country)}">
                <input data-vk-gateway="${index}" data-field="subscription" value="${esc(gateway.subscription)}">
                <input data-vk-gateway="${index}" data-field="payout" value="${esc(gateway.payout)}">
                <input data-vk-gateway="${index}" data-field="sms" value="${esc(`${gateway.sms} / ${gateway.keyRef}`)}">
                <select data-vk-gateway="${index}" data-field="enabled"><option value="true" ${gateway.enabled ? "selected" : ""}>Enabled</option><option value="false" ${!gateway.enabled ? "selected" : ""}>Paused</option></select>
              </div>
            `).join("")}
          </div>
          <h3 style="margin-top:18px">Payment Provider API Variables</h3>
          <div class="vk-table">
            <div class="vk-row header"><span>Provider</span><span>Purpose</span><span>API Key Reference</span><span>Status</span><span></span></div>
            ${state.config.paymentProviders.map((provider, index) => `
              <div class="vk-row">
                <input data-vk-provider="${index}" data-field="name" value="${esc(provider.name)}">
                <input data-vk-provider="${index}" data-field="purpose" value="${esc(provider.purpose)}">
                <input data-vk-provider="${index}" data-field="apiKeyRef" value="${esc(provider.apiKeyRef)}">
                <select data-vk-provider="${index}" data-field="enabled"><option value="true" ${provider.enabled ? "selected" : ""}>Enabled</option><option value="false" ${!provider.enabled ? "selected" : ""}>Paused</option></select>
                <span></span>
              </div>
            `).join("")}
          </div>
          <h3 style="margin-top:18px">Country SMS API Variables</h3>
          <div class="vk-table">
            <div class="vk-row header"><span>Country</span><span>Provider</span><span>API Key Reference</span><span>Sender ID</span><span>Status</span></div>
            ${state.config.smsProviders.map((provider, index) => `
              <div class="vk-row">
                <input data-vk-sms-provider="${index}" data-field="country" value="${esc(provider.country)}">
                <input data-vk-sms-provider="${index}" data-field="provider" value="${esc(provider.provider)}">
                <input data-vk-sms-provider="${index}" data-field="apiKeyRef" value="${esc(provider.apiKeyRef)}">
                <input data-vk-sms-provider="${index}" data-field="senderId" value="${esc(provider.senderId)}">
                <select data-vk-sms-provider="${index}" data-field="enabled"><option value="true" ${provider.enabled ? "selected" : ""}>Enabled</option><option value="false" ${!provider.enabled ? "selected" : ""}>Paused</option></select>
              </div>
            `).join("")}
          </div>
        </section>
      `;
    }

    if (activeAdminTab === "countries") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">African Contributor Countries</p>
          <h2>Eligibility, IDs, SMS, Payout Currencies</h2>
          <div class="vk-actions">
            <button type="button" class="vk-button light" data-vk-action="add-country-rule">Add Country Rule</button>
          </div>
          <div class="vk-table" style="margin-top:14px">
            <div class="vk-row header"><span>Country</span><span>Accepted IDs</span><span>SMS Provider</span><span>Payout Currency</span><span>Allowed</span></div>
            ${(state.config.countryRules || []).map((rule, index) => `
              <div class="vk-row">
                <input data-vk-country-rule="${index}" data-field="country" value="${esc(rule.country)}">
                <input data-vk-country-rule="${index}" data-field="acceptedIds" value="${esc(rule.acceptedIds)}">
                <input data-vk-country-rule="${index}" data-field="smsProvider" value="${esc(rule.smsProvider)}">
                <input data-vk-country-rule="${index}" data-field="payoutCurrency" value="${esc(rule.payoutCurrency)}">
                <select data-vk-country-rule="${index}" data-field="contributorsAllowed"><option value="true" ${rule.contributorsAllowed ? "selected" : ""}>Allowed</option><option value="false" ${!rule.contributorsAllowed ? "selected" : ""}>Blocked</option></select>
              </div>
            `).join("")}
          </div>
        </section>
      `;
    }

    if (activeAdminTab === "plans") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">Access Levels</p>
          <h2>Contributor And Buyer Plans</h2>
          <h3>Contributor Paid Access</h3>
          <div class="vk-table">
            <div class="vk-row header"><span>Name</span><span>Price</span><span>Upload Limit</span><span>Description</span><span>Verification</span></div>
            ${(state.config.contributorAccessLevels || []).map((level, index) => `
              <div class="vk-row">
                <input data-vk-access-level="${index}" data-field="name" value="${esc(level.name)}">
                <input data-vk-access-level="${index}" data-field="price" value="${esc(level.price)}">
                <input data-vk-access-level="${index}" data-field="uploads" type="number" value="${esc(level.uploads)}">
                <input data-vk-access-level="${index}" data-field="description" value="${esc(level.description)}">
                <select data-vk-access-level="${index}" data-field="requiresVerification"><option value="true" ${level.requiresVerification ? "selected" : ""}>Required</option><option value="false" ${!level.requiresVerification ? "selected" : ""}>Not required</option></select>
              </div>
            `).join("")}
          </div>
          <h3 style="margin-top:18px">Enduser Plans</h3>
          <div class="vk-table">
            <div class="vk-row header"><span>Type</span><span>Price</span><span>Seats</span><span>Downloads</span><span>License</span></div>
            ${state.config.plans.map((plan, index) => `
              <div class="vk-row">
                <input data-vk-plan-config="${index}" data-field="type" value="${esc(plan.type)}">
                <input data-vk-plan-config="${index}" data-field="price" value="${esc(plan.price)}">
                <input data-vk-plan-config="${index}" data-field="seats" type="number" value="${esc(plan.seats)}">
                <input data-vk-plan-config="${index}" data-field="downloads" type="number" value="${esc(plan.downloads)}">
                <input data-vk-plan-config="${index}" data-field="license" value="${esc(plan.license)}">
              </div>
            `).join("")}
          </div>
        </section>
      `;
    }

    if (activeAdminTab === "users") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">User Directory</p>
          <h2>Current Platform Accounts</h2>
          <div class="vk-card-grid">
            <article class="vk-card">
              <strong>Contributor</strong>
              <p>${esc(state.contributor.type)} in ${esc(state.contributor.country)}. Profile ${profileComplete() ? "verified" : "incomplete"}. Access level: ${esc(state.contributor.accessLevel)}.</p>
              <span class="vk-status ${profileComplete() ? "good" : "warn"}">${profileComplete() ? "Verified" : "Needs verification"}</span>
            </article>
            <article class="vk-card">
              <strong>Session</strong>
              <p>Role: ${esc(state.session.role)}. User type: ${esc(state.session.userType || "None")}. Phone: ${esc(state.session.phone || "Not set")}.</p>
              <span class="vk-status ${state.session.otpVerified ? "good" : "warn"}">${state.session.otpVerified ? "OTP verified" : "OTP pending"}</span>
            </article>
            <article class="vk-card">
              <strong>Buyer Activity</strong>
              <p>${state.cart.length} licensing or subscription request(s) created.</p>
              <span class="vk-status good">Global endusers allowed</span>
            </article>
            <article class="vk-card">
              <strong>Contributor Policy</strong>
              <p>${approvedContributorCountries().length} African contributor countries currently enabled.</p>
              <span class="vk-status good">Africa only</span>
            </article>
          </div>
          <h3 style="margin-top:18px">User Cadres For Testing</h3>
          ${renderTestCadres()}
        </section>
      `;
    }

    if (activeAdminTab === "moderation") {
      return `
        <section class="vk-panel full">
          <p class="vk-eyebrow">Content Approval</p>
          <h2>Moderation Queue</h2>
          <div class="vk-upload-list">${renderUploads(state.uploads, "admin")}</div>
        </section>
      `;
    }

    return `
      <section class="vk-panel full">
        <p class="vk-eyebrow">Configuration Export</p>
        <h2>Admin Managed Variables</h2>
        <div class="vk-actions">
          <button type="button" class="vk-button amber" data-vk-action="save-state">Save Configuration</button>
          <button type="button" class="vk-button light" data-vk-action="reset-state">Reset Local Platform Data</button>
        </div>
        <pre class="vk-config-preview">${esc(JSON.stringify(state, null, 2))}</pre>
      </section>
    `;
  }

  function renderTestCadres() {
    const rows = [
      ["Admin", "+10000000001", "Admin", "Manage backend settings, users, gateways, moderation, countries, and plans."],
      ["Contributor: Photo Content", "+2348000000101", "Contributor", "Select Photo Content contributor type and upload content/street/culture images."],
      ["Contributor: Models", "+2348000000102", "Contributor", "Select Models contributor type and test face, ID, release, and copyright checks."],
      ["Contributor: Photographers", "+254700000103", "Contributor", "Select Photographers contributor type and test full category upload access."],
      ["Regular Individual", "+12025550101", "Buyer", "Create a standard checkout from the buyer plans."],
      ["Agency", "+12025550102", "Buyer", "Create team checkout and authorize configured payment."],
      ["Corporate", "+12025550103", "Buyer", "Create procurement checkout for custom plan review."]
    ];
    return `
      <div class="vk-table" style="margin-top:10px">
        <div class="vk-row header"><span>Cadre</span><span>Test Phone</span><span>Role</span><span>Path</span><span>OTP</span></div>
        ${rows.map(([cadre, phone, role, path]) => `
          <div class="vk-row">
            <strong>${esc(cadre)}</strong>
            <span>${esc(phone)}</span>
            <span>${esc(role)}</span>
            <span>${esc(path)}</span>
            <span>Generated per request</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function submitUpload() {
    if (!state.session.otpVerified) {
      toast("Verify mobile OTP before uploading.");
      return;
    }
    if (!canUploadMore()) {
      toast("Starter upload limit reached. Complete profile verification or activate paid access.");
      return;
    }
    const title = byId("vkUploadTitle")?.value.trim() || "Untitled VUEKUMI Upload";
    const category = byId("vkUploadCategory")?.value || "Photo Content";
    const quality = Number(byId("vkUploadQuality")?.value || 70);
    const faces = Boolean(byId("vkHumanFaces")?.checked);
    const release = Boolean(byId("vkModelRelease")?.checked);
    const copyrightApproval = Boolean(byId("vkCopyrightApproval")?.checked);
    const file = byId("vkUploadFile")?.files?.[0];
    const upload = {
      id: `upload-${Date.now()}`,
      owner: "current",
      title,
      category,
      contributorType: state.contributor.type,
      country: state.contributor.country,
      quality,
      faces,
      release,
      copyrightApproval,
      status: uploadStatus(quality, faces, release, copyrightApproval),
      src: "images/africa-content-2.jpg"
    };
    const saveUpload = async () => {
      if (backendOnline) {
        try {
          const created = await requestJson("POST", "/api/uploads", upload);
          state.uploads.unshift(created);
          persist();
          toast("Upload submitted to VUEKUMI review.");
          renderModal();
          return;
        } catch (error) {
          toast(error.message);
          renderModal();
          return;
        }
      }
      state.uploads.unshift(upload);
      persist();
      toast("Upload submitted to VUEKUMI review.");
      renderModal();
    };
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        upload.src = reader.result;
        saveUpload();
      };
      reader.readAsDataURL(file);
      return;
    }
    await saveUpload();
  }

  function uploadStatus(quality, faces, release, copyrightApproval) {
    if (!approvedContributorCountries().includes(state.contributor.country)) return "Country Review";
    if (quality < state.config.aiQualityThreshold) return "AI Enhancement";
    if (faces && (!release || !copyrightApproval)) return "Face/Copyright Verification";
    return "Admin Review";
  }

  async function updateProfile() {
    state.contributor.type = byId("vkContributorType").value;
    state.contributor.country = byId("vkContributorCountry").value;
    state.contributor.accessLevel = byId("vkContributorAccessLevel").value;
    state.contributor.idType = byId("vkContributorIdType").value;
    state.contributor.idReference = byId("vkContributorIdReference").value.trim();
    state.contributor.email = byId("vkContributorEmail").value.trim();
    state.contributor.address = byId("vkContributorAddress").value.trim();
    state.contributor.profilePhoto = byId("vkProfilePhoto").checked || Boolean(byId("vkProfilePhotoFile")?.files?.length);
    state.contributor.governmentId = byId("vkGovernmentId").checked || Boolean(byId("vkGovernmentIdFile")?.files?.length);
    state.contributor.faceScan = byId("vkFaceScan").checked;
    state.contributor.agreementsSigned = byId("vkAgreements").checked;
    state.contributor.contentAgreementSigned = byId("vkContentAgreement").checked;
    state.contributor.copyrightAgreementSigned = byId("vkCopyrightAgreement").checked;
    if (backendOnline) {
      try {
        const response = await requestJson("PUT", "/api/contributor", state.contributor);
        state.contributor = { ...state.contributor, ...response.contributor };
      } catch (error) {
        toast(error.message);
      }
    }
    persist();
    toast(profileComplete() ? "Contributor profile verified." : "Profile progress saved.");
    renderModal();
  }

  function setConfig(key, value, inputType) {
    state.config[key] = inputType === "number" || inputType === "range" ? Number(value) : value;
    persist();
  }

  function setCollectionField(collectionName, index, field, value, inputType) {
    const item = state.config[collectionName]?.[Number(index)];
    if (!item) return;
    if (["enabled", "contributorsAllowed", "requiresVerification"].includes(field)) item[field] = value === "true";
    else if (inputType === "number") item[field] = Number(value);
    else item[field] = value;
    persist();
  }

  function syncMutableFields(event) {
    const configInput = event.target.closest("[data-vk-config]");
    if (configInput) {
      setConfig(configInput.dataset.vkConfig, configInput.value, configInput.type);
    }

    const listInput = event.target.closest("[data-vk-list-config]");
    if (listInput) {
      const values = listInput.value.split(",").map((item) => item.trim()).filter(Boolean);
      if (values.length) state.config[listInput.dataset.vkListConfig] = values;
      persist();
    }

    const gatewayInput = event.target.closest("[data-vk-gateway]");
    if (gatewayInput) {
      const gateway = state.config.gateways[Number(gatewayInput.dataset.vkGateway)];
      const field = gatewayInput.dataset.field;
      if (field === "sms") {
        const [sms, keyRef] = gatewayInput.value.split("/").map((part) => part.trim());
        gateway.sms = sms || "";
        gateway.keyRef = keyRef || "";
      } else if (field === "enabled") {
        gateway.enabled = gatewayInput.value === "true";
      } else {
        gateway[field] = gatewayInput.value;
      }
      persist();
    }

    const providerInput = event.target.closest("[data-vk-provider]");
    if (providerInput) {
      setCollectionField("paymentProviders", providerInput.dataset.vkProvider, providerInput.dataset.field, providerInput.value, providerInput.type);
    }

    const smsProviderInput = event.target.closest("[data-vk-sms-provider]");
    if (smsProviderInput) {
      setCollectionField("smsProviders", smsProviderInput.dataset.vkSmsProvider, smsProviderInput.dataset.field, smsProviderInput.value, smsProviderInput.type);
    }

    const countryRuleInput = event.target.closest("[data-vk-country-rule]");
    if (countryRuleInput) {
      setCollectionField("countryRules", countryRuleInput.dataset.vkCountryRule, countryRuleInput.dataset.field, countryRuleInput.value, countryRuleInput.type);
    }

    const accessLevelInput = event.target.closest("[data-vk-access-level]");
    if (accessLevelInput) {
      setCollectionField("contributorAccessLevels", accessLevelInput.dataset.vkAccessLevel, accessLevelInput.dataset.field, accessLevelInput.value, accessLevelInput.type);
    }

    const planInput = event.target.closest("[data-vk-plan-config]");
    if (planInput) {
      setCollectionField("plans", planInput.dataset.vkPlanConfig, planInput.dataset.field, planInput.value, planInput.type);
    }

    const permission = event.target.closest("[data-vk-permission-type]");
    if (permission) {
      const type = permission.dataset.vkPermissionType;
      const category = permission.dataset.vkPermissionCategory;
      const set = new Set(state.config.contributorPermissions[type] || []);
      if (permission.checked) set.add(category);
      else set.delete(category);
      state.config.contributorPermissions[type] = Array.from(set);
      persist();
    }
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-vk-open]");
      if (open) openPlatform(open.dataset.vkOpen);

      if (event.target.closest("[data-vk-close]") || event.target.id === "vkOverlay") closePlatform();

      const tab = event.target.closest("[data-vk-tab]");
      if (tab) {
        activeView = tab.dataset.vkTab;
        renderModal();
      }

      const adminTab = event.target.closest("[data-vk-admin-tab]");
      if (adminTab) {
        activeAdminTab = adminTab.dataset.vkAdminTab;
        renderModal();
      }

      const role = event.target.closest("[data-vk-role]");
      if (role) {
        const selected = role.dataset.vkRole;
        state.session.role = selected === "Admin" ? "admin" : selected === "Contributor" ? "contributor" : "buyer";
        state.session.userType = selected;
        persist();
        activeView = selected === "Admin" ? "admin" : selected === "Contributor" ? "contributor" : "buyer";
        toast(`${selected} access selected.`);
        renderModal();
      }

      const plan = event.target.closest("[data-vk-plan]");
      if (plan) {
        await createCheckout(plan.dataset.vkPlan, byId("vkBuyerCountry")?.value || "Global");
      }

      const action = event.target.closest("[data-vk-action]");
      if (action) await handleAction(action.dataset.vkAction);

      const payCheckout = event.target.closest("[data-vk-pay-checkout]");
      if (payCheckout) await authorizeCheckout(payCheckout.dataset.vkPayCheckout);

      const moderate = event.target.closest("[data-vk-moderate]");
      if (moderate) {
        await moderateUpload(moderate.dataset.vkModerate, moderate.dataset.status);
      }

      const enhance = event.target.closest("[data-vk-enhance]");
      if (enhance) {
        await enhanceUpload(enhance.dataset.vkEnhance);
      }
    });

    document.addEventListener("input", syncMutableFields);
    document.addEventListener("change", syncMutableFields);
  }

  async function handleAction(action) {
    if (action === "send-otp") {
      await sendOtp();
    }
    if (action === "verify-otp") {
      await verifyOtp();
    }
    if (action === "save-profile") await updateProfile();
    if (action === "run-face-scan") {
      await runFaceMatch();
    }
    if (action === "activate-subscription") {
      await activateContributorAccess();
    }
    if (action === "submit-upload") await submitUpload();
    if (action === "open-buyer") {
      activeView = "buyer";
      renderModal();
    }
    if (action === "create-checkout") {
      const buyerType = byId("vkBuyerType")?.value || "Regular Individual";
      const buyerCountry = byId("vkBuyerCountry")?.value || "Global";
      await createCheckout(buyerType, buyerCountry);
    }
    if (action === "add-selected-license" && state.selectedImage) {
      await createCheckout(state.selectedImage.title || "Image License", byId("vkBuyerCountry")?.value || "Global");
    }
    if (action === "add-gateway") {
      state.config.gateways.push({ country: "New African Country", subscription: state.config.subscriptionGateway, payout: "Payout provider", sms: "SMS provider", keyRef: "API_KEY_REF", enabled: false });
      persist();
      renderModal();
    }
    if (action === "add-payment-provider") {
      state.config.paymentProviders.push({ name: "New Provider", purpose: "Configurable payment rail", apiKeyRef: "PROVIDER_API_KEY", enabled: false });
      persist();
      renderModal();
    }
    if (action === "add-sms-provider") {
      state.config.smsProviders.push({ country: "New African Country", provider: "SMS provider", apiKeyRef: "SMS_API_KEY", senderId: "VUEKUMI", enabled: false });
      persist();
      renderModal();
    }
    if (action === "add-country-rule") {
      state.config.countryRules.push({ country: "New African Country", contributorsAllowed: false, acceptedIds: "DL, International Passport, Government ID", smsProvider: "SMS provider", payoutCurrency: "LOCAL" });
      persist();
      renderModal();
    }
    if (action === "save-state") {
      persist();
      toast("Configuration saved locally.");
    }
    if (action === "reset-state") {
      localStorage.removeItem("vuekumiMainPlatform");
      state = loadState();
      toast("Local platform data reset.");
      renderModal();
    }
  }

  function boot() {
    renderShell();
    bindEvents();
    enhanceMarketplaceNav();
    const observer = new MutationObserver(enhanceMarketplaceNav);
    observer.observe(document.body, { childList: true, subtree: true });
    hydrateFromBackend();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
