// theme.js — Theme toggle; depends on renderers.js (renderHourlyChart, renderStats)

function initTheme() {
  const btnLight = document.getElementById("btn-theme-light");
  const btnDark  = document.getElementById("btn-theme-dark");
  const btnZen   = document.getElementById("btn-theme-zen");
  const allBtns  = [btnLight, btnDark, btnZen];

  function activate(theme) {
    document.body.classList.remove("light", "zen");
    allBtns.forEach(b => b.classList.remove("active"));
    if (theme === "light") {
      document.body.classList.add("light");
      btnLight.classList.add("active");
    } else if (theme === "zen") {
      document.body.classList.add("zen");
      btnZen.classList.add("active");
    } else {
      btnDark.classList.add("active");
    }
  }

  // Restore saved theme on load (no rerender — data not loaded yet)
  activate(localStorage.getItem("theme") || "dark");

  btnLight.addEventListener("click", () => {
    activate("light");
    localStorage.setItem("theme", "light");
    renderHourlyChart(cachedVisits);
    renderStats(cachedVisits);
  });

  btnDark.addEventListener("click", () => {
    activate("dark");
    localStorage.setItem("theme", "dark");
    renderHourlyChart(cachedVisits);
    renderStats(cachedVisits);
  });

  btnZen.addEventListener("click", () => {
    activate("zen");
    localStorage.setItem("theme", "zen");
    renderHourlyChart(cachedVisits);
    renderStats(cachedVisits);
  });
}
