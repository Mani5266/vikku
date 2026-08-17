/* Static site generator for the Enterprise Lead Conversion CRM specification.
 *
 *   node site/build.mjs            build dist/
 *   node site/build.mjs --serve    build, then serve dist/ on :4173
 *
 * Every page in dist/ is generated from the Markdown in docs/, screens/ and
 * reference/ — the Markdown stays the source of truth. The build also emits
 * dist/search-index.json (site search) and dist/all.html (the whole
 * specification as one self-contained page, for sharing as a single file).
 */
import { readFile, writeFile, mkdir, rm, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DIST = path.join(ROOT, "dist");

const SITE_TITLE = "Lead Conversion Intelligence";
const REPO = "github.com/charann29/enterprise-lead-conversion-crm";

/* ── page manifest ─────────────────────────────────────────────────────
   `src` is relative to the repo root; `out` is the built filename. Order here
   is the order of the sidebar, the pager and the single-file bundle. */
const PAGES = [
  {
    out: "index.html", group: "Overview", nav: "Overview", home: true,
    title: SITE_TITLE, eyebrow: "Enterprise CRM · Product specification",
  },
  {
    src: "docs/THESIS.md", out: "thesis.html", group: "Overview", nav: "Thesis",
    title: "The thesis", eyebrow: "Source of truth · 35 sections",
    blurb: "The complete argument: what the CRM must answer, how every lead is tracked, and how conversion failure is diagnosed rather than guessed at.",
  },
  {
    src: "docs/AI-LAYER.md", out: "ai-layer.html", group: "Overview", nav: "AI layer",
    title: "AI layer", eyebrow: "Design · Soniox + OpenAI",
    blurb: "Transcription and analysis over recorded calls, with the guardrails that keep model output out of the record until an agent confirms it.",
  },
  {
    src: "screens/README.md", out: "screens.html", group: "Screens", nav: "Index & coverage",
    title: "Screen index", eyebrow: "35 screens · five roles",
    blurb: "All 35 screens with the thesis sections each one implements, plus the coverage matrix that proves no section is left unscreened.",
  },
  {
    src: "screens/01-agent-screens.md", out: "screens-agent.html", group: "Screens", nav: "Agent & telecaller",
    title: "Agent & telecaller screens", eyebrow: "A1–A9 · nine screens",
    blurb: "Where the operating philosophy is enforced: no call closes without a remark, no lead closes without a reason.",
  },
  {
    src: "screens/02-manager-screens.md", out: "screens-manager.html", group: "Screens", nav: "Manager",
    title: "Manager screens", eyebrow: "M1–M9 · nine screens",
    blurb: "Daily monitoring, follow-up compliance, assignment and agent performance measured against process, not opinion.",
  },
  {
    src: "screens/03-leadership-screens.md", out: "screens-leadership.html", group: "Screens", nav: "Leadership & analytics",
    title: "Leadership & analytics screens", eyebrow: "L1–L7 · seven screens",
    blurb: "Founder view, campaign ROI, cohort comparison and the drill-down that turns a fallen number into a named corrective action.",
  },
  {
    src: "screens/04-operations-screens.md", out: "screens-operations.html", group: "Screens", nav: "Clinical & operations",
    title: "Clinical & operations screens", eyebrow: "O1–O4 · four screens",
    blurb: "Appointments and no-shows, financial counseling, admission management and the recovery of expired leads.",
  },
  {
    src: "screens/05-admin-screens.md", out: "screens-admin.html", group: "Screens", nav: "Administration",
    title: "Administration screens", eyebrow: "S1–S6 · six screens",
    blurb: "Intake configuration, assignment rules, template approval, status taxonomy, the audit log and role permissions.",
  },
  {
    src: "screens/06-existing-app-mapping.md", out: "screens-mapping.html", group: "Screens", nav: "Status vs the app",
    title: "Status against the existing app", eyebrow: "Built · partial · to build",
    blurb: "Each of the 35 screens measured against the client-approved Base44 application, and what the six genuine gaps cost.",
  },
  {
    src: "reference/guardrails.md", out: "reference-guardrails.html", group: "Reference", nav: "Guardrails",
    title: "Guardrails", eyebrow: "Reference · enforced rules",
    blurb: "The ten operating principles restated as system rules, with the screen that enforces each and what happens on violation.",
  },
  {
    src: "reference/lifecycle-and-plans.md", out: "reference-lifecycle.html", group: "Reference", nav: "Lifecycle & plans",
    title: "Lifecycle & follow-up plans", eyebrow: "Reference · stages and cadence",
    blurb: "The 20 lifecycle stages and the hot, warm, cold and not-connected follow-up plans, day by day.",
  },
  {
    src: "reference/reason-codes.md", out: "reference-reason-codes.html", group: "Reference", nav: "Reason codes",
    title: "Reason codes", eyebrow: "Reference · fixed taxonomy",
    blurb: "The closed list of non-conversion reasons. Agents select; they never invent.",
  },
  {
    src: "reference/corrective-actions.md", out: "reference-corrective-actions.html", group: "Reference", nav: "Corrective actions",
    title: "Corrective actions", eyebrow: "Reference · reason to action",
    blurb: "Each reason mapped to the action it demands, the owner, and the metric that proves the action worked.",
  },
  {
    src: "reference/metrics.md", out: "reference-metrics.html", group: "Reference", nav: "Metrics",
    title: "Metric definitions", eyebrow: "Reference · funnel and comms",
    blurb: "Every funnel, communication and agent metric with its exact formula, so two dashboards cannot disagree.",
  },
  {
    src: "reference/base44-data-model.md", out: "reference-base44-data-model.html", group: "Reference", nav: "Base44 data model",
    title: "Base44 data model", eyebrow: "Reference · entities and gaps",
    blurb: "The entities and fields the app actually has, the five that are missing, and the order they should be built in.",
  },
  {
    src: "implementation/README.md", out: "implementation.html", group: "Implementation", nav: "Drop-in code",
    title: "Implementation", eyebrow: "Build steps 1–2 · drop-in code",
    blurb: "The Communication and Template entities, the 48-hour guard and the seven-part remark form, written against the real conventions of the client's app.",
  },
];

/* Markdown source path → built page. Used to rewrite cross-document links. */
const LINK_MAP = new Map(PAGES.filter((p) => p.src).map((p) => [p.src, p.out]));
LINK_MAP.set("README.md", "index.html");

/* ── helpers ───────────────────────────────────────────────────────── */
const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* GitHub-compatible heading slugs, so anchors already written in the Markdown
   (../docs/THESIS.md#8-revised-...) keep resolving. */
function slugify(text, seen) {
  let slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\-_ ]/gu, "")
    .trim()
    .replace(/ /g, "-");
  if (!slug) slug = "section";
  if (seen) {
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
  }
  return slug;
}

/* Rewrite a Markdown link so it points at the built page.
   bundle=true collapses everything to in-page anchors for dist/all.html. */
function rewriteHref(href, fromDir, bundle) {
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) {
    if (href.startsWith("#") && bundle) return `#${bundle}--${href.slice(1)}`;
    return href;
  }
  const [rawPath, hash] = href.split("#");
  const resolved = path.posix.normalize(path.posix.join(fromDir, rawPath));
  const target = LINK_MAP.get(resolved);
  if (target) {
    const page = target.replace(/\.html$/, "");
    if (bundle) return `#${page === "index" ? "home" : page}${hash ? `--${hash}` : ""}`;
    return hash ? `${target}#${hash}` : target;
  }
  if (resolved.startsWith("source/")) return resolved; // the PDF, copied into dist/
  return href;
}

/* ── Markdown → HTML ───────────────────────────────────────────────── */
function renderMarkdown(md, { fromDir, idPrefix = "", bundle = false }) {
  const seen = new Map();
  const headings = [];
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    renderer: {
      heading(token) {
        const inline = this.parser.parseInline(token.tokens);
        const plain = stripTags(inline);
        const slug = slugify(plain, seen);
        const id = idPrefix ? `${idPrefix}--${slug}` : slug;
        // h1 of a document becomes the page title, rendered by the shell.
        const depth = token.depth;
        if (depth >= 2 && depth <= 3) headings.push({ id, text: plain, depth });
        return `<h${depth} id="${id}">${inline}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
      },
      link(token) {
        const href = rewriteHref(token.href, fromDir, bundle ? idPrefix : false);
        const text = this.parser.parseInline(token.tokens);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${escapeHtml(href)}"${title}${ext}>${text}</a>`;
      },
    },
  });

  let html = marked.parse(md);
  // Drop the document's own h1 — the page head supplies it.
  html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");
  // Tables scroll inside their own container instead of widening the page.
  html = html.replace(/<table>/g, '<div class="tbl-scroll"><table>').replace(/<\/table>/g, "</table></div>");
  return { html, headings };
}

/* ── search index ──────────────────────────────────────────────────── */
/* One entry per h2/h3 section: heading text, the prose under it, and the URL. */
function indexPage(page, html, headings) {
  const entries = [];
  const plain = stripTags(html.split(/<h2\b/)[0]);
  if (plain) entries.push({ t: page.title, b: plain.slice(0, 600), u: page.out, p: page.group });

  const parts = html.split(/(?=<h[23]\b)/);
  for (const part of parts) {
    const m = part.match(/^<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/);
    if (!m) continue;
    const title = stripTags(m[3]).replace(/#$/, "").trim();
    const body = stripTags(part.slice(m[0].length)).slice(0, 600);
    if (!title) continue;
    entries.push({ t: title, b: body, u: `${page.out}#${m[2]}`, p: page.title });
  }
  return entries;
}

/* ── page shell ────────────────────────────────────────────────────── */
function rail(current) {
  const groups = [];
  for (const p of PAGES) {
    let g = groups.find((x) => x.name === p.group);
    if (!g) groups.push((g = { name: p.group, items: [] }));
    g.items.push(p);
  }
  const nav = groups
    .map(
      (g) =>
        `<div class="rail-group"><b>${g.name}</b>` +
        g.items
          .map(
            (p) =>
              `<a href="${p.out}"${p.out === current ? ' aria-current="page"' : ""}>${p.nav}</a>`
          )
          .join("") +
        "</div>"
    )
    .join("\n    ");

  return `<aside class="rail">
    <div class="rail-mark">
      <a href="index.html">Lead Conversion<br>Intelligence</a>
      Specification · v1
    </div>
    <div class="search">
      <label class="skip" for="q">Search the specification</label>
      <input id="q" type="search" placeholder="Search  /" autocomplete="off" spellcheck="false" data-search="search-index.json">
      <div class="results" data-results role="listbox" aria-label="Search results"></div>
    </div>
    <div class="menu"><button class="tgl" data-menu aria-expanded="false">Menu</button></div>
    ${nav}
    <div class="rail-foot">
      <button class="tgl" data-theme-toggle>Dark</button>
      <span>v1 · Aug 2026</span>
    </div>
  </aside>`;
}

function tocHtml(headings) {
  if (headings.length < 3) return "";
  return `<aside class="toc"><b>On this page</b>${headings
    .map((h) => `<a class="lvl${h.depth}" href="#${h.id}">${escapeHtml(h.text)}</a>`)
    .join("")}</aside>`;
}

function pagerHtml(i) {
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  if (!prev && !next) return "";
  return `<nav class="pager">${
    prev ? `<a class="prev" href="${prev.out}"><span>Previous</span>${prev.nav}</a>` : ""
  }${next ? `<a class="next" href="${next.out}"><span>Next</span>${next.nav}</a>` : ""}</nav>`;
}

function shell({ page, body, headings, index }) {
  const toc = tocHtml(headings ?? []);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(page.title)}${page.home ? "" : ` · ${SITE_TITLE}`}</title>
<meta name="description" content="${escapeHtml(page.blurb ?? "A data-driven system for lead management, follow-up, conversion diagnosis and revenue improvement.")}">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="theme.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%231B3A6B'/%3E%3Cpath d='M8 22V10h3v9h6v3H8z' fill='%23fff'/%3E%3C/svg%3E">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="shell${toc ? " has-toc" : ""}">
${rail(page.out)}
<main id="main">
${body}
${pagerHtml(index)}
<footer>
  <span><code>${REPO}</code> — private</span>
  <span>Specification only · no application code</span>
</footer>
</main>
${toc}
</div>
<script src="app.js"></script>
</body>
</html>
`;
}

/* ── screen-card link resolution for the home page ─────────────────── */
async function screenAnchorMap() {
  const map = new Map();
  for (const page of PAGES) {
    if (!page.src?.startsWith("screens/") || page.src.endsWith("README.md")) continue;
    const md = await readFile(path.join(ROOT, page.src), "utf8");
    const seen = new Map();
    for (const line of md.split("\n")) {
      const m = line.match(/^##\s+([A-Z]{1,2}\d{1,2})\.\s+(.+?)\s*$/);
      if (!m) continue;
      const slug = slugify(stripTags(`${m[1]}. ${m[2]}`.replace(/[*`]/g, "")), seen);
      map.set(m[1], `${page.out}#${slug}`);
    }
  }
  return map;
}

/* ── build ─────────────────────────────────────────────────────────── */
async function build() {
  if (existsSync(DIST)) await rm(DIST, { recursive: true });
  await mkdir(DIST, { recursive: true });

  const anchors = await screenAnchorMap();
  const searchIndex = [];
  const bundleParts = [];
  const missingScreens = [];

  for (let i = 0; i < PAGES.length; i++) {
    const page = PAGES[i];
    let body, headings = [], indexable;

    if (page.home) {
      let home = await readFile(path.join(HERE, "home.html"), "utf8");
      home = home.replace(/<a class="s([^"]*)" data-screen="([A-Z]{1,2}\d{1,2})"/g, (all, cls, code) => {
        const href = anchors.get(code);
        if (!href) { missingScreens.push(code); return `<span class="s${cls}"`; }
        return `<a class="s${cls}" href="${href}"`;
      });
      body = home;
      indexable = home;
    } else {
      const md = await readFile(path.join(ROOT, page.src), "utf8");
      const fromDir = path.posix.dirname(page.src);
      const r = renderMarkdown(md, { fromDir });
      headings = r.headings;
      indexable = r.html;
      body = `<header class="page-head">
  <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
  <h1>${escapeHtml(page.title)}</h1>
  ${page.blurb ? `<p>${escapeHtml(page.blurb)}</p>` : ""}
</header>
<article class="doc">
${r.html}
</article>`;

      // Bundle copy: same Markdown, ids namespaced, links collapsed to anchors.
      const prefix = page.out.replace(/\.html$/, "");
      const b = renderMarkdown(md, { fromDir, idPrefix: prefix, bundle: true });
      bundleParts.push(
        `<section id="${prefix}" class="bundle-doc">
<header class="page-head"><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1>${
          page.blurb ? `<p>${escapeHtml(page.blurb)}</p>` : ""
        }</header>
<article class="doc">${b.html}</article>
</section>`
      );
    }

    searchIndex.push(...indexPage(page, indexable, headings));
    await writeFile(path.join(DIST, page.out), shell({ page, body, headings, index: i }), "utf8");
  }

  await copyFile(path.join(HERE, "theme.css"), path.join(DIST, "theme.css"));
  await copyFile(path.join(HERE, "app.js"), path.join(DIST, "app.js"));
  await writeFile(path.join(DIST, "search-index.json"), JSON.stringify(searchIndex), "utf8");
  await writeFile(path.join(DIST, ".nojekyll"), "", "utf8");

  // Original PDF, so the source link in the thesis resolves.
  await mkdir(path.join(DIST, "source"), { recursive: true });
  for (const f of await readdir(path.join(ROOT, "source"))) {
    await copyFile(path.join(ROOT, "source", f), path.join(DIST, "source", f));
  }

  await buildBundle(bundleParts, searchIndex);

  const pdfNote = missingScreens.length
    ? `\n  ! unresolved screen codes: ${[...new Set(missingScreens)].join(", ")}`
    : "";
  console.log(
    `built ${PAGES.length} pages + all.html · ${searchIndex.length} search entries · dist/${pdfNote}`
  );
  await checkLinks();
}

/* ── single-file bundle ────────────────────────────────────────────── */
async function buildBundle(parts, searchIndex) {
  const css = await readFile(path.join(HERE, "theme.css"), "utf8");
  const js = await readFile(path.join(HERE, "app.js"), "utf8");
  const homeRaw = await readFile(path.join(HERE, "home.html"), "utf8");
  const anchors = await screenAnchorMap();
  const home = homeRaw
    .replace(/<a class="s([^"]*)" data-screen="([A-Z]{1,2}\d{1,2})"/g, (all, cls, code) => {
      const href = anchors.get(code);
      if (!href) return `<span class="s${cls}"`;
      const [file, hash] = href.split("#");
      return `<a class="s${cls}" href="#${file.replace(/\.html$/, "")}--${hash}"`;
    })
    .replace(/href="([a-z0-9-]+)\.html(#([^"]+))?"/g, (all, file, _h, hash) =>
      `href="#${file === "index" ? "home" : file}${hash ? `--${hash}` : ""}"`
    )
    // Namespace the home page's own section ids — "thesis" and "screens" are
    // also document ids inside the bundle.
    .replace(/<section id="([a-z-]+)"/g, '<section id="home--$1"');

  const nav = PAGES.map(
    (p) => `<a href="#${p.home ? "home" : p.out.replace(/\.html$/, "")}">${p.nav}</a>`
  ).join("");

  // In-page search: same index, URLs rewritten to bundle anchors.
  const bundleIndex = searchIndex.map((e) => {
    const [file, hash] = e.u.split("#");
    const base = file === "index.html" ? "home" : file.replace(/\.html$/, "");
    return { ...e, u: `#${base}${hash ? `--${hash}` : ""}` };
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SITE_TITLE} — complete specification</title>
<meta name="description" content="The complete Enterprise Lead Conversion CRM specification: thesis, 35 screens, reference tables and AI layer, in one page.">
<meta name="color-scheme" content="light dark">
<style>
${css}
.bundle-doc{border-top:1px solid var(--rule);padding-top:44px;margin-bottom:72px;scroll-margin-top:16px}
.bundle-doc:first-of-type{border-top:0;padding-top:0}
</style>
</head>
<body>
<a class="skip" href="#home">Skip to content</a>
<div class="shell">
<aside class="rail">
  <div class="rail-mark"><a href="#home">Lead Conversion<br>Intelligence</a>Specification · v1</div>
  <div class="search">
    <label class="skip" for="q">Search the specification</label>
    <input id="q" type="search" placeholder="Search  /" autocomplete="off" spellcheck="false">
    <div class="results" data-results role="listbox" aria-label="Search results"></div>
  </div>
  <div class="menu"><button class="tgl" data-menu aria-expanded="false">Menu</button></div>
  <div class="rail-group"><b>Contents</b>${nav}</div>
  <div class="rail-foot"><button class="tgl" data-theme-toggle>Dark</button><span>v1 · Aug 2026</span></div>
</aside>
<main id="main">
<section id="home" class="bundle-doc">
${home}
</section>
${parts.join("\n")}
<footer>
  <span><code>${REPO}</code> — private</span>
  <span>Specification only · no application code</span>
</footer>
</main>
</div>
<script>window.__SEARCH_INDEX__=${JSON.stringify(bundleIndex)};</script>
<script>
${js}
</script>
</body>
</html>
`;
  await writeFile(path.join(DIST, "all.html"), html, "utf8");

  // Same bundle, minus the document wrapper: a body-only page for hosts that
  // supply their own <!doctype>/<head> (Claude Artifacts).
  const inner = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  await writeFile(
    path.join(DIST, "artifact.html"),
    `<title>${SITE_TITLE}</title>\n<style>\n${css}\n.bundle-doc{border-top:1px solid var(--rule);padding-top:44px;margin-bottom:72px;scroll-margin-top:16px}\n.bundle-doc:first-of-type{border-top:0;padding-top:0}\n</style>\n${inner}\n`,
    "utf8"
  );
}

/* ── link check ────────────────────────────────────────────────────── */
/* Every internal href must resolve to a built file and, if it carries a hash,
   to an id that exists on that page. Broken links fail the build loudly. */
async function checkLinks() {
  const files = (await readdir(DIST)).filter((f) => f.endsWith(".html"));
  const ids = new Map();
  const docs = new Map();
  for (const f of files) {
    const raw = await readFile(path.join(DIST, f), "utf8");
    const html = raw.replace(/<script[\s\S]*?<\/script>/g, ""); // hrefs built at runtime aren't links
    docs.set(f, html);
    const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    ids.set(f, new Set(all));
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    if (dupes.length) {
      console.error(`duplicate id(s) in ${f}: ${[...new Set(dupes)].join(", ")}`);
      process.exitCode = 1;
    }
  }
  const broken = [];
  for (const [f, html] of docs) {
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|tel:|data:)/i.test(href)) continue;
      const [file, hash] = href.split("#");
      const target = file === "" ? f : file;
      if (file && !existsSync(path.join(DIST, target))) { broken.push(`${f} → ${href}`); continue; }
      if (hash && ids.has(target) && !ids.get(target).has(hash)) broken.push(`${f} → ${href}`);
    }
  }
  if (broken.length) {
    console.error(`\n${broken.length} broken link(s):`);
    for (const b of broken) console.error(`  ${b}`);
    process.exitCode = 1;
  } else {
    console.log("links: all internal targets resolve");
  }
}

/* ── dev server ────────────────────────────────────────────────────── */
function serve(port = 4173) {
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".pdf": "application/pdf" };
  createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(DIST, url === "/" ? "index.html" : url);
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    try {
      const buf = await readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
      res.end(buf);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  }).listen(port, () => console.log(`serving dist/ on http://localhost:${port}`));
}

await build();
if (process.argv.includes("--serve")) serve();
