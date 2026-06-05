const categories = ["Photo Content", "Models", "Photography", "Street", "Culture"];
const contributorTypes = ["Photo Content", "Models", "Photographers"];

const defaults = {
  freeUploadMin: 3,
  freeUploadMax: 5,
  activeFreeLimit: 3,
  contributorEligibility: "Africa only",
  aiThreshold: 72,
  faceConfidence: 88,
  idTypes: "DL, International Passport, High-rated Government ID",
  agreementVersion: "VUEKUMI Contributor Agreement v1.0",
  permissions: {
    "Photo Content": ["Photo Content", "Street", "Culture"],
    Models: ["Models", "Photography"],
    Photographers: ["Photo Content", "Models", "Photography", "Street", "Culture"]
  },
  gateways: [
    { country: "Nigeria", subscription: "Stripe global", payout: "Paystack Transfer", sms: "Termii", keyRef: "NG_PAYSTACK_SECRET" },
    { country: "Ghana", subscription: "Stripe global", payout: "Flutterwave Ghana", sms: "Hubtel", keyRef: "GH_FLW_SECRET" },
    { country: "Kenya", subscription: "Stripe global", payout: "M-Pesa Daraja", sms: "Africa's Talking", keyRef: "KE_MPESA_SECRET" },
    { country: "South Africa", subscription: "Stripe global", payout: "Ozow", sms: "Clickatell", keyRef: "ZA_OZOW_SECRET" },
    { country: "Rwanda", subscription: "Stripe global", payout: "Flutterwave Rwanda", sms: "Africa's Talking", keyRef: "RW_FLW_SECRET" }
  ]
};

let config = loadConfig();
let otpVerified = false;
let uploads = 0;

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function loadConfig() {
  try {
    return { ...structuredClone(defaults), ...JSON.parse(localStorage.getItem("vuekumiConsoleConfig") || "{}") };
  } catch {
    return structuredClone(defaults);
  }
}

function saveConfig() {
  localStorage.setItem("vuekumiConsoleConfig", JSON.stringify(config, null, 2));
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function renderUploadState() {
  setText("#uploadCount", uploads);
  setText("#uploadLimit", config.activeFreeLimit);
  const status = document.querySelector("#otpStatus");
  status.textContent = otpVerified ? "OTP verified" : "OTP pending";
  status.classList.toggle("good", otpVerified);
  const uploadButton = document.querySelector("#addUpload");
  uploadButton.disabled = !otpVerified;
  uploadButton.textContent = uploads >= config.activeFreeLimit ? "Upgrade Required" : "Add Image";
  renderSteps();
}

function renderSteps() {
  const steps = [
    ["Mobile OTP", "Contributor starts with phone number and one-time code.", otpVerified ? "done" : "active"],
    ["Starter Uploads", `${config.activeFreeLimit} free images before paid contributor access is required.`, otpVerified ? "active" : "locked"],
    ["Profile Completion", "Email, address, country, contact details, and contributor category.", uploads >= config.activeFreeLimit ? "active" : "locked"],
    ["Face And ID Match", `${config.faceConfidence}% facial confidence against profile photo and accepted government ID.`, uploads >= config.activeFreeLimit ? "active" : "locked"],
    ["Copyright Agreements", config.agreementVersion, uploads >= config.activeFreeLimit ? "active" : "locked"],
    ["Human Face Approval", "Images with other faces route to release, likeness, and copyright approval checks.", "active"],
    ["AI Enhancement", `Images below ${config.aiThreshold}% quality enter AI enhancement before review.`, "active"],
    ["Country Policy", config.contributorEligibility, "active"]
  ];

  document.querySelector("#verificationSteps").innerHTML = steps.map(([title, copy, state]) => `
    <article class="step-card ${state}">
      <strong>${title}</strong>
      <p>${copy}</p>
    </article>
  `).join("");
}

function renderInputs() {
  const fields = {
    freeMin: "freeUploadMin",
    freeMax: "freeUploadMax",
    activeFreeLimit: "activeFreeLimit",
    contributorEligibility: "contributorEligibility",
    aiThreshold: "aiThreshold",
    faceConfidence: "faceConfidence",
    idTypes: "idTypes",
    agreementVersion: "agreementVersion"
  };

  Object.entries(fields).forEach(([id, key]) => {
    const input = document.querySelector(`#${id}`);
    input.value = config[key];
  });
}

function renderMatrix() {
  document.querySelector("#permissionMatrix").innerHTML = `
    <div class="matrix-row header">
      <span>Contributor</span>
      ${categories.map((category) => `<span>${category}</span>`).join("")}
    </div>
    ${contributorTypes.map((type) => `
      <div class="matrix-row">
        <strong>${type}</strong>
        ${categories.map((category) => `
          <label>
            <input type="checkbox" data-type="${type}" data-category="${category}" ${config.permissions[type]?.includes(category) ? "checked" : ""}>
            ${category}
          </label>
        `).join("")}
      </div>
    `).join("")}
  `;
}

function renderGateways() {
  document.querySelector("#gatewayTable").innerHTML = `
    <div class="gateway-row header">
      <span>Country</span>
      <span>Subscription gateway</span>
      <span>Contributor payout gateway</span>
      <span>SMS API / key reference</span>
    </div>
    ${config.gateways.map((gateway, index) => `
      <div class="gateway-row">
        <input data-gateway="${index}" data-field="country" value="${escapeAttr(gateway.country)}" aria-label="Country">
        <input data-gateway="${index}" data-field="subscription" value="${escapeAttr(gateway.subscription)}" aria-label="Subscription gateway">
        <input data-gateway="${index}" data-field="payout" value="${escapeAttr(gateway.payout)}" aria-label="Payout gateway">
        <input data-gateway="${index}" data-field="sms" value="${escapeAttr(`${gateway.sms} / ${gateway.keyRef}`)}" aria-label="SMS API">
      </div>
    `).join("")}
  `;
}

function renderPreview() {
  document.querySelector("#configPreview").textContent = JSON.stringify(config, null, 2);
}

function bindEvents() {
  const fields = {
    freeMin: "freeUploadMin",
    freeMax: "freeUploadMax",
    activeFreeLimit: "activeFreeLimit",
    contributorEligibility: "contributorEligibility",
    aiThreshold: "aiThreshold",
    faceConfidence: "faceConfidence",
    idTypes: "idTypes",
    agreementVersion: "agreementVersion"
  };

  Object.entries(fields).forEach(([id, key]) => {
    const input = document.querySelector(`#${id}`);
    input.addEventListener("input", () => {
      config[key] = input.type === "number" || input.type === "range" ? Number(input.value) : input.value;
      renderUploadState();
      renderPreview();
    });
  });

  document.querySelector("#sendOtp").addEventListener("click", () => {
    const phone = document.querySelector("#phoneInput").value.trim();
    const status = document.querySelector("#otpStatus");
    status.textContent = phone ? "OTP sent: 246810" : "Enter phone number";
    status.classList.remove("good");
  });

  document.querySelector("#verifyOtp").addEventListener("click", () => {
    otpVerified = document.querySelector("#otpInput").value.trim() === "246810";
    if (!otpVerified) document.querySelector("#otpStatus").textContent = "OTP mismatch";
    renderUploadState();
  });

  document.querySelector("#addUpload").addEventListener("click", () => {
    if (!otpVerified) return;
    if (uploads < config.activeFreeLimit) uploads += 1;
    renderUploadState();
  });

  document.querySelector("#permissionMatrix").addEventListener("change", (event) => {
    const input = event.target;
    if (!input.matches("[data-type]")) return;
    const set = new Set(config.permissions[input.dataset.type] || []);
    if (input.checked) set.add(input.dataset.category);
    else set.delete(input.dataset.category);
    config.permissions[input.dataset.type] = Array.from(set);
    renderPreview();
  });

  document.querySelector("#gatewayTable").addEventListener("input", (event) => {
    const input = event.target;
    if (!input.matches("[data-gateway]")) return;
    const gateway = config.gateways[Number(input.dataset.gateway)];
    if (input.dataset.field === "sms") {
      const [sms, keyRef] = input.value.split("/").map((part) => part.trim());
      gateway.sms = sms || "";
      gateway.keyRef = keyRef || "";
    } else {
      gateway[input.dataset.field] = input.value;
    }
    renderPreview();
  });

  document.querySelector("#saveConfig").addEventListener("click", () => {
    saveConfig();
    const button = document.querySelector("#saveConfig");
    button.textContent = "Saved";
    setTimeout(() => { button.textContent = "Save Config"; }, 1200);
  });

  document.querySelector("#resetConfig").addEventListener("click", () => {
    config = structuredClone(defaults);
    uploads = 0;
    otpVerified = false;
    renderAll();
  });
}

function renderAll() {
  renderInputs();
  renderUploadState();
  renderMatrix();
  renderGateways();
  renderPreview();
}

renderAll();
bindEvents();
