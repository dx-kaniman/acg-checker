// 描画・加減算・永続化（localStorage）・進捗計算をまとめて実装
(() => {
  const cards = window.ACG_REQUIRED_CARDS ?? [];
  const listEl = document.getElementById("cardList");
  const progressEl = document.getElementById("progressText");
  const progressValueEl = document.getElementById("progressValue");
  const resetBtn = document.getElementById("resetBtn");
  const statusFilterEl = document.getElementById("statusFilter");
  const highlightOverEl = document.getElementById("highlightOver");
  const optionsBtn = document.getElementById("optionsBtn");
  const optionsMenu = document.getElementById("optionsMenu");

  const storageKey = (() => {
    const scope = location.pathname.replace(/\/index\.html$/, "/");
    return `acg-checker::owned::${scope}`; // GitHub Pages 同一オリジン衝突を避ける
  })();
  const settingsKey = (() => {
    const scope = location.pathname.replace(/\/index\.html$/, "/");
    return `acg-checker::settings::${scope}`;
  })();

  /**
   * 所持数の保存データを読み込む
   */
  function loadOwned() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * 所持数の保存データを書き込む
   */
  function saveOwned(owned) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(owned));
    } catch (e) {
      console.warn("Failed to save:", e);
    }
  }

  /**
   * 表示設定の保存データを読み込む
   */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(settingsKey);
      const saved = raw ? JSON.parse(raw) : {};
      return {
        statusFilter: saved.statusFilter ?? "all",
        highlightOver: !!saved.highlightOver,
      };
    } catch {
      return { statusFilter: "all", highlightOver: false };
    }
  }

  /**
   * 表示設定の保存データを書き込む
   */
  function saveSettings(settings) {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save settings:", e);
    }
  }

  /**
   * 画面に保存済みの表示設定を反映する
   */
  function applySettings(settings) {
    if (statusFilterEl) statusFilterEl.value = settings.statusFilter ?? "all";
    if (highlightOverEl) highlightOverEl.checked = !!settings.highlightOver;
  }

  /**
   * 現在の画面状態から表示設定を取得する
   */
  function collectSettings() {
    return {
      statusFilter: statusFilterEl?.value ?? "all",
      highlightOver: !!highlightOverEl?.checked,
    };
  }

  let ownedMap = loadOwned();

  /**
   * 所持数を0以上の整数に正規化する
   */
  function clampOwned(n) {
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }

  /**
   * 指定カードの所持数を取得する
   */
  function getOwned(cardId) {
    return clampOwned(ownedMap[cardId] ?? 0);
  }

  /**
   * 指定カードの所持数を保存する
   */
  function setOwned(cardId, value) {
    ownedMap[cardId] = clampOwned(value);
    saveOwned(ownedMap);
  }

  /**
   * 達成率計算に必要な合計値を返す
   */
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

  /**
   * 進捗表示のテキストを更新する
   */
  function renderProgress() {
    const { got, totalRequired, pct } = calcProgress();
    const text = `${got} / ${totalRequired} (${pct.toFixed(3)}%)`;
    if (progressValueEl) {
      progressValueEl.textContent = text;
      updateCompletionState(got, totalRequired);
      return;
    }
    progressEl.textContent = `達成率：${text}`;
    updateCompletionState(got, totalRequired);
  }

  /**
   * 表示条件に合わせてカード一覧を描画する
   */
  function renderList() {
    listEl.innerHTML = "";
    let renderedCount = 0;

    for (const c of cards) {
      const owned = getOwned(c.id);
      const done = owned >= c.required;
      const over = owned > c.required;

      // 表示フィルターに応じてリストを絞り込む
      const filterValue = statusFilterEl?.value ?? "all";
      if (filterValue === "undone" && done) continue;
      if (filterValue === "over" && !over) continue;

      const li = document.createElement("li");
      li.className = `item${done ? " is-done" : ""}`;

      const check = document.createElement("div");
      check.className = "check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";

      const info = document.createElement("div");
      info.className = "info";
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

      const highlightOver = !!highlightOverEl?.checked;
      const count = document.createElement("div");
      count.className = "count";
      if (over && highlightOver) count.classList.add("is-over");
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
      renderedCount += 1;
    }

    if (renderedCount === 0) {
      const empty = document.createElement("li");
      empty.className = "list-empty";
      empty.textContent = "一致するデータがありません。";
      listEl.appendChild(empty);
    }
  }

  /**
   * オプションメニューの開閉状態を反映する
   */
  function setOptionsOpen(isOpen) {
    if (!optionsBtn || !optionsMenu) return;
    optionsMenu.hidden = !isOpen;
    optionsBtn.setAttribute("aria-expanded", String(isOpen));
  }

  /**
   * 進捗と一覧の表示を更新する
   */
  function render() {
    renderProgress();
    renderList();
  }

  /**
   * 達成率100%の状態に応じて表示を切り替える
   */
  function updateCompletionState(got, totalRequired) {
    const isComplete = totalRequired > 0 && got >= totalRequired;
    if (isComplete) {
      progressEl?.classList.add("is-complete");
      return;
    }
    progressEl?.classList.remove("is-complete");
  }

  /**
   * オプションボタン押下時に開閉を切り替える
   */
  function handleOptionsClick(event) {
    event.stopPropagation();
    const isOpen = optionsMenu ? !optionsMenu.hidden : false;
    setOptionsOpen(!isOpen);
  }

  /**
   * メニュー外クリック時にオプションを閉じる
   */
  function handleDocumentClick(event) {
    if (!optionsMenu || !optionsBtn || optionsMenu.hidden) return;
    const target = event.target;
    if (target instanceof Node && (optionsMenu.contains(target) || optionsBtn.contains(target))) return;
    setOptionsOpen(false);
  }

  /**
   * Escapeキー押下時にオプションを閉じる
   */
  function handleDocumentKeydown(event) {
    if (event.key !== "Escape") return;
    if (optionsMenu?.hidden ?? true) return;
    setOptionsOpen(false);
    optionsBtn?.focus();
  }

  /**
   * リセット確認後に所持枚数を初期化する
   */
  function handleResetClick() {
    setOptionsOpen(false);
    const ok = window.confirm("所持枚数をすべてリセットします。よろしいですか？");
    if (!ok) return;

    ownedMap = {};
    saveOwned(ownedMap);
    render();
  }

  optionsBtn?.addEventListener("click", handleOptionsClick);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  // 初期表示は保存済みの表示設定を反映してから描画する
  applySettings(loadSettings());

  // リセット時に confirm で確認し、OK のときだけ所持枚数をクリアする
  resetBtn.addEventListener("click", handleResetClick);

  // 表示フィルターの変更時は再描画
  statusFilterEl?.addEventListener("change", () => {
    saveSettings(collectSettings());
    render();
  });
  // 超過を強調表示チェックの変更時は再描画
  highlightOverEl?.addEventListener("change", () => {
    saveSettings(collectSettings());
    render();
  });

  render();
})();
