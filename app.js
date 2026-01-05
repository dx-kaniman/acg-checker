// 描画・加減算・永続化（localStorage）・進捗計算をまとめて実装
(() => {
  const cards = window.ACG_REQUIRED_CARDS ?? [];
  const listEl = document.getElementById("cardList");
  const progressEl = document.getElementById("progressText");
  const resetBtn = document.getElementById("resetBtn");

  const storageKey = (() => {
    const scope = location.pathname.replace(/\/index\.html$/, "/");
    return `acg-checker::owned::${scope}`; // GitHub Pages 同一オリジン衝突を避ける
  })();

  function loadOwned() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveOwned(owned) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(owned));
    } catch (e) {
      console.warn("Failed to save:", e);
    }
  }

  let ownedMap = loadOwned();

  function clampOwned(n) {
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }

  function getOwned(cardId) {
    return clampOwned(ownedMap[cardId] ?? 0);
  }

  function setOwned(cardId, value) {
    ownedMap[cardId] = clampOwned(value);
    saveOwned(ownedMap);
  }

  function calcProgress() {
    const totalRequired = cards.reduce((acc, c) => acc + (c.required ?? 0), 0);
    const got = cards.reduce((acc, c) => {
      const owned = getOwned(c.id);
      const req = c.required ?? 0;
      return acc + Math.min(owned, req);
    }, 0);

    const pct = totalRequired === 0 ? 0 : (got / totalRequired) * 100;
    return { got, totalRequired, pct };
  }

  function renderProgress() {
    const { got, totalRequired, pct } = calcProgress();
    progressEl.textContent = `${got} / ${totalRequired} (${pct.toFixed(3)}%)`;
  }

  function renderList() {
    listEl.innerHTML = "";

    for (const c of cards) {
      const owned = getOwned(c.id);
      const done = owned >= c.required;

      const li = document.createElement("li");
      li.className = `item${done ? " is-done" : ""}`;

      const check = document.createElement("div");
      check.className = "check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";

      const info = document.createElement("div");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = c.name;

      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `必要数: ${c.required}`;

      info.appendChild(name);
      info.appendChild(meta);

      const controls = document.createElement("div");
      controls.className = "controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn-mini";
      minus.textContent = "−";
      minus.addEventListener("click", () => {
        setOwned(c.id, getOwned(c.id) - 1);
        render();
      });

      const count = document.createElement("div");
      count.className = "count";
      count.textContent = `${owned}`;

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn-mini";
      plus.textContent = "+";
      plus.addEventListener("click", () => {
        setOwned(c.id, getOwned(c.id) + 1);
        render();
      });

      controls.appendChild(minus);
      controls.appendChild(count);
      controls.appendChild(plus);

      li.appendChild(check);
      li.appendChild(info);
      li.appendChild(controls);

      listEl.appendChild(li);
    }
  }

  function render() {
    renderProgress();
    renderList();
  }

  resetBtn.addEventListener("click", () => {
    ownedMap = {};
    saveOwned(ownedMap);
    render();
  });

  render();
})();
