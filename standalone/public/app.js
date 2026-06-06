(function () {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function load() {
    const response = await fetch("/api/public");
    const data = await response.json();
    document.title = data.frontpage.seo?.title || data.settings.platformName || "VUEKUMI";
    nav.innerHTML = (data.frontpage.nav || []).map((item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`).join("");
    render(data);
  }

  function render(data) {
    const sections = [...(data.frontpage.sections || [])].filter((section) => section.enabled).sort((a, b) => Number(a.order) - Number(b.order));
    app.innerHTML = sections.map((section) => renderSection(section, data)).join("") + renderFooter(data.frontpage.footer);
  }

  function renderSection(section, data) {
    if (section.type === "hero") return renderHero(section, data.assets);
    if (section.type === "categoryStrip") return renderCategories(section, data.categories.photos);
    if (section.type === "masonry") return renderMasonry(section, data.assets);
    if (section.type === "contributors") return renderContributors(section, data.assets);
    if (section.type === "plans") return renderPlans(section, data.plans);
    return "";
  }

  function renderHero(section, assets) {
    return `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">${esc(section.eyebrow)}</span>
          <h1>${esc(section.title)}</h1>
          <p>${esc(section.subtitle)}</p>
          <div class="hero-actions">
            <a class="button" href="#collections">${esc(section.ctaLabel || "Explore")}</a>
            <a class="button secondary" href="#contributors">${esc(section.secondaryCtaLabel || "Contribute")}</a>
          </div>
        </div>
        <div class="photo-grid">
          ${assets.slice(0, 8).map((asset, index) => photoCard(asset, index)).join("")}
        </div>
      </section>
    `;
  }

  function renderCategories(section, categories) {
    return `
      <section class="section" id="collections">
        <div class="section-header"><div><span class="eyebrow">Collections</span><h2>${esc(section.title)}</h2></div></div>
        <div class="chips">${(categories || []).map((category) => `<span class="chip">${esc(category)}</span>`).join("")}</div>
      </section>
    `;
  }

  function renderMasonry(section, assets) {
    const selected = section.assetIds?.length ? assets.filter((asset) => section.assetIds.includes(asset.id)) : assets;
    return `
      <section class="section">
        <div class="section-header"><div><span class="eyebrow">Images</span><h2>${esc(section.title)}</h2></div><span>${selected.length} approved assets</span></div>
        <div class="masonry">${selected.map((asset, index) => photoCard(asset, index)).join("")}</div>
      </section>
    `;
  }

  function renderContributors(section, assets) {
    const contributors = [...new Set(assets.map((asset) => asset.contributor))].slice(0, 6);
    return `
      <section class="section" id="contributors">
        <div class="section-header"><div><span class="eyebrow">Network</span><h2>${esc(section.title)}</h2></div></div>
        <div class="cards">${contributors.map((name) => `<article class="panel"><strong>${esc(name)}</strong><p>Verified VUEKUMI contributor.</p></article>`).join("")}</div>
      </section>
    `;
  }

  function renderPlans(section, plans) {
    return `
      <section class="section" id="plans">
        <div class="section-header"><div><span class="eyebrow">Licensing</span><h2>${esc(section.title)}</h2></div></div>
        <div class="cards">${plans.map((plan) => `<article class="panel"><strong>${esc(plan.type)}</strong><h3>${esc(plan.price)}</h3><p>${esc(plan.downloads)} downloads / ${esc(plan.seats)} seats</p><p>${esc(plan.license)}</p></article>`).join("")}</div>
      </section>
    `;
  }

  function photoCard(asset, index) {
    const cls = index % 5 === 0 ? "photo-card tall" : index % 4 === 0 ? "photo-card wide" : "photo-card";
    return `<article class="${cls}" style="--a:${esc(asset.colorA)};--b:${esc(asset.colorB)}"><span>${esc(asset.title)} / ${esc(asset.country)}</span></article>`;
  }

  function renderFooter(footer = {}) {
    return `<footer class="footer"><h2>${esc(footer.headline || "VUEKUMI")}</h2><p>${esc(footer.body || "")}</p></footer>`;
  }

  load().catch((error) => {
    app.innerHTML = `<section class="section"><p>${esc(error.message)}</p></section>`;
  });
})();
