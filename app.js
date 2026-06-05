const photoCategories = ["All", "Photo Content", "Models", "Photography", "Street", "Culture"];
const contributorTypes = ["Photo Content", "Models", "Photographers"];

const photoLibrary = [
  { title: "Kente Editorial", category: "Culture", country: "Ghana", contributor: "Ama Studio", pos: "46% 16%", zoom: "780px", label: "Featured", height: 350 },
  { title: "Lagos Morning", category: "Street", country: "Nigeria", contributor: "Kemi Lens", pos: "52% 62%", zoom: "820px", label: "Street", height: 240 },
  { title: "Studio Model Release", category: "Models", country: "Kenya", contributor: "Nia Faces", pos: "52% 38%", zoom: "820px", label: "Verified", height: 330 },
  { title: "Festival Colors", category: "Culture", country: "South Africa", contributor: "Nomsa Archive", pos: "50% 91%", zoom: "860px", label: "Culture", height: 250 },
  { title: "Savannah Transit", category: "Photography", country: "Tanzania", contributor: "Ayo Travel", pos: "44% 72%", zoom: "900px", label: "Photo", height: 300 },
  { title: "Royal Portrait", category: "Models", country: "Ethiopia", contributor: "Saba Works", pos: "44% 44%", zoom: "840px", label: "Models", height: 370 },
  { title: "Market Texture", category: "Photo Content", country: "Rwanda", contributor: "Kigali House", pos: "55% 56%", zoom: "760px", label: "Content", height: 230 },
  { title: "Cape Coast Light", category: "Photography", country: "Ghana", contributor: "Ama Studio", pos: "42% 68%", zoom: "820px", label: "Photo", height: 280 },
  { title: "Urban Bridge", category: "Street", country: "Nigeria", contributor: "Yaba Frames", pos: "50% 81%", zoom: "860px", label: "Street", height: 320 },
  { title: "Textile Closeup", category: "Photo Content", country: "Senegal", contributor: "Dakar Set", pos: "42% 85%", zoom: "900px", label: "Content", height: 210 },
  { title: "Editorial Man", category: "Models", country: "Nigeria", contributor: "Musa Faces", pos: "46% 33%", zoom: "820px", label: "Release", height: 360 },
  { title: "Golden Falls", category: "Photography", country: "Zimbabwe", contributor: "Zambezi Stock", pos: "46% 21%", zoom: "820px", label: "Travel", height: 260 },
  { title: "Braids Study", category: "Models", country: "Ghana", contributor: "Afia Model Co", pos: "50% 42%", zoom: "840px", label: "Verified", height: 340 },
  { title: "Desert Crossing", category: "Photography", country: "Morocco", contributor: "Atlas View", pos: "42% 73%", zoom: "920px", label: "Travel", height: 230 },
  { title: "Ceremonial Dance", category: "Culture", country: "Benin", contributor: "Porto Archive", pos: "45% 88%", zoom: "940px", label: "Culture", height: 300 },
  { title: "Corporate Portrait", category: "Models", country: "Kenya", contributor: "Nairobi Cast", pos: "44% 31%", zoom: "840px", label: "Model", height: 320 },
  { title: "City Rise", category: "Street", country: "South Africa", contributor: "Joburg View", pos: "55% 78%", zoom: "850px", label: "Street", height: 260 },
  { title: "Handmade Pattern", category: "Photo Content", country: "Mali", contributor: "Bamako Works", pos: "53% 71%", zoom: "900px", label: "Content", height: 290 }
];

const contributors = [
  { name: "Ama Nkansah", type: "Photo Content", country: "Ghana", pos: "45% 39%", zoom: "850px" },
  { name: "Musa Bello", type: "Photographer", country: "Nigeria", pos: "46% 31%", zoom: "820px" },
  { name: "Nia Achieng", type: "Models", country: "Kenya", pos: "52% 40%", zoom: "850px" },
  { name: "Thandi Mokoena", type: "Models", country: "South Africa", pos: "50% 50%", zoom: "840px" },
  { name: "Saba Tesfaye", type: "Photo Content", country: "Ethiopia", pos: "45% 45%", zoom: "850px" },
  { name: "Kojo Mensah", type: "Photographer", country: "Ghana", pos: "48% 58%", zoom: "790px" }
];

const defaultConfig = {
  freeUploadMin: 3,
  freeUploadMax: 5,
  activeFreeUploadLimit: 3,
  contributorRegion: "Africa only",
  defaultSubscriptionGateway: "Stripe",
  aiThreshold: 72,
  faceConfidence: 88,
  idTypes: "DL, International Passport, Government ID",
  agreementVersion: "VUEKUMI Contributor Agreement v1.0",
  reviewSla: "24 hours for verified contributors",
  publicCategories: "Photo Content, Models, Photography, Street, Culture",
  licenseMode: "Rights managed and royalty free",
  payoutCadence: "Monthly",
  categoryPermissions: {
    "Photo Content": ["Photo Content", "Street", "Culture"],
    Models: ["Models", "Photography"],
    Photographers: ["Photo Content", "Photography", "Street", "Culture", "Models"]
  },
  gateways: [
    { country: "Nigeria", subscription: "Stripe", payout: "Paystack Transfer", sms: "Termii", keyRef: "NG_PAYSTACK_SECRET" },
    { country: "Ghana", subscription: "Stripe", payout: "Flutterwave Ghana", sms: "Hubtel", keyRef: "GH_FLW_SECRET" },
    { country: "Kenya", subscription: "Stripe", payout: "M-Pesa Daraja", sms: "Africa's Talking", keyRef: "KE_MPESA_SECRET" },
    { country: "South Africa", subscription: "Stripe", payout: "Ozow", sms: "Clickatell", keyRef: "ZA_OZOW_SECRET" },
    { country: "Rwanda", subscription: "Stripe", payout: "Flutterwave Rwanda", sms: "Africa's Talking", keyRef: "RW_FLW_SECRET" }
  ]
};

let config = loadConfig();
let uploadCount = 0;
let otpVerified = false;
let activeCategory = "All";
let activeView = "featured";

function loadConfig() {
  try {
    const saved = localStorage.getItem("vuekumiAdminConfig");
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : structuredClone(defaultConfig);
  } catch (error) {
    return structuredClone(defaultConfig);
  }
}

function saveConfig() {
  localStorage.setItem("vuekumiAdminConfig", JSON.stringify(config, null, 2));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function styleVars(item) {
  return `--pos: ${item.pos}; --zoom: ${item.zoom}; --height: ${item.height || 260}px;`;
}

function labelClass(label) {
  if (["Culture", "Release"].includes(label)) return "label-red";
  if (["Street", "Verified"].includes(label)) return "label-green";
  return "label-gold";
}

function photoCard(item, className = "") {
  return `
    <article class="photo-card photo-bg ${className}" style="${styleVars(item)}">
      <div class="photo-meta">
        <span class="label ${labelClass(item.label)}">${escapeHtml(item.label)}</span>
        <span>${escapeHtml(item.country)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.category)} by ${escapeHtml(item.contributor)}</p>
    </article>
  `;
}

function filteredPhotos() {
  const query = document.querySelector("#globalSearch")?.value.trim().toLowerCase() || "";
  return photoLibrary.filter((item) => {
    const categoryMatch = activeCategory === "All" || item.category === activeCategory;
    const queryMatch = !query || [item.title, item.category, item.country, item.contributor].join(" ").toLowerCase().includes(query);
    return categoryMatch && queryMatch;
  });
}

function renderCategories() {
  const strip = document.querySelector("#categoryStrip");
  strip.innerHTML = photoCategories
    .map((category) => `<button class="chip ${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join("");
}

function renderRail() {
  document.querySelector("#railList").innerHTML = photoLibrary.slice(0, 6).map((item) => `
    <button class="rail-item" data-category="${escapeHtml(item.category)}">
      <span class="rail-thumb photo-bg" style="${styleVars(item)}"></span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.country)} / ${escapeHtml(item.category)}</span>
      </span>
    </button>
  `).join("");
}

function renderSpotlight() {
  const photos = filteredPhotos();
  const spotlight = photos.length ? photos : photoLibrary;
  document.querySelector("#spotlightGrid").innerHTML = spotlight.slice(0, 10).map((item, index) => {
    const className = index === 0 ? "wide tall" : index % 4 === 0 ? "tall" : "";
    return photoCard(item, className);
  }).join("");
}

function renderGallery() {
  let items = [...photoLibrary];
  if (activeView === "new") items = [...items].reverse();
  if (activeView === "approved") items = items.filter((item) => ["Verified", "Release", "Featured"].includes(item.label));
  document.querySelector("#galleryGrid").innerHTML = items.slice(0, 10).map((item) => photoCard(item)).join("");
}

function renderContributors() {
  document.querySelector("#contributorGrid").innerHTML = contributors.map((person) => `
    <article class="contributor-card photo-bg" style="${styleVars({ ...person, height: 270 })}">
      <span class="verified-dot" aria-hidden="true"></span>
      <span class="label label-green">${escapeHtml(person.type)}</span>
      <h3>${escapeHtml(person.name)}</h3>
      <p>${escapeHtml(person.country)} / verified contributor</p>
    </article>
  `).join("");
}

function renderMasonry() {
  const filter = document.querySelector("#masonryFilter")?.value || "All";
  const items = photoLibrary
    .concat(photoLibrary.slice(0, 8))
    .filter((item) => filter === "All" || item.category === filter);
  document.querySelector("#masonryGrid").innerHTML = items.map((item, index) => {
    const adjusted = { ...item, height: [240, 320, 270, 380, 220, 300][index % 6] };
    return photoCard(adjusted);
  }).join("");
}

function renderPlans() {
  const plans = [
    {
      name: "Regular Individual",
      price: "$19",
      copy: "For creators, bloggers, educators, and personal projects.",
      items: ["Standard royalty free downloads", "Single-seat licensing", "Saved boards and invoices"]
    },
    {
      name: "Agency",
      price: "$149",
      copy: "For creative teams managing campaigns and client work.",
      items: ["Team seats", "Extended license requests", "Model release visibility"],
      featured: true
    },
    {
      name: "Corporate",
      price: "Custom",
      copy: "For brands needing global rights, procurement, and compliance.",
      items: ["Rights managed workflow", "Country usage terms", "Dedicated approval support"]
    }
  ];
  document.querySelector("#planGrid").innerHTML = plans.map((plan) => `
    <article class="plan-card ${plan.featured ? "featured" : ""}">
      <div>
        <p class="section-kicker">${escapeHtml(plan.name)}</p>
        <h3>${escapeHtml(plan.name)}</h3>
        <p>${escapeHtml(plan.copy)}</p>
      </div>
      <div class="price">${escapeHtml(plan.price)}</div>
      <ul>${plan.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <button class="btn ${plan.featured ? "btn-gold" : "btn-light"}">Choose ${escapeHtml(plan.name)}</button>
    </article>
  `).join("");
}

function renderVerificationSteps() {
  const steps = [
    { title: "Mobile OTP", copy: "Phone verification unlocks the starter upload flow.", state: otpVerified ? "done" : "active" },
    { title: "Profile Completion", copy: "Email, address, contacts, contributor category, and payout country.", state: otpVerified ? "active" : "locked" },
    { title: "Face And ID Match", copy: `Face match target is ${config.faceConfidence}% using profile photo and accepted government ID.`, state: otpVerified && uploadCount >= config.activeFreeUploadLimit ? "active" : "locked" },
    { title: "Content Agreements", copy: config.agreementVersion, state: otpVerified && uploadCount >= config.activeFreeUploadLimit ? "active" : "locked" },
    { title: "Release Verification", copy: "Images with human faces route to copyright, model release, and likeness approval.", state: "active" },
    { title: "AI Quality Enhancement", copy: `Images below ${config.aiThreshold}% quality score enter the enhancement queue before review.`, state: "active" }
  ];
  document.querySelector("#verificationSteps").innerHTML = steps.map((step) => `
    <article class="step-card" data-state="${step.state}">
      <strong>${escapeHtml(step.title)}</strong>
      <p>${escapeHtml(step.copy)}</p>
    </article>
  `).join("");
}

function renderUploadState() {
  document.querySelector("#uploadCount").textContent = uploadCount;
  document.querySelector("#uploadLimit").textContent = config.activeFreeUploadLimit;
  document.querySelector("#freeUploadStat").textContent = config.activeFreeUploadLimit;
  const status = document.querySelector("#otpStatus");
  status.textContent = otpVerified ? "OTP verified" : "OTP pending";
  status.classList.toggle("good", otpVerified);
  const uploadBtn = document.querySelector("#uploadActionBtn");
  uploadBtn.textContent = uploadCount >= config.activeFreeUploadLimit ? "Upgrade Required" : "Add Image";
  uploadBtn.disabled = !otpVerified;
  renderVerificationSteps();
}

function renderPermissionMatrix() {
  const headers = photoCategories.filter((category) => category !== "All");
  const rows = contributorTypes.map((type) => `
    <div class="matrix-row">
      <strong>${escapeHtml(type)}</strong>
      ${headers.map((category) => {
        const checked = config.categoryPermissions[type]?.includes(category) ? "checked" : "";
        return `
          <label>
            <input type="checkbox" data-permission-type="${escapeHtml(type)}" data-permission-category="${escapeHtml(category)}" ${checked}>
            ${escapeHtml(category)}
          </label>
        `;
      }).join("")}
    </div>
  `).join("");
  document.querySelector("#permissionMatrix").innerHTML = `
    <div class="matrix-row header">
      <span>Contributor</span>
      ${headers.map((header) => `<span>${escapeHtml(header)}</span>`).join("")}
    </div>
    ${rows}
  `;
}

function renderProcessGrid() {
  const processes = [
    ["AI quality enhancement", `Threshold ${config.aiThreshold}% before manual review.`],
    ["Facial recognition release check", `${config.faceConfidence}% minimum match confidence.`],
    ["Government ID verification", config.idTypes],
    ["Copyright agreements", config.agreementVersion],
    ["Country eligibility", config.contributorRegion],
    ["Manual moderation SLA", config.reviewSla]
  ];
  document.querySelector("#processGrid").innerHTML = processes.map(([title, copy]) => `
    <article class="admin-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(copy)}</p>
    </article>
  `).join("");
}

function renderGatewayTable() {
  document.querySelector("#gatewayTable").innerHTML = `
    <div class="gateway-row header">
      <span>Country</span>
      <span>Subscription charge gateway</span>
      <span>Contributor payout gateway</span>
      <span>SMS API and key reference</span>
    </div>
    ${config.gateways.map((gateway, index) => `
      <div class="gateway-row">
        <input data-gateway-index="${index}" data-gateway-field="country" value="${escapeHtml(gateway.country)}" aria-label="Country">
        <input data-gateway-index="${index}" data-gateway-field="subscription" value="${escapeHtml(gateway.subscription)}" aria-label="Subscription gateway">
        <input data-gateway-index="${index}" data-gateway-field="payout" value="${escapeHtml(gateway.payout)}" aria-label="Payout gateway">
        <input data-gateway-index="${index}" data-gateway-field="sms" value="${escapeHtml(gateway.sms)} / ${escapeHtml(gateway.keyRef)}" aria-label="SMS API">
      </div>
    `).join("")}
  `;
}

function bindConfigInputs() {
  const fieldMap = {
    freeMin: "freeUploadMin",
    freeMax: "freeUploadMax",
    contributorRegion: "contributorRegion",
    defaultSubscriptionGateway: "defaultSubscriptionGateway",
    aiThreshold: "aiThreshold",
    faceConfidence: "faceConfidence",
    idTypes: "idTypes",
    agreementVersion: "agreementVersion",
    reviewSla: "reviewSla",
    publicCategories: "publicCategories",
    licenseMode: "licenseMode",
    payoutCadence: "payoutCadence"
  };

  Object.entries(fieldMap).forEach(([id, key]) => {
    const input = document.querySelector(`#${id}`);
    if (!input) return;
    input.value = config[key];
    input.addEventListener("input", () => {
      const numericKeys = ["freeUploadMin", "freeUploadMax", "aiThreshold", "faceConfidence"];
      config[key] = numericKeys.includes(key) ? Number(input.value) : input.value;
      if (key === "freeUploadMin") {
        config.activeFreeUploadLimit = Number(input.value);
      }
      renderUploadState();
      renderProcessGrid();
      renderConfigPreview();
    });
  });
}

function renderConfigPreview() {
  document.querySelector("#configPreview").textContent = JSON.stringify(config, null, 2);
}

function renderAdmin() {
  bindConfigInputs();
  renderPermissionMatrix();
  renderProcessGrid();
  renderGatewayTable();
  renderConfigPreview();
}

function renderFooterGallery() {
  document.querySelector("#footerGallery").innerHTML = photoLibrary.slice(0, 9).map((item) => photoCard(item)).join("");
}

function renderAll() {
  renderCategories();
  renderRail();
  renderSpotlight();
  renderGallery();
  renderContributors();
  renderMasonry();
  renderPlans();
  renderUploadState();
  renderAdmin();
  renderFooterGallery();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const scrollTarget = event.target.closest("[data-scroll]");
    if (scrollTarget) {
      document.querySelector(scrollTarget.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const modalOpen = event.target.closest("[data-open-modal]");
    if (modalOpen) {
      const modal = document.querySelector(`#${modalOpen.dataset.openModal}`);
      modal.hidden = false;
      document.body.classList.add("modal-open");
    }

    if (event.target.matches("[data-close-modal]") || event.target.classList.contains("modal")) {
      document.querySelectorAll(".modal").forEach((modal) => { modal.hidden = true; });
      document.body.classList.remove("modal-open");
    }

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      activeCategory = categoryButton.dataset.category;
      renderCategories();
      renderSpotlight();
    }

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      activeView = viewButton.dataset.view;
      document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button === viewButton));
      renderGallery();
    }

    const adminTab = event.target.closest("[data-admin-tab]");
    if (adminTab) {
      const target = adminTab.dataset.adminTab;
      document.querySelectorAll("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button === adminTab));
      document.querySelectorAll("[data-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === target));
    }
  });

  document.querySelector("#globalSearch").addEventListener("input", renderSpotlight);
  document.querySelector("#masonryFilter").addEventListener("change", renderMasonry);

  document.querySelector("#sendOtpBtn").addEventListener("click", () => {
    const phone = document.querySelector("#phoneInput").value.trim();
    document.querySelector("#otpStatus").textContent = phone ? "OTP sent: 246810" : "Enter mobile number";
  });

  document.querySelector("#verifyOtpBtn").addEventListener("click", () => {
    otpVerified = document.querySelector("#otpInput").value.trim() === "246810";
    if (!otpVerified) {
      document.querySelector("#otpStatus").textContent = "OTP mismatch";
    }
    renderUploadState();
  });

  document.querySelector("#uploadActionBtn").addEventListener("click", () => {
    if (!otpVerified) return;
    if (uploadCount < config.activeFreeUploadLimit) {
      uploadCount += 1;
    } else {
      document.querySelector("#pricing").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderUploadState();
  });

  document.querySelector("#permissionMatrix").addEventListener("change", (event) => {
    const input = event.target;
    if (!input.matches("[data-permission-type]")) return;
    const type = input.dataset.permissionType;
    const category = input.dataset.permissionCategory;
    const current = new Set(config.categoryPermissions[type] || []);
    if (input.checked) current.add(category);
    else current.delete(category);
    config.categoryPermissions[type] = Array.from(current);
    renderConfigPreview();
  });

  document.querySelector("#gatewayTable").addEventListener("input", (event) => {
    const input = event.target;
    if (!input.matches("[data-gateway-index]")) return;
    const gateway = config.gateways[Number(input.dataset.gatewayIndex)];
    const field = input.dataset.gatewayField;
    if (field === "sms") {
      const [sms, keyRef] = input.value.split("/").map((part) => part.trim());
      gateway.sms = sms || "";
      gateway.keyRef = keyRef || gateway.keyRef;
    } else {
      gateway[field] = input.value;
    }
    renderConfigPreview();
  });

  document.querySelector("#saveConfigBtn").addEventListener("click", () => {
    saveConfig();
    const button = document.querySelector("#saveConfigBtn");
    button.textContent = "Saved";
    setTimeout(() => { button.textContent = "Save Config"; }, 1200);
  });
}

renderAll();
bindEvents();
