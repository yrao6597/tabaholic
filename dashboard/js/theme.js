// theme.js — Theme toggle; depends on renderers.js (renderHourlyChart)

function initTheme() {
  const btn = document.getElementById("btn-theme");

  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
    btn.textContent = "🌙 Dark";
  }

  btn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light");
    btn.textContent = isLight ? "🌙 Dark" : "☀ Light";
    localStorage.setItem("theme", isLight ? "light" : "dark");
    renderHourlyChart(cachedVisits);
  });
}
