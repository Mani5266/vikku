/* Site behaviour: theme toggle, search over the built index, TOC scrollspy,
   mobile nav. No dependencies, no build step of its own. */
(function () {
  "use strict";

  /* ── theme ──────────────────────────────────────────────────────── */
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem("lci-theme"); } catch (e) {}
  if (stored === "dark" || stored === "light") root.setAttribute("data-theme", stored);

  function currentTheme() {
    var set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  var toggle = document.querySelector("[data-theme-toggle]");
  function label() { if (toggle) toggle.textContent = currentTheme() === "dark" ? "Light" : "Dark"; }
  label();
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("lci-theme", next); } catch (e) {}
      label();
    });
  }

  /* ── mobile nav ─────────────────────────────────────────────────── */
  var rail = document.querySelector(".rail");
  var menu = document.querySelector("[data-menu]");
  if (menu && rail) {
    menu.addEventListener("click", function () {
      var open = rail.classList.toggle("open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
      menu.textContent = open ? "Close" : "Menu";
    });
  }

  /* ── TOC scrollspy ──────────────────────────────────────────────── */
  var tocLinks = [].slice.call(document.querySelectorAll(".toc a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var targets = Object.keys(byId)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var active = null;
      targets.forEach(function (t) { if (!active && visible[t.id]) active = t.id; });
      if (!active) return;
      tocLinks.forEach(function (a) { a.classList.remove("on"); });
      if (byId[active]) byId[active].classList.add("on");
    }, { rootMargin: "0px 0px -72% 0px", threshold: 0 });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ── search ─────────────────────────────────────────────────────── */
  var input = document.querySelector("[data-search]");
  var out = document.querySelector("[data-results]");
  if (!input || !out) return;

  var index = window.__SEARCH_INDEX__ || null;
  var loading = false;

  function load() {
    if (index || loading) return Promise.resolve(index);
    loading = true;
    return fetch(input.getAttribute("data-search") || "search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (json) { index = json; return index; })
      .catch(function () { index = []; return index; });
  }
  input.addEventListener("focus", load, { once: true });

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function highlight(text, terms) {
    var safe = escapeHtml(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      safe = safe.replace(
        new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"),
        "<mark>$1</mark>"
      );
    });
    return safe;
  }

  /* Score: title hits beat body hits; all terms must appear somewhere. */
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !index) return [];
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      var title = e.t.toLowerCase();
      var body = e.b.toLowerCase();
      var score = 0, all = true;
      for (var j = 0; j < terms.length; j++) {
        var term = terms[j];
        var inTitle = title.indexOf(term) !== -1;
        var inBody = body.indexOf(term) !== -1;
        if (!inTitle && !inBody) { all = false; break; }
        if (inTitle) score += title.indexOf(term) === 0 ? 12 : 8;
        if (inBody) score += 2;
      }
      if (!all) continue;
      hits.push({ e: e, score: score });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 12).map(function (h) { return h.e; });
  }

  function snippet(body, terms) {
    var low = body.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length && at === -1; i++) at = low.indexOf(terms[i]);
    if (at === -1) at = 0;
    var start = Math.max(0, at - 45);
    var text = body.slice(start, start + 155).trim();
    return (start > 0 ? "… " : "") + text + (start + 155 < body.length ? " …" : "");
  }

  var cursor = -1;
  function render(items, terms) {
    cursor = -1;
    if (!items.length) {
      out.innerHTML = '<div class="none">No match.</div>';
      return;
    }
    out.innerHTML = items
      .map(function (e) {
        return (
          '<a href="' + e.u + '">' +
          "<em>" + escapeHtml(e.p) + "</em>" +
          "<b>" + highlight(e.t, terms) + "</b>" +
          "<span>" + highlight(snippet(e.b, terms), terms) + "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  var timer = null;
  input.addEventListener("input", function () {
    var q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 2) { out.innerHTML = ""; return; }
    timer = setTimeout(function () {
      load().then(function () {
        render(search(q), q.toLowerCase().split(/\s+/).filter(Boolean));
      });
    }, 90);
  });

  input.addEventListener("keydown", function (ev) {
    var links = [].slice.call(out.querySelectorAll("a"));
    if (ev.key === "Escape") { input.value = ""; out.innerHTML = ""; input.blur(); return; }
    if (!links.length) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      cursor += ev.key === "ArrowDown" ? 1 : -1;
      if (cursor < 0) cursor = links.length - 1;
      if (cursor >= links.length) cursor = 0;
      links.forEach(function (a) { a.classList.remove("on"); });
      links[cursor].classList.add("on");
      links[cursor].scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      (links[cursor] || links[0]).click();
    }
  });

  document.addEventListener("click", function (ev) {
    if (!out.contains(ev.target) && ev.target !== input) out.innerHTML = "";
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "/" && document.activeElement !== input && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      ev.preventDefault();
      input.focus();
    }
  });
})();
