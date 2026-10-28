// whats-new — a user-facing changelog. Reads whats-new.json (generated from git
// at deploy time by whats-new.sh), shows a small corner pill with a dot when this
// device hasn't seen the latest entry, and opens a panel listing recent changes.
// Standard affordance across projects — the user-facing sibling of the ?debug pill.
// Self-mounts on DOMContentLoaded. No backend, no deps beyond UI.el.
(function () {
  // EventPad has no shared UI lib; fall back to a minimal el() with the same contract
  const UI = window.UI || {
    el(tag, attrs = {}, children) {
      const node = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (k === "class") node.className = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
      }
      if (children !== undefined) {
        (Array.isArray(children) ? children : [children]).forEach((c) => {
          if (c == null) return;
          node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
        });
      }
      return node;
    },
  };
  const SRC = "whats-new.json";
  const SEEN_KEY = "whatsnew_seen_sha";

  async function load() {
    try {
      const r = await fetch(SRC, { cache: "no-cache" });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    } catch (_) { return []; }
  }

  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function mount(items) {
    if (!items.length) return;
    const newest = items[0].sha;
    // Hide-when-read: only surface the pill while there's an entry this device
    // hasn't opened. Once read it disappears until the next deploy adds a newer one.
    if (localStorage.getItem(SEEN_KEY) === newest) return;
    let panel = null;

    const dot = UI.el("span", { class: "wn-pill__dot", "aria-hidden": "true" });
    const pill = UI.el("button", { type: "button", class: "wn-pill", "aria-label": "What's new" }, [
      UI.el("span", { class: "wn-pill__spark", "aria-hidden": "true" }, "✨"),
      UI.el("span", { class: "wn-pill__label" }, "What's new"),
      dot,
    ]);

    function close() {
      if (!panel) return;
      panel.classList.remove("wn-panel--open");
      const p = panel; panel = null;
      setTimeout(() => p.remove(), 180);
      document.removeEventListener("keydown", onEsc);
    }
    function onEsc(e) { if (e.key === "Escape") close(); }

    function open() {
      if (panel) { close(); return; }
      // Reading marks seen and retires the pill until the next deploy adds an entry.
      localStorage.setItem(SEEN_KEY, newest);
      pill.remove();

      const scrim = UI.el("div", { class: "wn-panel__scrim", onclick: close });
      panel = UI.el("div", { class: "wn-panel" }, [
        scrim,
        UI.el("div", { class: "wn-panel__sheet" }, [
          UI.el("div", { class: "wn-panel__head" }, [
            UI.el("span", { class: "wn-panel__title serif" }, "What's new"),
            UI.el("button", { type: "button", class: "wn-panel__x", "aria-label": "Close", onclick: close }, "✕"),
          ]),
          UI.el("div", { class: "wn-panel__list" }, items.map((it) =>
            UI.el("div", { class: "wn-item" }, [
              UI.el("div", { class: "wn-item__date mono" }, fmtDate(it.date)),
              UI.el("div", { class: "wn-item__title" }, it.title),
            ]))),
        ]),
      ]);
      document.body.appendChild(panel);
      requestAnimationFrame(() => panel.classList.add("wn-panel--open"));
      document.addEventListener("keydown", onEsc);
    }

    pill.addEventListener("click", open);
    document.body.appendChild(pill);
  }

  document.addEventListener("DOMContentLoaded", async () => mount(await load()));
})();
