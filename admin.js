(function () {
  const app = document.getElementById("adminApp");
  const title = document.getElementById("adminTitle");
  const kicker = document.getElementById("adminKicker");
  const toastNode = document.getElementById("adminToast");

  const sections = {
    overview: ["Admin Backend", "Platform Overview"],
    access: ["Access Management", "Admin Access And User Categories"],
    users: ["User Management", "All Platform Users"],
    content: ["Content Management", "Images And Approval Queue"],
    activity: ["Platform Activity", "Audit And Operations"]
  };

  const statuses = ["Active", "Pending", "Suspended", "Blocked"];
  const verificationStatuses = ["Not Started", "OTP Verified", "Needs ID Review", "Procurement Review", "Verified", "Rejected"];
  const contentStatuses = ["Approved", "Admin Review", "Release Review", "AI Enhancement", "Face/Copyright Verification", "Country Review", "Rejected"];
  const visibilityOptions = ["Public", "Private", "Internal Review"];

  let activeSection = localStorage.getItem("vuekumiAdminSection") || "access";
  let state = {
    overview: null,
    access: null,
    users: [],
    content: [],
    activity: []
  };
  let adminSession = loadAdminSession();
  let toastTimer = null;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function listValue(value) {
    if (Array.isArray(value)) return value.join(", ");
    return String(value || "");
  }

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2600);
  }

  function loadAdminSession() {
    try {
      const saved = JSON.parse(localStorage.getItem("vuekumiAdminSession") || "null");
      if (!saved?.token || !saved.expiresAt || Date.now() > Number(saved.expiresAt)) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function saveAdminSession(session) {
    adminSession = session;
    if (session) localStorage.setItem("vuekumiAdminSession", JSON.stringify(session));
    else localStorage.removeItem("vuekumiAdminSession");
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(adminSession?.token ? { Authorization: `Bearer ${adminSession.token}` } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      saveAdminSession(null);
      renderLogin(payload.error || "Admin access required");
      throw new Error(payload.error || "Admin access required");
    }
    if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
    return payload;
  }

  async function loadAll() {
    try {
      const [overview, access, users, content, activity] = await Promise.all([
        api("/api/admin/overview"),
        api("/api/admin/access"),
        api("/api/admin/users"),
        api("/api/admin/content"),
        api("/api/admin/activity")
      ]);
      state = { overview, access, users, content, activity };
    } catch (error) {
      if (!adminSession) return;
      app.innerHTML = `<div class="empty-state">Admin backend API is not available. Start the backend with <strong>npm start</strong>, then open <strong>/admin.html</strong>. ${esc(error.message)}</div>`;
      throw error;
    }
  }

  async function refresh() {
    if (!adminSession) {
      renderLogin();
      return;
    }
    await loadAll();
    render();
  }

  function renderLogin(message = "") {
    document.body.classList.add("admin-locked");
    kicker.textContent = "Controlled Access";
    title.textContent = "Admin Login";
    renderNav();
    app.innerHTML = `
      <section class="login-screen">
        <div class="login-hero">
          <span class="eyebrow">VUEKUMI Backend</span>
          <h2>Controlled Admin Access</h2>
          <p>Administrative pages are protected by backend-issued sessions. Sign in with an active admin identifier and access key before managing users, content, categories, or platform activity.</p>
          <div class="security-points">
            <span>Token protected APIs</span>
            <span>Role-based permissions</span>
            <span>Audited admin sessions</span>
          </div>
        </div>
        <form class="login-card" data-admin-login>
          <label>
            <span>Admin email, phone, or name</span>
            <input id="adminIdentifier" autocomplete="username" placeholder="admin@vuekumi.com" required>
          </label>
          <label>
            <span>Admin access key</span>
            <input id="adminAccessKey" type="password" autocomplete="current-password" placeholder="Enter access key" required>
          </label>
          ${message ? `<p class="login-error">${esc(message)}</p>` : ""}
          <button type="submit">Enter Admin Backend</button>
        </form>
      </section>
    `;
  }

  function setSection(section) {
    activeSection = sections[section] ? section : "access";
    localStorage.setItem("vuekumiAdminSection", activeSection);
    render();
  }

  function renderNav() {
    document.querySelectorAll("[data-section]").forEach((button) => {
      button.classList.toggle("active", button.dataset.section === activeSection);
    });
  }

  function render() {
    if (!adminSession) {
      renderLogin();
      return;
    }
    document.body.classList.remove("admin-locked");
    renderNav();
    const [nextKicker, nextTitle] = sections[activeSection] || sections.access;
    kicker.textContent = nextKicker;
    title.textContent = nextTitle;

    if (activeSection === "overview") app.innerHTML = renderOverview();
    if (activeSection === "access") app.innerHTML = renderAccess();
    if (activeSection === "users") app.innerHTML = renderUsers();
    if (activeSection === "content") app.innerHTML = renderContent();
    if (activeSection === "activity") app.innerHTML = renderActivity();
  }

  function statusClass(value) {
    const lower = String(value || "").toLowerCase();
    if (lower.includes("active") || lower.includes("verified") || lower.includes("approved") || lower.includes("public")) return "good";
    if (lower.includes("blocked") || lower.includes("suspended") || lower.includes("rejected")) return "bad";
    return "";
  }

  function optionList(options, value) {
    return options.map((option) => `<option value="${esc(option)}" ${option === value ? "selected" : ""}>${esc(option)}</option>`).join("");
  }

  function renderOverview() {
    const metrics = state.overview?.metrics || {};
    return `
      <div class="grid">
        ${metricPanel("Users", metrics.users || 0, `${metrics.pendingUsers || 0} pending`)}
        ${metricPanel("Contributors", metrics.contributors || 0, "African contributors")}
        ${metricPanel("Content", metrics.content || 0, `${metrics.pendingContent || 0} pending review`)}
        ${metricPanel("Categories", metrics.userCategories || 0, `${metrics.adminRoles || 0} admin roles`)}

        <section class="panel full">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Operational Control</span>
              <h2>Admin Backend Scope</h2>
              <p>This backend manages users, user categories, content, access rules, and platform activity without changing the public website template.</p>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><div><span class="eyebrow">Users</span><h3>Recent Users</h3></div></div>
          <div class="activity-list">
            ${(state.overview?.recentUsers || []).map((user) => `
              <div class="activity-item">
                <strong>${esc(user.name)} - ${esc(user.category)}</strong>
                <span>${esc(user.accountGroup)} / ${esc(user.status)} / ${esc(user.verificationStatus)}</span>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><div><span class="eyebrow">Content</span><h3>Recent Content</h3></div></div>
          <div class="activity-list">
            ${(state.overview?.recentContent || []).map((item) => `
              <div class="activity-item">
                <strong>${esc(item.title)}</strong>
                <span>${esc(item.category)} / ${esc(item.country)} / ${esc(item.status)}</span>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function metricPanel(label, value, caption) {
    return `
      <section class="panel small">
        <div class="metric">
          <span>${esc(label)}</span>
          <strong>${esc(value)}</strong>
          <span>${esc(caption)}</span>
        </div>
      </section>
    `;
  }

  function renderAccess() {
    const access = state.access || {};
    const contentCategories = access.contentCategories || [];
    const permissions = access.permissions || [];
    const contributorTypes = (access.userCategories || []).filter((item) => item.group === "Contributor").map((item) => item.name);
    return `
      <div class="grid">
        <section class="panel full">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Access Page</span>
              <h2>Admin Portal Access Management</h2>
              <p>Manage who can use the admin backend, which user categories exist on the platform, and which contributor categories can post into each content category.</p>
            </div>
            <div class="panel-actions">
              <button type="button" data-action="add-role">Add Role</button>
              <button type="button" data-action="add-category">Add Category</button>
              <button type="button" data-action="save-access">Save Access</button>
            </div>
          </div>
          <label class="eyebrow" for="contentCategories">Content Categories</label>
          <input id="contentCategories" value="${esc(listValue(contentCategories))}">
        </section>

        <section class="panel full">
          <div class="panel-header"><div><span class="eyebrow">Admin Roles</span><h3>Backend Access Roles</h3></div></div>
          <div class="table" data-access-roles>
            <div class="table-row header access-role"><span>Role</span><span>Description</span><span>Permissions</span><span>Status</span></div>
            ${(access.adminAccess || []).map((role) => `
              <div class="table-row access-role" data-role-id="${esc(role.id)}">
                <input data-role-field="name" value="${esc(role.name)}">
                <input data-role-field="description" value="${esc(role.description)}">
                <div class="panel-actions">
                  ${permissions.map((permission) => `
                    <label class="check"><input type="checkbox" data-permission="${esc(permission)}" ${role.permissions?.includes(permission) ? "checked" : ""}> ${esc(permission)}</label>
                  `).join("")}
                </div>
                <select data-role-field="enabled">
                  <option value="true" ${role.enabled ? "selected" : ""}>Enabled</option>
                  <option value="false" ${!role.enabled ? "selected" : ""}>Paused</option>
                </select>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="panel full">
          <div class="panel-header"><div><span class="eyebrow">User Categories</span><h3>Platform User Categories</h3></div></div>
          <div class="table" data-user-categories>
            <div class="table-row header access-category"><span>Group</span><span>Name</span><span>Description</span><span>Allowed Content</span><span>Status</span></div>
            ${(access.userCategories || []).map((category) => `
              <div class="table-row access-category" data-category-id="${esc(category.id)}">
                <select data-category-field="group">${optionList(["Admin", "Contributor", "Enduser"], category.group)}</select>
                <input data-category-field="name" value="${esc(category.name)}">
                <input data-category-field="description" value="${esc(category.description)}">
                <input data-category-field="allowedContentCategories" value="${esc(listValue(category.allowedContentCategories))}">
                <select data-category-field="enabled">
                  <option value="true" ${category.enabled ? "selected" : ""}>Enabled</option>
                  <option value="false" ${!category.enabled ? "selected" : ""}>Paused</option>
                </select>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="panel full">
          <div class="panel-header"><div><span class="eyebrow">Contributor Posting</span><h3>Category Permissions</h3></div></div>
          <div class="table" data-permission-matrix>
            <div class="table-row header permission"><span>Contributor</span>${contentCategories.map((category) => `<span>${esc(category)}</span>`).join("")}</div>
            ${contributorTypes.map((type) => `
              <div class="table-row permission" data-contributor-type="${esc(type)}">
                <strong>${esc(type)}</strong>
                ${contentCategories.map((category) => `
                  <label class="check"><input type="checkbox" data-content-category="${esc(category)}" ${(access.contributorPermissions?.[type] || []).includes(category) ? "checked" : ""}> ${esc(category)}</label>
                `).join("")}
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderUsers() {
    const categories = state.access?.userCategories || [];
    return `
      <div class="grid">
        <section class="panel full">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Users</span>
              <h2>Manage All Users</h2>
              <p>Manage admin users, African contributor accounts, and buyer accounts from one backend area.</p>
            </div>
            <div class="panel-actions">
              <button type="button" data-action="add-user">Add User</button>
            </div>
          </div>
          <div class="table">
            <div class="table-row header"><span>Name</span><span>Group</span><span>Category</span><span>Status</span><span>Verification</span><span></span></div>
            ${state.users.map((user) => userRow(user, categories)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function userRow(user, categories) {
    return `
      <div class="table-row" data-user-id="${esc(user.id)}">
        <div>
          <input data-user-field="name" value="${esc(user.name)}">
          <input data-user-field="email" value="${esc(user.email)}" placeholder="Email" style="margin-top:6px">
          <input data-user-field="phone" value="${esc(user.phone)}" placeholder="Phone" style="margin-top:6px">
        </div>
        <select data-user-field="accountGroup">${optionList(["Admin", "Contributor", "Enduser"], user.accountGroup)}</select>
        <select data-user-field="category">${optionList(categories.map((item) => item.name), user.category)}</select>
        <select data-user-field="status">${optionList(statuses, user.status)}</select>
        <div>
          <select data-user-field="verificationStatus">${optionList(verificationStatuses, user.verificationStatus)}</select>
          <input data-user-field="country" value="${esc(user.country)}" placeholder="Country" style="margin-top:6px">
          <input data-user-field="allowedContentCategories" value="${esc(listValue(user.allowedContentCategories))}" placeholder="Allowed categories" style="margin-top:6px">
        </div>
        <div class="row-actions"><button type="button" data-action="save-user">Save</button></div>
      </div>
    `;
  }

  function renderContent() {
    const categories = state.access?.contentCategories || [];
    const contributorTypes = (state.access?.userCategories || []).filter((item) => item.group === "Contributor").map((item) => item.name);
    return `
      <div class="grid">
        <section class="panel full">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Content</span>
              <h2>Manage Website Content</h2>
              <p>Admin can approve, reject, feature, categorize, and control visibility for content across the platform.</p>
            </div>
            <div class="panel-actions">
              <button type="button" data-action="add-content">Add Content</button>
            </div>
          </div>
          <div class="table">
            <div class="table-row header content"><span>Image</span><span>Title</span><span>Category</span><span>Contributor</span><span>Quality</span><span>Status</span><span></span></div>
            ${state.content.map((item) => contentRow(item, categories, contributorTypes)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function contentRow(item, categories, contributorTypes) {
    return `
      <div class="table-row content" data-content-id="${esc(item.id)}">
        <img class="thumb" src="${esc(item.src || "images/africa-content-2.jpg")}" alt="">
        <div>
          <input data-content-field="title" value="${esc(item.title)}">
          <input data-content-field="country" value="${esc(item.country)}" placeholder="Country" style="margin-top:6px">
          <input data-content-field="moderationNote" value="${esc(item.moderationNote || "")}" placeholder="Moderation note" style="margin-top:6px">
        </div>
        <select data-content-field="category">${optionList(categories, item.category)}</select>
        <select data-content-field="contributorType">${optionList(contributorTypes, item.contributorType)}</select>
        <input data-content-field="quality" type="number" min="0" max="100" value="${esc(item.quality)}">
        <div>
          <select data-content-field="status">${optionList(contentStatuses, item.status)}</select>
          <select data-content-field="visibility" style="margin-top:6px">${optionList(visibilityOptions, item.visibility || "Public")}</select>
          <label class="check" style="margin-top:8px"><input type="checkbox" data-content-field="featured" ${item.featured ? "checked" : ""}> Featured</label>
        </div>
        <div class="row-actions"><button type="button" data-action="save-content">Save</button></div>
      </div>
    `;
  }

  function renderActivity() {
    return `
      <div class="grid">
        <section class="panel full">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Activity</span>
              <h2>Platform Activity</h2>
              <p>Audit trail for user management, access changes, content moderation, and platform operations.</p>
            </div>
          </div>
          <div class="activity-list">
            ${state.activity.map((item) => `
              <div class="activity-item">
                <strong>${esc(item.title || item.action || item.type)}</strong>
                <span>${esc(item.details ? JSON.stringify(item.details) : item.details || "")}</span>
                <span>${esc(item.createdAt || "")}</span>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function collectAccess() {
    const adminAccess = Array.from(document.querySelectorAll("[data-role-id]")).map((row) => ({
      id: row.dataset.roleId,
      name: row.querySelector('[data-role-field="name"]').value.trim(),
      description: row.querySelector('[data-role-field="description"]').value.trim(),
      permissions: Array.from(row.querySelectorAll("[data-permission]:checked")).map((input) => input.dataset.permission),
      enabled: row.querySelector('[data-role-field="enabled"]').value === "true"
    }));

    const userCategories = Array.from(document.querySelectorAll("[data-category-id]")).map((row) => ({
      id: row.dataset.categoryId,
      group: row.querySelector('[data-category-field="group"]').value,
      name: row.querySelector('[data-category-field="name"]').value.trim(),
      description: row.querySelector('[data-category-field="description"]').value.trim(),
      allowedContentCategories: splitList(row.querySelector('[data-category-field="allowedContentCategories"]').value),
      enabled: row.querySelector('[data-category-field="enabled"]').value === "true"
    }));

    const contributorPermissions = {};
    Array.from(document.querySelectorAll("[data-contributor-type]")).forEach((row) => {
      contributorPermissions[row.dataset.contributorType] = Array.from(row.querySelectorAll("[data-content-category]:checked")).map((input) => input.dataset.contentCategory);
    });

    return {
      adminAccess,
      userCategories,
      contentCategories: splitList(document.getElementById("contentCategories").value),
      contributorPermissions
    };
  }

  async function saveAccess() {
    state.access = await api("/api/admin/access", {
      method: "PUT",
      body: JSON.stringify(collectAccess())
    });
    toast("Admin access settings saved.");
    await refresh();
  }

  async function loginAdmin() {
    const identifier = document.getElementById("adminIdentifier")?.value.trim();
    const accessKey = document.getElementById("adminAccessKey")?.value;
    if (!identifier || !accessKey) {
      renderLogin("Enter an admin identifier and access key.");
      return;
    }
    const response = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ identifier, accessKey })
    });
    saveAdminSession({
      token: response.token,
      expiresAt: response.expiresAt,
      user: response.user
    });
    toast(`Welcome, ${response.user.name}.`);
    await refresh();
  }

  function logoutAdmin() {
    saveAdminSession(null);
    toast("Signed out of admin backend.");
    renderLogin();
  }

  function addRole() {
    state.access.adminAccess.push({
      id: `role-${Date.now()}`,
      name: "New Admin Role",
      description: "Describe this admin role.",
      permissions: ["overview"],
      enabled: true
    });
    render();
  }

  function addCategory() {
    state.access.userCategories.push({
      id: `category-${Date.now()}`,
      group: "Contributor",
      name: "New Category",
      description: "Describe this user category.",
      allowedContentCategories: [],
      enabled: true
    });
    render();
  }

  function collectUser(row) {
    const data = { id: row.dataset.userId };
    row.querySelectorAll("[data-user-field]").forEach((input) => {
      data[input.dataset.userField] = input.dataset.userField === "allowedContentCategories" ? splitList(input.value) : input.value;
    });
    return data;
  }

  async function saveUser(row) {
    const data = collectUser(row);
    const created = data.id.startsWith("new-");
    const user = await api(created ? "/api/admin/users" : `/api/admin/users/${encodeURIComponent(data.id)}`, {
      method: created ? "POST" : "PATCH",
      body: JSON.stringify(data)
    });
    toast(`${user.name} saved.`);
    await refresh();
  }

  function addUser() {
    state.users.unshift({
      id: `new-${Date.now()}`,
      name: "New User",
      phone: "",
      email: "",
      accountGroup: "Contributor",
      category: "Photo Content",
      country: "Nigeria",
      status: "Pending",
      verificationStatus: "Not Started",
      allowedContentCategories: []
    });
    render();
  }

  function collectContent(row) {
    const data = { id: row.dataset.contentId };
    row.querySelectorAll("[data-content-field]").forEach((input) => {
      if (input.type === "checkbox") data[input.dataset.contentField] = input.checked;
      else if (input.type === "number") data[input.dataset.contentField] = Number(input.value);
      else data[input.dataset.contentField] = input.value;
    });
    return data;
  }

  async function saveContent(row) {
    const data = collectContent(row);
    const created = data.id.startsWith("new-");
    const item = await api(created ? "/api/admin/content" : `/api/admin/content/${encodeURIComponent(data.id)}`, {
      method: created ? "POST" : "PATCH",
      body: JSON.stringify(data)
    });
    toast(`${item.title} saved.`);
    await refresh();
  }

  function addContent() {
    state.content.unshift({
      id: `new-${Date.now()}`,
      title: "New VUEKUMI Content",
      category: state.access?.contentCategories?.[0] || "Photo Content",
      contributorType: "Photo Content",
      country: "Nigeria",
      quality: 80,
      status: "Admin Review",
      visibility: "Public",
      featured: false,
      src: "images/africa-content-2.jpg"
    });
    render();
  }

  function bindEvents() {
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-admin-login]");
      if (!form) return;
      event.preventDefault();
      try {
        await loginAdmin();
      } catch (error) {
        renderLogin(error.message);
      }
    });

    document.addEventListener("click", async (event) => {
      const nav = event.target.closest("[data-section]");
      if (nav) return setSection(nav.dataset.section);

      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;

      try {
        if (action === "refresh") await refresh();
        if (action === "logout") logoutAdmin();
        if (action === "save-access") await saveAccess();
        if (action === "add-role") addRole();
        if (action === "add-category") addCategory();
        if (action === "add-user") addUser();
        if (action === "save-user") await saveUser(event.target.closest("[data-user-id]"));
        if (action === "add-content") addContent();
        if (action === "save-content") await saveContent(event.target.closest("[data-content-id]"));
      } catch (error) {
        toast(error.message);
      }
    });
  }

  async function boot() {
    bindEvents();
    await refresh();
  }

  boot();
})();
