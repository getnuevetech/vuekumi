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
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Access Control</span>
          <h2>Admin roles, user categories, and contributor permissions.</h2>
          <p>Admin determines exactly which contributor category can post into each image category.</p>
        </section>
        <section class="vk-panel">
          <h3>Admin roles</h3>
          <div class="vk-list">${(access.roles || []).map((role) => `
            <article><strong>${esc(role.name)}</strong><p>${esc(role.description)}</p><span class="vk-status ${role.enabled ? "good" : "bad"}">${role.enabled ? "Enabled" : "Paused"}</span><p>${esc((role.permissions || []).join(", "))}</p></article>
          `).join("")}</div>
        </section>
        <section class="vk-panel">
          <h3>User categories</h3>
          <div class="vk-list">${(access.userCategories || []).map((category) => `
            <article><strong>${esc(category.group)} / ${esc(category.name)}</strong><p>${esc(category.description)}</p><p>${esc((category.allowedContentCategories || []).join(", ") || "No posting categories")}</p></article>
          `).join("")}</div>
        </section>
        <section class="vk-panel full">
          <h3>Contributor posting matrix</h3>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:3"><span>Contributor</span><span>Allowed image categories</span><span>Status</span></div>
            ${Object.entries(access.contributorPermissions || {}).map(([type, categories]) => `
              <div class="vk-row" style="--cols:3"><strong>${esc(type)}</strong><span>${esc(categories.join(", "))}</span><span class="vk-status good">Managed</span></div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderUsers() {
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">User Directory</span>
          <h2>Admins, contributors, and end users.</h2>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:6"><span>Name</span><span>Group</span><span>Category</span><span>Country</span><span>Status</span><span>Verification</span></div>
            ${(state.users?.items || []).map((user) => `
              <div class="vk-row" style="--cols:6"><strong>${esc(user.name)}</strong><span>${esc(user.accountGroup)}</span><span>${esc(user.category)}</span><span>${esc(user.country)}</span><span class="vk-status ${statusClass(user.status)}">${esc(user.status)}</span><span>${esc(user.verificationStatus)}</span></div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderContributors() {
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Contributor Verification</span>
          <h2>African contributor onboarding, face match, ID, and agreements.</h2>
        </section>
        ${(state.contributors?.items || []).map((profile) => `
          <section class="vk-panel third">
            ${profileCard(profile)}
            <p>Allowed: ${esc((profile.allowedCategories || []).join(", "))}</p>
          </section>
        `).join("")}
      </div>
    `;
  }

  function renderContent() {
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">Content Operations</span>
          <h2>Moderate images, AI enhancement, and face/copyright approval.</h2>
          <div class="vk-table">
            <div class="vk-row header" style="--cols:7"><span>Title</span><span>Category</span><span>Country</span><span>Quality</span><span>Faces</span><span>Status</span><span>Action</span></div>
            ${(state.assets?.items || []).map((asset) => `
              <div class="vk-row" style="--cols:7">
                <strong>${esc(asset.title)}</strong><span>${esc(asset.category)}</span><span>${esc(asset.country)}</span><span>${esc(asset.quality)}%</span><span>${asset.faces ? "Yes" : "No"}</span><span class="vk-status ${statusClass(asset.status)}">${esc(asset.status)}</span>
                <span><button class="vk-button" data-approve="${esc(asset.id)}">Approve</button></span>
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
        <section class="vk-panel">
          <span class="vk-eyebrow">Orders</span>
          <h3>Buyer checkout</h3>
          <div class="vk-list">${(state.commerce?.orders || []).map((order) => `<article><strong>${esc(order.orderNumber)}</strong><p>${esc(order.plan)} / ${esc(order.provider)} / ${esc(order.paymentStatus)}</p></article>`).join("") || "<p>No orders.</p>"}</div>
        </section>
        <section class="vk-panel">
          <span class="vk-eyebrow">Licenses</span>
          <h3>Image rights</h3>
          <div class="vk-list">${(state.commerce?.licenses || []).map((license) => `<article><strong>${esc(license.plan)}</strong><p>${esc(license.status)} / downloads ${esc(license.downloadsRemaining)}</p></article>`).join("") || "<p>No licenses.</p>"}</div>
        </section>
      </div>
    `;
  }

  function renderIntegrations() {
    const config = state.integrations?.config || state.config?.config || {};
    return `
      <div class="vk-grid">
        <section class="vk-panel full">
          <span class="vk-eyebrow">API Variables</span>
          <h2>Payment, payout, and SMS provider matrix.</h2>
          <p>Provider credentials remain environment secrets; admin manages provider names, key references, countries, and enabled status.</p>
        </section>
        <section class="vk-panel">
          <h3>Payment providers</h3>
          <div class="vk-list">${(state.integrations?.integrations?.paymentProviders || []).map(providerCard).join("")}</div>
        </section>
        <section class="vk-panel">
          <h3>Country payout rails</h3>
          <div class="vk-list">${(state.integrations?.integrations?.countryGateways || []).map((gateway) => `<article><strong>${esc(gateway.country)}</strong><p>${esc(gateway.subscription)} / ${esc(gateway.payout)} / ${esc(gateway.sms)}</p><span class="vk-status ${gateway.credentialsLoaded ? "good" : "warn"}">${gateway.credentialsLoaded ? "Secret loaded" : esc(gateway.keyRef || "Key ref missing")}</span></article>`).join("")}</div>
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
    const approve = event.target.closest("[data-approve]")?.dataset.approve;
    if (approve) await approveAsset(approve);
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("[data-login]")) login(event);
  });

  if (session) refresh().catch((error) => {
    toast(error.message);
    renderLogin(error.message);
  });
  else renderLogin();
})();
