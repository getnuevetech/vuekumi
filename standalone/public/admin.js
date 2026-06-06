(function () {
  const app = document.getElementById("adminApp");
  const toastNode = document.getElementById("toast");
  const tabs = ["dashboard", "frontpage", "users", "contributors", "assets", "settings", "audit"];
  let activeTab = localStorage.getItem("vuekumiStandaloneAdminTab") || "dashboard";
  let session = loadSession();
  let state = null;
  let toastTimer = null;

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
      const saved = JSON.parse(localStorage.getItem("vuekumiStandaloneAdmin") || "null");
      if (!saved?.token || Date.now() > Number(saved.expiresAt)) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function saveSession(next) {
    session = next;
    if (next) localStorage.setItem("vuekumiStandaloneAdmin", JSON.stringify(next));
    else localStorage.removeItem("vuekumiStandaloneAdmin");
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
      renderLogin(payload.error || "Admin login required");
      throw new Error(payload.error || "Admin login required");
    }
    if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
    return payload;
  }

  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2500);
  }

  async function refresh() {
    if (!session) return renderLogin();
    state = await api("/api/admin/state");
    render();
  }

  function renderTabs() {
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === activeTab);
    });
  }

  function renderLogin(message = "") {
    renderTabs();
    app.innerHTML = `
      <section class="panel">
        <h1>VUEKUMI Admin</h1>
        <p>Sign in with your admin identifier and access key.</p>
        <form class="form" data-login>
          <label>Email / identifier<input id="identifier" autocomplete="username" value="admin@vuekumi.local" required></label>
          <label>Access key<input id="accessKey" type="password" autocomplete="current-password" required></label>
          ${message ? `<p>${esc(message)}</p>` : ""}
          <button type="submit">Sign in</button>
        </form>
      </section>
    `;
  }

  function render() {
    if (!session) return renderLogin();
    renderTabs();
    if (activeTab === "dashboard") app.innerHTML = renderDashboard();
    if (activeTab === "frontpage") app.innerHTML = renderFrontpage();
    if (activeTab === "users") app.innerHTML = renderUsers();
    if (activeTab === "contributors") app.innerHTML = renderContributors();
    if (activeTab === "assets") app.innerHTML = renderAssets();
    if (activeTab === "settings") app.innerHTML = renderSettings();
    if (activeTab === "audit") app.innerHTML = renderAudit();
  }

  function metric(label, value) {
    return `<section class="panel third metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></section>`;
  }

  function renderDashboard() {
    return `
      <div class="grid">
        ${metric("Users", state.metrics.users)}
        ${metric("Contributors", state.metrics.contributors)}
        ${metric("Assets", state.metrics.assets)}
        ${metric("Pending assets", state.metrics.pendingAssets)}
        ${metric("Orders", state.metrics.orders)}
        ${metric("Licenses", state.metrics.licenses)}
        <section class="panel full"><h2>Operations</h2><p>Use the tabs to manage the public frontpage, users, contributors, assets, integrations, plans, and audit logs.</p></section>
      </div>
    `;
  }

  function renderFrontpage() {
    return `
      <div class="grid">
        <section class="panel full">
          <h2>Frontpage management</h2>
          <p>All public page sections are controlled here.</p>
          <div class="form single"><label>Frontpage JSON<textarea id="frontpageJson">${esc(JSON.stringify(state.frontpage, null, 2))}</textarea></label></div>
          <button data-action="save-frontpage">Save frontpage</button>
        </section>
      </div>
    `;
  }

  function renderUsers() {
    return `
      <div class="grid">
        <section class="panel full">
          <h2>User management</h2>
          <form class="form" data-save-user>
            <input name="name" placeholder="Name" required>
            <input name="email" placeholder="Email">
            <input name="phone" placeholder="Phone">
            <select name="group"><option>Admin</option><option selected>Contributor</option><option>Buyer</option></select>
            <input name="category" value="Photographers">
            <input name="country" value="Nigeria">
            <select name="status"><option>Active</option><option selected>Pending</option><option>Suspended</option><option>Blocked</option></select>
            <button type="submit">Add user</button>
          </form>
          <div class="table">
            <div class="row header" style="--cols:7"><span>Name</span><span>Email</span><span>Group</span><span>Category</span><span>Country</span><span>Status</span><span>Save</span></div>
            ${state.users.map((user) => userRow(user)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function userRow(user) {
    return `
      <div class="row" data-user="${esc(user.id)}" style="--cols:7">
        <input data-field="name" value="${esc(user.name)}">
        <input data-field="email" value="${esc(user.email)}">
        <select data-field="group">${options(["Admin", "Contributor", "Buyer"], user.group)}</select>
        <input data-field="category" value="${esc(user.category)}">
        <input data-field="country" value="${esc(user.country)}">
        <select data-field="status">${options(["Active", "Pending", "Suspended", "Blocked"], user.status)}</select>
        <button data-save-user="${esc(user.id)}">Save</button>
      </div>
    `;
  }

  function renderContributors() {
    return `
      <div class="grid">
        <section class="panel full">
          <h2>Contributor management</h2>
          <div class="table">
            <div class="row header" style="--cols:8"><span>User</span><span>Type</span><span>Country</span><span>Access</span><span>Face</span><span>ID</span><span>Agreements</span><span>Save</span></div>
            ${state.contributors.map((profile) => `
              <div class="row" data-contributor="${esc(profile.id)}" style="--cols:8">
                <strong>${esc(profile.user?.name || profile.userId)}</strong>
                <select data-field="type">${options(state.categories.contributors, profile.type)}</select>
                <input data-field="country" value="${esc(profile.country)}">
                <select data-field="accessLevel">${options(["Starter", "Verified", "Professional"], profile.accessLevel)}</select>
                <input data-field="faceScore" type="number" value="${esc(profile.faceScore)}">
                <select data-field="governmentId">${options(["false", "true"], String(Boolean(profile.governmentId)))}</select>
                <select data-field="agreements">${options(["false", "true"], String(Boolean(profile.agreements)))}</select>
                <button data-save-contributor="${esc(profile.id)}">Save</button>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderAssets() {
    return `
      <div class="grid">
        <section class="panel full">
          <h2>Asset management</h2>
          <form class="form" data-save-asset>
            <input name="title" placeholder="Title" required>
            <select name="category">${options(state.categories.photos, state.categories.photos[0])}</select>
            <input name="country" value="Nigeria">
            <input name="contributor" value="Admin upload">
            <input name="quality" type="number" value="80">
            <select name="status"><option selected>Admin Review</option><option>Approved</option><option>Rejected</option></select>
            <button type="submit">Add asset</button>
          </form>
          <div class="table">
            <div class="row header" style="--cols:8"><span>Title</span><span>Category</span><span>Country</span><span>Quality</span><span>Status</span><span>Visibility</span><span>Color A</span><span>Save</span></div>
            ${state.assets.map((asset) => `
              <div class="row" data-asset="${esc(asset.id)}" style="--cols:8">
                <input data-field="title" value="${esc(asset.title)}">
                <select data-field="category">${options(state.categories.photos, asset.category)}</select>
                <input data-field="country" value="${esc(asset.country)}">
                <input data-field="quality" type="number" value="${esc(asset.quality)}">
                <select data-field="status">${options(["Admin Review", "AI Enhancement", "Face/Copyright Verification", "Approved", "Rejected"], asset.status)}</select>
                <select data-field="visibility">${options(["Public", "Internal Review", "Private"], asset.visibility)}</select>
                <input data-field="colorA" value="${esc(asset.colorA)}">
                <button data-save-asset="${esc(asset.id)}">Save</button>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderSettings() {
    return `
      <div class="grid">
        <section class="panel full">
          <h2>Settings and integrations</h2>
          <div class="form single">
            <label>Settings JSON<textarea id="settingsJson">${esc(JSON.stringify({ settings: state.settings, categories: state.categories, plans: state.plans }, null, 2))}</textarea></label>
          </div>
          <button data-action="save-settings">Save settings</button>
        </section>
        <section class="panel full">
          <h2>Roles</h2>
          <form class="form" data-save-role><input name="name" placeholder="Role name"><input name="permissions" placeholder="permissions comma list"><button type="submit">Add role</button></form>
          <div class="table">${state.roles.map((role) => `<div class="row" style="--cols:3"><strong>${esc(role.name)}</strong><span>${esc(role.permissions.join(", "))}</span><span>${role.enabled ? "Enabled" : "Disabled"}</span></div>`).join("")}</div>
        </section>
      </div>
    `;
  }

  function renderAudit() {
    return `<section class="panel full"><h2>Audit logs</h2><div class="table">${state.audit.map((item) => `<div class="row" style="--cols:4"><strong>${esc(item.action)}</strong><span>${esc(item.actor)}</span><span>${esc(item.createdAt)}</span><span>${esc(JSON.stringify(item.details || {}))}</span></div>`).join("")}</div></section>`;
  }

  function options(items, value) {
    return (items || []).map((item) => `<option value="${esc(item)}" ${item === value ? "selected" : ""}>${esc(item)}</option>`).join("");
  }

  function collectRow(selector, id) {
    const row = document.querySelector(`${selector}="${CSS.escape(id)}"]`);
    const payload = { id };
    row.querySelectorAll("[data-field]").forEach((field) => {
      if (field.type === "number") payload[field.dataset.field] = Number(field.value);
      else if (["true", "false"].includes(field.value)) payload[field.dataset.field] = field.value === "true";
      else payload[field.dataset.field] = field.value;
    });
    return payload;
  }

  function formPayload(form) {
    const payload = {};
    new FormData(form).forEach((value, key) => {
      if (key === "quality" || key === "faceScore") payload[key] = Number(value || 0);
      else payload[key] = value;
    });
    return payload;
  }

  async function save(path, payload, message) {
    await api(path, { method: "POST", body: JSON.stringify(payload) });
    toast(message);
    await refresh();
  }

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-tab]")?.dataset.tab;
    if (tab) {
      activeTab = tab;
      localStorage.setItem("vuekumiStandaloneAdminTab", tab);
      render();
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "refresh") await refresh();
    if (action === "logout") {
      saveSession(null);
      renderLogin();
    }
    if (action === "save-frontpage") {
      await api("/api/admin/frontpage", { method: "PUT", body: JSON.stringify({ frontpage: JSON.parse(document.getElementById("frontpageJson").value) }) });
      toast("Frontpage saved");
      await refresh();
    }
    if (action === "save-settings") {
      const payload = JSON.parse(document.getElementById("settingsJson").value);
      await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
      toast("Settings saved");
      await refresh();
    }
    const userId = event.target.closest("[data-save-user]")?.dataset.saveUser;
    if (userId) await save("/api/admin/users", collectRow("[data-user", userId), "User saved");
    const contributorId = event.target.closest("[data-save-contributor]")?.dataset.saveContributor;
    if (contributorId) await save("/api/admin/contributors", collectRow("[data-contributor", contributorId), "Contributor saved");
    const assetId = event.target.closest("[data-save-asset]")?.dataset.saveAsset;
    if (assetId) await save("/api/admin/assets", collectRow("[data-asset", assetId), "Asset saved");
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.matches("[data-login]")) {
      event.preventDefault();
      const response = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ identifier: document.getElementById("identifier").value, accessKey: document.getElementById("accessKey").value }) });
      saveSession(response);
      await refresh();
    }
    if (event.target.matches("[data-save-user]")) {
      event.preventDefault();
      await save("/api/admin/users", formPayload(event.target), "User added");
      event.target.reset();
    }
    if (event.target.matches("[data-save-asset]")) {
      event.preventDefault();
      await save("/api/admin/assets", formPayload(event.target), "Asset added");
      event.target.reset();
    }
    if (event.target.matches("[data-save-role]")) {
      event.preventDefault();
      const payload = formPayload(event.target);
      payload.permissions = String(payload.permissions || "").split(",").map((item) => item.trim()).filter(Boolean);
      payload.enabled = true;
      await save("/api/admin/roles", payload, "Role added");
      event.target.reset();
    }
  });

  if (session) refresh().catch((error) => {
    toast(error.message);
    renderLogin(error.message);
  });
  else renderLogin();
})();
