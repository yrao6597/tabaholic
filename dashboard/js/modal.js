// modal.js — Detail modal object; depends on charts.js + renderers.js

const detailModal = {
  overlay:       document.getElementById("detail-modal"),
  titleEl:       document.getElementById("detail-modal-title"),
  tabsEl:        document.getElementById("detail-modal-tabs"),
  contentEl:     document.getElementById("detail-modal-content"),
  tabs:          [],
  activeTab:     0,
  chartInstance: null,

  open({ title, tabs }) {
    this.tabs      = tabs;
    this.activeTab = 0;
    this.titleEl.textContent = title;
    this.overlay.style.display = "flex";
    this.renderTabs();
    this.renderContent();
  },

  close() {
    this._destroyChart();
    this.overlay.style.display = "none";
  },

  _destroyChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  },

  renderTabs() {
    this.tabsEl.innerHTML = this.tabs.map((t, i) => `
      <button class="detail-tab ${i === this.activeTab ? "active" : ""}" data-index="${i}">
        ${t.label}
      </button>
    `).join("");

    this.tabsEl.querySelectorAll(".detail-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeTab = parseInt(btn.dataset.index);
        this.tabsEl.querySelectorAll(".detail-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderContent();
      });
    });
  },

  renderContent() {
    this._destroyChart();
    this.contentEl.innerHTML = this.tabs[this.activeTab].render();
    const afterRender = this.tabs[this.activeTab].afterRender;
    if (afterRender) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.chartInstance = afterRender(this.contentEl);
      }));
    }
  },
};
