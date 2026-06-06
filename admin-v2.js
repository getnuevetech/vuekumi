(function () {
  const app = document.getElementById("vkAdminApp");
  const title = document.getElementById("vkAdminTitle");
  const kicker = document.getElementById("vkAdminKicker");
  const toastNode = document.getElementById("vkAdminToast");

  const views = {
    dashboard: ["New Admin Backend", "Platform Administration"],
    access: ["Access Management", "Roles And Categories"],
    users: ["People", "Users And Cadres"],
    contributors: ["Contributors", "Verification Pipeline"],
    content: ["Content", "Images And Moderation"],
    commerce: ["Commerce", "Orders And Licenses"],
    integrations: ["Integrations", "Gateways And APIs"],
    activity: ["Activity", "Audit Trail"]
  };

  let activeView = localStorage.getItem("vuekumiAdminV2View") || "dashboard";
  let session = loadSession();
  let state = emptyState();
  let toastTimer = null;

  function emptyState() {
    return {
      dashboard: null,
      access: null,
      config: null,
      users: { items: [] },
      contributors: { items: [] },
      assets: { items: [], aiJobs: [], faceApprovalCases: [] },
      commerce: { orders: [], licenses: [], payouts: [] },
      integrations: null,
      activity: { items: [] }
    };
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function optionList(options, value) {
    return options.map((option) => `<option value="${esc(option)}" ${option === value ? "selected" : ""}>${esc(option)}</option>`).join("");
  }

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem("vuekumiAdminV2Session") || "null");
      if (!saved?.token || !saved.expiresAt || Date.now() > Number(saved.expiresAt)) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function saveSession(next) {
    session = next;
    if (next) localStorage.setItem("vuekumiAdminV2Session", JSON.stringify(next));
    else localStorage.removeItem("vuekumiAdminV2Session");
  }

  function can(permission) {
    const permissions = session?.user?.permissions || [];
    return permissions.includes(permission) || permissions.includes("settings");
  }

  function viewAllowed(view) {
    const permission = {
      dashboard: "overview",
      access: "access",
      users: "users",
      contributors: "users",
      content: "content",
      commerce: "overview",
      integrations: "settings",
      activity: "activity"
    }[view];
    return Boolean(session && can(permission));
  }

  function firstAllowedView() {
    return Object.keys(views).find(viewAllowed) || "dashboard";
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      saveSession(null);
      renderLogin(payload.error || "Admin session required");
      throw new Error(payload.error || "Admin session required");
    }
    if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
    return payload;
  }

  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2800);
  }

  async function loadAll() {
    const loaders = [
      viewAllowed("dashboard") ? api("/api/v2/admin/dashboard") : Promise.resolve(state.dashboard),
      viewAllowed("access") ? api("/api/v2/admin/access") : Promise.resolve(state.access),
      can("settings") ? api("/api/v2/admin/config") : Promise.resolve(state.config),
      viewAllowed("users") ? api("/api/v2/admin/users") : Promise.resolve(state.users),
      viewAllowed("contributors") ? api("/api/v2/admin/contributors") : Promise.resolve(state.contributors),
      viewAllowed("content") ? api("/api/v2/admin/assets") : Promise.resolve(state.assets),
      viewAllowed("commerce") ? api("/api/v2/admin/commerce") : Promise.resolve(state.commerce),
      viewAllowed("integrations") ? api("/api/v2/admin/integrations") : Promise.resolve(state.integrations),
      viewAllowed("activity") ? api("/api/v2/admin/activity") : Promise.resolve(state.activity)
    ];
    const [dashboard, access, config, users, contributors, assets, commerce, integrations, activity] = await Promise.all(loaders);
    state = { dashboard, access, config, users, contributors, assets, commerce, integrations, activity };
  }

  async function refresh() {
    if (!session) return renderLogin();
    await loadAll();
    render();
  }

  function renderNav() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      const allowed = viewAllowed(button.dataset.view);
      button.hidden = Boolean(session) && !allowed;
      button.disabled = Boolean(session) && !allowed;
      button.classList.toggle("active", button.dataset.view === activeView);
    });
  }

  function setView(view) {
    activeView = views[view] && viewAllowed(view) ? view : firstAllowedView();
    localStorage.setItem("vuekumiAdminV2View", activeView);
    render();
  }

  function render() {
    if (!session) return renderLogin();
    if (!viewAllowed(activeView)) activeView = firstAllowedView();
    renderNav();
    const [nextKicker, nextTitle] = views[activeView] || views.dashboard;
    kicker.textContent = nextKicker;
    title.textContent = nextTitle;
    if (activeView === "dashboard") app.innerHTML = renderDashboard();
    if (activeView === "access") app.innerHTML = renderAccess();
    if (activeView === "users") app.innerHTML = renderUsers();
    if (activeView === "contributors") app.innerHTML = renderContributors();
    if (activeView === "content") app.innerHTML = renderContent();
    if (activeView === "commerce") app.innerHTML = renderCommerce();
    if (activeView === "integrations") app.innerHTML = renderIntegrations();
    if (activeView === "activity") app.innerHTML = renderActivity();
  }

  function renderLogin(message = "") {
    renderNav();
    kicker.textContent = "Secure Command";
    title.textContent = "Admin Login";
    app.innerHTML = `
      <div class="vk-login">
        <form class="vk-login-card" data-login>
          <span class="vk-eyebrow">VUEKUMI Administration</span>
          <h2>Admin login</h2>
          <p>Manage access, users, contributors, content, payments, integrations, and activity.</p>
          <div class="vk-form">
            <label>Admin identifier<input id="vkAdminIdentifier" autocomplete="username" placeholder="admin@vuekumi.local" required></label>
            <label>Admin access key<input id="vkAdminAccessKey" type="password" autocomplete="current-password" required></label>
          </div>
          ${message ? `<p class="vk-status bad">${esc(message)}</p>` : ""}
          <button class="vk-button primary" type="submit">Sign in</button>
        </form>
      </div>
    `;
  }

  function metric(label, value, detail, status = "") {
    return `
      <section class="vk-panel third">
        <div class="vk-metric">
          <span class="vk-eyebrow">${esc(label)}</span>
          <strong>${esc(value)}</strong>
          <p>${esc(detail)}</p>
          ${status ? `<span class="vk-status ${esc(status)}">${esc(status)}</span>` : ""}
        </div>
      </section>
    `;
  }

  function renderDashboard() {
    const metrics = state.dashboard?.metrics || {};
    const queues = state.dashboard?.queues || {};
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Overview</span>
          <h2>Platform administration</h2>
          <p>Manage access, contributors, verification, content, commerce, integrations, and audit activity.</p>
        </section>
        ${metric("Users", metrics.users || 0, `${metrics.pendingUsers || 0} pending`)}
        ${metric("Contributors", metrics.contributors || 0, `${queues.identityReview || 0} need verification`, queues.identityReview ? "warn" : "good")}
        ${metric("Content", metrics.content || 0, `${queues.moderation || 0} in moderation`, queues.moderation ? "warn" : "good")}
        ${metric("Orders", metrics.orders || 0, `${metrics.licenses || 0} licenses`)}
        ${metric("AI Queue", queues.aiEnhancement || 0, "Images below quality standard", queues.aiEnhancement ? "warn" : "good")}
        ${metric("Gateways", queues.paymentCredentials || 0, "Enabled providers missing live secrets", queues.paymentCredentials ? "bad" : "good")}
        <section class="vk-panel">
          <span class="vk-eyebrow">Recent Contributors</span>
          <h3>Verification pipeline</h3>
          <div class="vk-list">${(state.dashboard?.contributorProfiles || []).map(profileCard).join("") || `<p>No contributors yet.</p>`}</div>
        </section>
        <section class="vk-panel">
          <span class="vk-eyebrow">Recent Content</span>
          <h3>Image queue</h3>
          <div class="vk-list">${(state.dashboard?.recentContent || []).map(assetCard).join("") || `<p>No content yet.</p>`}</div>
        </section>
      </div>
    `;
  }

  function renderAccess() {
    const access = state.access || {};
    const photoCategories = access.photoCategories || [];
    const contributorTypes = access.contributorTypes || [];
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Access Control</span>
          <h2>Admin roles, user categories, and contributor permissions.</h2>
          <p>Admin determines exactly which contributor category can post into each image category.</p>
          <button class="vk-button primary" data-action="save-access">Save Access Settings</button>
        </section>
        <section class="vk-panel full">
          <h3>Editable lists</h3>
          <div class="vk-form">
            <label>Photo categories<input id="vkPhotoCategories" value="${esc(photoCategories.join(", "))}"></label>
            <label>Contributor types<input id="vkContributorTypes" value="${esc(contributorTypes.join(", "))}"></label>
            <label>Enduser types<input id="vkEnduserTypes" value="${esc((access.enduserTypes || []).join(", "))}"></label>
          </div>
        </section>
        <section class="vk-panel">
          <h3>Admin roles JSON</h3>
          <div class="vk-form single"><label>Roles<textarea id="vkRolesJson">${esc(JSON.stringify(access.roles || [], null, 2))}</textarea></label></div>
        </section>
        <section class="vk-panel full">
          <h3>User categories JSON</h3>
          <div class="vk-form single"><label>Categories<textarea id="vkUserCategoriesJson">${esc(JSON.stringify(access.userCategories || [], null, 2))}</textarea></label></div>
        </section>
        <section class="vk-panel full">
          <h3>Contributor posting matrix</h3>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:${photoCategories.length + 1}"><span>Contributor</span>${photoCategories.map((category) => `<span>${esc(category)}</span>`).join("")}</div>
            ${contributorTypes.map((type) => `
              <div class="vk-row" data-matrix-type="${esc(type)}" style="--cols:${photoCategories.length + 1}">
                <strong>${esc(type)}</strong>
                ${photoCategories.map((category) => `<label><input type="checkbox" data-matrix-category="${esc(category)}" ${(access.contributorPermissions?.[type] || []).includes(category) ? "checked" : ""}> ${esc(category)}</label>`).join("")}
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderUsers() {
    const categories = (state.access?.userCategories || []).map((category) => category.name);
    const groups = ["Admin", "Contributor", "Enduser"];
    const statuses = ["Active", "Pending", "Suspended", "Blocked"];
    const verificationStatuses = ["Not Started", "OTP Verified", "Needs ID Review", "Procurement Review", "Verified", "Rejected"];
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">User Directory</span>
          <h2>Admins, contributors, and end users.</h2>
          <form class="vk-form" data-create-user>
            <label>Name<input name="name" required></label>
            <label>Phone<input name="phone"></label>
            <label>Email<input name="email"></label>
            <label>Group<select name="accountGroup">${optionList(groups, "Contributor")}</select></label>
            <label>Category<input name="category" value="Photographers"></label>
            <label>Country<input name="country" value="Nigeria"></label>
            <button class="vk-button primary" type="submit">Add User</button>
          </form>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:8"><span>Name</span><span>Group</span><span>Category</span><span>Country</span><span>Status</span><span>Verification</span><span>Email</span><span>Action</span></div>
            ${(state.users?.items || []).map((user) => `
              <div class="vk-row" data-user-row="${esc(user.id)}" style="--cols:8">
                <input data-field="name" value="${esc(user.name)}">
                <select data-field="accountGroup">${optionList(groups, user.accountGroup)}</select>
                <input data-field="category" value="${esc(user.category)}" list="vkCategoryList">
                <input data-field="country" value="${esc(user.country)}">
                <select data-field="status">${optionList(statuses, user.status)}</select>
                <select data-field="verificationStatus">${optionList(verificationStatuses, user.verificationStatus)}</select>
                <input data-field="email" value="${esc(user.email)}">
                <button class="vk-button" data-save-user="${esc(user.id)}">Save</button>
              </div>
            `).join("")}
          </div>
          <datalist id="vkCategoryList">${categories.map((category) => `<option value="${esc(category)}"></option>`).join("")}</datalist>
        </section>
      </div>
    `;
  }

  function renderContributors() {
    const countries = state.contributors?.allowedCountries || [];
    const accessLevels = state.config?.config?.contributorAccessLevels?.map((level) => level.name) || ["Starter", "Verified", "Professional"];
    const contributorTypes = state.access?.contributorTypes || ["Photo Content", "Models", "Photographers"];
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Contributor Verification</span>
          <h2>African contributor onboarding, face match, ID, and agreements.</h2>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:9"><span>Name</span><span>Type</span><span>Country</span><span>Access</span><span>Face</span><span>ID</span><span>Agreements</span><span>Sub</span><span>Action</span></div>
            ${(state.contributors?.items || []).map((profile) => `
              <div class="vk-row" data-contributor-row="${esc(profile.userId)}" style="--cols:9">
                <strong>${esc(profile.user?.name || profile.userId)}</strong>
                <select data-field="type">${optionList(contributorTypes, profile.type)}</select>
                <select data-field="country">${optionList(countries, profile.country)}</select>
                <select data-field="accessLevel">${optionList(accessLevels, profile.accessLevel)}</select>
                <input data-field="faceScanScore" type="number" min="0" max="100" value="${esc(profile.faceScanScore || 0)}">
                <select data-field="governmentId">${optionList(["false", "true"], String(Boolean(profile.governmentId)))}</select>
                <select data-field="agreementsSigned">${optionList(["false", "true"], String(Boolean(profile.agreementsSigned && profile.contentAgreementSigned && profile.copyrightAgreementSigned)))}</select>
                <select data-field="subscriptionActive">${optionList(["false", "true"], String(Boolean(profile.subscriptionActive)))}</select>
                <button class="vk-button" data-save-contributor="${esc(profile.userId)}">Save</button>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderContent() {
    const categories = state.access?.photoCategories || [];
    const contributorTypes = state.access?.contributorTypes || [];
    const statuses = ["Approved", "Admin Review", "Release Review", "AI Enhancement", "Face/Copyright Verification", "Country Review", "Rejected"];
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Content Operations</span>
          <h2>Moderate images, AI enhancement, and face/copyright approval.</h2>
          <form class="vk-form" data-create-asset>
            <label>Title<input name="title" required></label>
            <label>Category<select name="category">${optionList(categories, categories[0] || "Photo Content")}</select></label>
            <label>Contributor type<select name="contributorType">${optionList(contributorTypes, contributorTypes[0] || "Photo Content")}</select></label>
            <label>Country<input name="country" value="Nigeria"></label>
            <label>Quality<input name="quality" type="number" min="0" max="100" value="80"></label>
            <label>Contains faces<select name="faces">${optionList(["false", "true"], "false")}</select></label>
            <button class="vk-button primary" type="submit">Add Content</button>
          </form>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:8"><span>Title</span><span>Category</span><span>Country</span><span>Quality</span><span>Faces</span><span>Status</span><span>Note</span><span>Actions</span></div>
            ${(state.assets?.items || []).map((asset) => `
              <div class="vk-row" data-asset-row="${esc(asset.id)}" style="--cols:8">
                <input data-field="title" value="${esc(asset.title)}">
                <select data-field="category">${optionList(categories, asset.category)}</select>
                <input data-field="country" value="${esc(asset.country)}">
                <input data-field="quality" type="number" min="0" max="100" value="${esc(asset.quality)}">
                <select data-field="faces">${optionList(["false", "true"], String(Boolean(asset.faces)))}</select>
                <select data-field="status">${optionList(statuses, asset.status)}</select>
                <input data-field="moderationNote" value="${esc(asset.moderationNote || "")}">
                <span class="vk-action-group">
                  <button class="vk-button" data-save-asset="${esc(asset.id)}">Save</button>
                  <button class="vk-button" data-approve="${esc(asset.id)}">Approve</button>
                  <button class="vk-button" data-reject="${esc(asset.id)}">Reject</button>
                  <button class="vk-button" data-enhance="${esc(asset.id)}">Enhance</button>
                </span>
              </div>
            `).join("")}
          </div>
        </section>
        <section class="vk-panel"><h3>AI jobs</h3><div class="vk-list">${(state.assets?.aiJobs || []).slice(0, 8).map((job) => `<article><strong>${esc(job.status)}</strong><p>${esc(job.assetId)} / ${esc(job.qualityBefore)} to ${esc(job.qualityAfter || "queued")}</p></article>`).join("") || "<p>No AI jobs.</p>"}</div></section>
        <section class="vk-panel"><h3>Face approval cases</h3><div class="vk-list">${(state.assets?.faceApprovalCases || []).slice(0, 8).map((item) => `<article><strong>${esc(item.status)}</strong><p>${esc(item.assetId)}</p></article>`).join("") || "<p>No face cases.</p>"}</div></section>
      </div>
    `;
  }

  function renderCommerce() {
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Orders</span>
          <h3>Buyer checkout</h3>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:6"><span>Order</span><span>Plan</span><span>Provider</span><span>Amount</span><span>Status</span><span>Action</span></div>
            ${(state.commerce?.orders || []).map((order) => `
              <div class="vk-row" style="--cols:6">
                <strong>${esc(order.orderNumber)}</strong><span>${esc(order.plan)}</span><span>${esc(order.provider)}</span><span>${esc(order.currency)} ${esc(order.amount)}</span><span>${esc(order.paymentStatus)}</span>
                <button class="vk-button" data-pay-order="${esc(order.id)}">Authorize / Check Gateway</button>
              </div>
            `).join("") || `<p>No orders.</p>`}
          </div>
        </section>
        <section class="vk-panel full">
          <span class="vk-eyebrow">Licenses</span>
          <h3>Image rights</h3>
          <div class="vk-list">${(state.commerce?.licenses || []).map((license) => `<article><strong>${esc(license.plan)}</strong><p>${esc(license.status)} / downloads ${esc(license.downloadsRemaining)}</p></article>`).join("") || "<p>No licenses.</p>"}</div>
        </section>
      </div>
    `;
  }

  function renderIntegrations() {
    const config = state.integrations?.config || state.config?.config || {};
    const integrations = state.integrations?.integrations || {};
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">API Variables</span>
          <h2>Payment, payout, and SMS provider matrix.</h2>
          <p>Provider credentials remain environment secrets; admin manages provider names, key references, countries, and enabled status.</p>
          <button class="vk-button primary" data-action="save-integrations">Save Integrations</button>
        </section>
        <section class="vk-panel">
          <h3>Payment providers</h3>
          <div class="vk-form single"><label>Payment providers JSON<textarea id="vkPaymentProvidersJson">${esc(JSON.stringify(config.paymentProviders || integrations.paymentProviders || [], null, 2))}</textarea></label></div>
        </section>
        <section class="vk-panel">
          <h3>Country payout rails</h3>
          <div class="vk-form single"><label>Country gateways JSON<textarea id="vkGatewaysJson">${esc(JSON.stringify(config.gateways || integrations.countryGateways || [], null, 2))}</textarea></label></div>
        </section>
        <section class="vk-panel full">
          <h3>SMS providers</h3>
          <div class="vk-form single"><label>SMS providers JSON<textarea id="vkSmsProvidersJson">${esc(JSON.stringify(config.smsProviders || integrations.smsProviders || [], null, 2))}</textarea></label></div>
        </section>
        <section class="vk-panel full">
          <h3>Raw configurable platform variables</h3>
          <div class="vk-form"><label>Config JSON<textarea id="vkConfigJson">${esc(JSON.stringify(config, null, 2))}</textarea></label></div>
          <button class="vk-button primary" data-action="save-config">Save Config JSON</button>
        </section>
      </div>
    `;
  }

  function renderActivity() {
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Audit Trail</span>
          <h2>Platform activity and admin actions.</h2>
          <div class="vk-list">${(state.activity?.items || []).slice(0, 80).map((item) => `<article><strong>${esc(item.title || item.action)}</strong><p>${esc(item.createdAt || "")} / ${esc(item.actor || item.type || "system")}</p><p>${esc(JSON.stringify(item.details || {}))}</p></article>`).join("")}</div>
        </section>
      </div>
    `;
  }

  function profileCard(profile) {
    return `
      <article>
        <strong>${esc(profile.user?.name || profile.type || "Contributor")}</strong>
        <p>${esc(profile.type)} / ${esc(profile.country)} / ${esc(profile.accessLevel)}</p>
        <span class="vk-status ${profile.profileComplete ? "good" : "warn"}">${profile.profileComplete ? "Verified" : "Needs verification"}</span>
        <p>Face ${esc(profile.faceScanScore || 0)}% / ID ${profile.governmentId ? "on file" : "missing"} / Agreements ${profile.agreementsSigned ? "signed" : "pending"}</p>
      </article>
    `;
  }

  function assetCard(asset) {
    return `<article><strong>${esc(asset.title)}</strong><p>${esc(asset.category)} / ${esc(asset.country)} / quality ${esc(asset.quality)}%</p><span class="vk-status ${statusClass(asset.status)}">${esc(asset.status)}</span></article>`;
  }

  function providerCard(provider) {
    return `<article><strong>${esc(provider.name)}</strong><p>${esc(provider.purpose)} / ${esc(provider.apiKeyRef)}</p><span class="vk-status ${provider.credentialsLoaded ? "good" : "warn"}">${provider.credentialsLoaded ? "Secret loaded" : "Waiting for secret"}</span></article>`;
  }

  function statusClass(status) {
    const lower = String(status || "").toLowerCase();
    if (lower.includes("active") || lower.includes("approved") || lower.includes("verified") || lower.includes("public") || lower.includes("authorized")) return "good";
    if (lower.includes("blocked") || lower.includes("rejected") || lower.includes("missing")) return "bad";
    return "warn";
  }

  function rowData(selector, id) {
    const row = document.querySelector(`${selector}="${CSS.escape(id)}"]`);
    const data = {};
    row?.querySelectorAll("[data-field]").forEach((field) => {
      const key = field.dataset.field;
      if (field.type === "number") data[key] = Number(field.value || 0);
      else if (["true", "false"].includes(field.value)) data[key] = field.value === "true";
      else data[key] = field.value;
    });
    return data;
  }

  function formData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (["true", "false"].includes(value)) data[key] = value === "true";
      else if (key === "quality") data[key] = Number(value || 0);
      else data[key] = value;
    });
    return data;
  }

  async function login(event) {
    event.preventDefault();
    const identifier = document.getElementById("vkAdminIdentifier")?.value.trim();
    const accessKey = document.getElementById("vkAdminAccessKey")?.value;
    try {
      const response = await api("/api/v2/admin/login", {
        method: "POST",
        body: JSON.stringify({ identifier, accessKey })
      });
      saveSession({ token: response.session.token, expiresAt: response.session.expiresAt, user: response.user });
      toast(`Welcome, ${response.user.name}.`);
      await refresh();
    } catch (error) {
      renderLogin(error.message);
    }
  }

  async function approveAsset(id) {
    try {
      await api(`/api/v2/admin/assets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Approved", visibility: "Public", moderationNote: "Approved from VUEKUMI Command Center" })
      });
      toast("Asset approved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function rejectAsset(id) {
    try {
      await api(`/api/v2/admin/assets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Rejected", visibility: "Internal Review", moderationNote: "Rejected from admin review" })
      });
      toast("Asset rejected.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function enhanceAsset(id) {
    try {
      await api(`/api/v2/admin/assets/${encodeURIComponent(id)}/enhance`, { method: "POST" });
      toast("AI enhancement recorded.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveAsset(id) {
    try {
      await api(`/api/v2/admin/assets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(rowData('[data-asset-row', id))
      });
      toast("Asset saved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function createAsset(form) {
    try {
      await api("/api/v2/admin/assets", { method: "POST", body: JSON.stringify(formData(form)) });
      form.reset();
      toast("Content added.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveUser(id) {
    try {
      await api(`/api/v2/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(rowData('[data-user-row', id))
      });
      toast("User saved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function createUser(form) {
    try {
      await api("/api/v2/admin/users", { method: "POST", body: JSON.stringify(formData(form)) });
      form.reset();
      toast("User added.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveContributor(userId) {
    try {
      const data = rowData('[data-contributor-row', userId);
      if (data.agreementsSigned) {
        data.contentAgreementSigned = true;
        data.copyrightAgreementSigned = true;
      }
      data.faceScan = Number(data.faceScanScore || 0) > 0;
      await api(`/api/v2/admin/contributors/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      });
      toast("Contributor saved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveAccess() {
    try {
      const contributorPermissions = {};
      document.querySelectorAll("[data-matrix-type]").forEach((row) => {
        contributorPermissions[row.dataset.matrixType] = Array.from(row.querySelectorAll("[data-matrix-category]:checked")).map((input) => input.dataset.matrixCategory);
      });
      await api("/api/v2/admin/access", {
        method: "PUT",
        body: JSON.stringify({
          roles: JSON.parse(document.getElementById("vkRolesJson").value),
          userCategories: JSON.parse(document.getElementById("vkUserCategoriesJson").value),
          photoCategories: splitList(document.getElementById("vkPhotoCategories").value),
          contributorTypes: splitList(document.getElementById("vkContributorTypes").value),
          enduserTypes: splitList(document.getElementById("vkEnduserTypes").value),
          contributorPermissions
        })
      });
      toast("Access settings saved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveConfig() {
    try {
      const config = JSON.parse(document.getElementById("vkConfigJson").value);
      await api("/api/v2/admin/config", { method: "PUT", body: JSON.stringify({ config }) });
      toast("Platform config saved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveIntegrations() {
    try {
      await api("/api/v2/admin/integrations", {
        method: "PUT",
        body: JSON.stringify({
          paymentProviders: JSON.parse(document.getElementById("vkPaymentProvidersJson").value),
          gateways: JSON.parse(document.getElementById("vkGatewaysJson").value),
          smsProviders: JSON.parse(document.getElementById("vkSmsProvidersJson").value)
        })
      });
      toast("Integrations saved.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function payOrder(id) {
    try {
      await api(`/api/v2/orders/${encodeURIComponent(id)}/pay`, { method: "POST" });
      toast("Order payment status checked.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "refresh") await refresh();
    if (action === "logout") {
      saveSession(null);
      state = emptyState();
      toast("Signed out.");
      renderLogin();
    }
    if (action === "save-config") await saveConfig();
    if (action === "save-integrations") await saveIntegrations();
    if (action === "save-access") await saveAccess();
    const approve = event.target.closest("[data-approve]")?.dataset.approve;
    if (approve) await approveAsset(approve);
    const reject = event.target.closest("[data-reject]")?.dataset.reject;
    if (reject) await rejectAsset(reject);
    const enhance = event.target.closest("[data-enhance]")?.dataset.enhance;
    if (enhance) await enhanceAsset(enhance);
    const saveAssetId = event.target.closest("[data-save-asset]")?.dataset.saveAsset;
    if (saveAssetId) await saveAsset(saveAssetId);
    const saveUserId = event.target.closest("[data-save-user]")?.dataset.saveUser;
    if (saveUserId) await saveUser(saveUserId);
    const saveContributorId = event.target.closest("[data-save-contributor]")?.dataset.saveContributor;
    if (saveContributorId) await saveContributor(saveContributorId);
    const payOrderId = event.target.closest("[data-pay-order]")?.dataset.payOrder;
    if (payOrderId) await payOrder(payOrderId);
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("[data-login]")) login(event);
    if (event.target.matches("[data-create-user]")) {
      event.preventDefault();
      createUser(event.target);
    }
    if (event.target.matches("[data-create-asset]")) {
      event.preventDefault();
      createAsset(event.target);
    }
  });

  if (session) refresh().catch((error) => {
    toast(error.message);
    renderLogin(error.message);
  });
  else renderLogin();
})();
