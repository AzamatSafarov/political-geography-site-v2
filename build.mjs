// Build the course site into site/.
// One command, no dependencies: node build.mjs
import fs from "node:fs";
import path from "node:path";
import {
  loadRings, worldLandPath, horizonPath, worldGraticule, regionalPlate,
  normalizeBbox, fitFrame, miniPlate, worldMarkers, formatBounds, project,
  WORLD_H, WORLD_W,
} from "./src/map.mjs";

const ROOT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(ROOT, "site");
const SITE = "https://political-geography-v2.vercel.app";
const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content.json"), "utf8"));
const extra = JSON.parse(fs.readFileSync(path.join(ROOT, "content-extra.json"), "utf8"));
const geo = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "data", "ne_110m_land.geojson"), "utf8"));
const rings = loadRings(geo);
const { meta, hero, aim, principles, seminars, assessment, methodology, artifacts_page, faq } = content;

const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const shortFormat = new Map(methodology.formats.map((f) => [f.name, f.short]));
const readingCount = seminars.reduce((n, s) => n + s.reading.length, 0);
const caseArticles = extra.articles.filter((a) => a.kind === "case");
const methodArticles = extra.articles.filter((a) => a.kind === "method");
const articleFor = (n) => caseArticles.find((a) => a.seminar === n);
const people = extra.people || {};

// ---------------------------------------------------------------- visual system

// One accent per case. deep is the same hue mixed toward the ocean, used for
// full-bleed headers; soft is the paper tint inside teacher blocks.
const THEMES = {
  1: { accent: "#A63A20", deep: "#6E2413", soft: "#F2D9CF" },
  2: { accent: "#14605F", deep: "#0B4544", soft: "#D5E6E1" },
  3: { accent: "#5E3F7E", deep: "#3E2959", soft: "#E4DAEC" },
  4: { accent: "#7E520E", deep: "#573807", soft: "#EFE1C3" },
  5: { accent: "#27517A", deep: "#193B5B", soft: "#D8E3EE" },
  6: { accent: "#356848", deep: "#224C33", soft: "#DAE7DC" },
  7: { accent: "#863049", deep: "#622033", soft: "#EFD8DE" },
  8: { accent: "#7A4E22", deep: "#573716", soft: "#EADCC8" },
};
const theme = (n) => THEMES[n] || THEMES[1];

const PAGE_ACCENT = {
  home: "#A63A20",
  discipline: "#27517A",
  seminars: "#A63A20",
  methodology: "#14605F",
  artifacts: "#5E3F7E",
  literature: "#7E520E",
  error: "#A63A20",
};

const mark = (cls = "mark") => `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect width="40" height="40" fill="#0C1E2A"/><circle cx="20" cy="19" r="11" fill="none" stroke="#F6F1E7" stroke-width="1.6"/><path d="M9 19h22M20 8c5 5 5 17 0 22M20 8c-5 5-5 17 0 22" stroke="#F6F1E7" stroke-width="1" opacity=".5" fill="none"/><circle cx="27" cy="12" r="4.2" fill="#C24B2A" stroke="#0C1E2A" stroke-width="1.6"/></svg>`;

// Case sigils: a visual mark per case, instead of a flag. Three of the eight
// cases are disputed or multi-place, so a flag would either be wrong or pick
// a side. These marks are drawn once and reused on cards, the route and the
// case header.
const SIGILS = {
  1: '<path d="M16 5l4 7h-8z"/><circle cx="16" cy="18" r="2.5"/><path d="M16 20.5V27M9 27h14M7 12l6 3M25 12l-6 3"/>',
  2: '<path d="M6 4c4 4 4 9 2 13s-2 8 0 11M26 4c-4 4-4 9-2 13s2 8 0 11"/><path d="M13 16h6"/>',
  3: '<rect x="7" y="7" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="M13 13h6v6h-6z"/>',
  4: '<path d="M16 4l9 6v12l-9 6-9-6V10z"/><path d="M16 4v24M7 10l9 6 9-6"/>',
  5: '<path d="M7 27V7h13M7 12h13M13 12v8M20 12l4 4v11"/><path d="M5 27h22"/>',
  6: '<circle cx="22" cy="9" r="4"/><path d="M4 20c3-3 6-3 9 0s6 3 9 0 6-3 9 0"/><path d="M4 26c3-3 6-3 9 0s6 3 9 0 6-3 9 0"/>',
  7: '<path d="M4 24c6 0 6-14 12-14s6 14 12 14"/><circle cx="4" cy="24" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="28" cy="24" r="2"/>',
  8: '<rect x="5" y="7" width="9" height="9"/><rect x="18" y="7" width="9" height="9"/><rect x="5" y="18" width="9" height="9"/><rect x="18" y="18" width="9" height="9"/>',
};

function caseSigil(n) {
  return `<svg class="sigil" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${SIGILS[n] || SIGILS[1]}</svg>`;
}

function mechanismChain(text, cls = "chain") {
  const parts = text.split(/(\s*(?:→|↔)\s*)/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return `<span class="${cls}"><b>${e(text)}</b></span>`;
  return `<span class="${cls}">${parts.map((p) => /^(→|↔)$/.test(p)
    ? `<i aria-hidden="true">${p}</i>`
    : `<b>${e(p)}</b>`).join("")}</span>`;
}

function personMark(initials, extraClass = "") {
  return `<span class="person-mark ${extraClass}" aria-hidden="true">${e(initials)}</span>`;
}

function personLine(name, initials, bio) {
  return `<span class="person-line">${personMark(initials, "person-mark--sm")}<span class="person-text"><b>${e(name)}</b><i>${e(bio)}</i></span></span>`;
}

function articleCard(a, accent = null, wide = false) {
  const color = accent || (a.seminar ? theme(a.seminar).accent : PAGE_ACCENT.methodology);
  return `<article class="article-card${wide ? " article-card--wide" : ""}" style="--accent:${color}">
  <span class="article-band"><span>${a.kind === "method" ? "К методике" : "Статья к кейсу"}</span><span>КиберЛенинка</span></span>
  <h3><a href="${e(a.link)}" target="_blank" rel="noopener">${e(a.title)}</a></h3>
  <p class="article-meta">${e(a.displayAuthors)} · ${e(a.journal)} · ${e(a.year)}</p>
  <p class="article-ann">${e(a.annotation)}</p>
  <span class="article-author">${personMark(a.initials, "person-mark--sm")}<span class="person-text"><b>${e(a.displayAuthors)}</b><i>${e(a.authorBio)}</i></span></span>
  <a class="article-link" href="${e(a.link)}" target="_blank" rel="noopener">Читать статью <span aria-hidden="true">↗</span></a>
</article>`;
}

// ---------------------------------------------------------------- maps

const TAG_SIDE = { 1: "dl", 2: "ul", 3: "r", 4: "l", 5: "dr", 6: "r", 7: "d", 8: "ur" };

const thumbData = new Map(seminars.map((s) => {
  if (s.n === seminars.length) {
    const p = project(s.marker[0], s.marker[1]);
    return [s.n, {
      href: "#world-land", viewBox: `0 0 ${WORLD_W} ${WORLD_H.toFixed(2)}`,
      x: 0, y: 0, w: WORLD_W, h: WORLD_H, cx: p.x, cy: p.y, r: WORLD_W * 0.007,
    }];
  }
  const { bbox } = normalizeBbox(s);
  const m = miniPlate(rings, fitFrame(bbox, s.marker).bbox, s.marker);
  return [s.n, {
    href: `#thumb-${pad(s.n)}`, viewBox: m.viewBox,
    x: m.x, y: m.y, w: m.width, h: m.height,
    cx: m.marker.px, cy: m.marker.py, r: m.width * 0.012,
  }];
}));

function mapSprite() {
  const symbols = seminars.filter((s) => s.n !== seminars.length).map((s) => {
    const { bbox } = normalizeBbox(s);
    const m = miniPlate(rings, fitFrame(bbox, s.marker).bbox, s.marker);
    return `<symbol id="thumb-${pad(s.n)}" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet"><path d="${m.land}"/></symbol>`;
  }).join("");
  return `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><symbol id="world-land" viewBox="0 0 ${WORLD_W} ${WORLD_H.toFixed(2)}" preserveAspectRatio="xMidYMid meet"><path d="${worldLandPath(rings, 0.9)}"/></symbol>${symbols}</svg>`;
}

function worldStage(root, current = 0) {
  const marks = worldMarkers(seminars);
  const pins = marks.map((m) => {
    const s = seminars[m.n - 1];
    const t = theme(m.n);
    const cur = s.n === current ? " is-current" : "";
    return `<a class="wpin wpin--${TAG_SIDE[m.n]}${cur}" style="--x:${m.x.toFixed(2)}%;--y:${m.y.toFixed(2)}%;--c:${t.accent}" href="${root}seminars/${s.slug}/" data-title="${e(s.title)}" data-meta="${pad(s.n)} · ${e(s.place)} · ${e(shortFormat.get(s.format) || s.format)}" aria-label="Семинар ${pad(s.n)}. ${e(s.place)}. ${e(s.title)}"><span class="wpin-dot"></span><span class="wpin-tag">${pad(s.n)}</span></a>`;
  }).join("\n      ");

  return `<figure class="world-plate">
  <div class="world-canvas" role="group" aria-label="Карта мира с восемью кейсами">
    <svg viewBox="0 0 ${WORLD_W} ${WORLD_H.toFixed(2)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path class="w-horizon" d="${horizonPath()}"/>
      <path class="w-grat" d="${worldGraticule()}"/>
      <use href="#world-land" x="0" y="0" width="${WORLD_W}" height="${WORLD_H.toFixed(2)}"/>
    </svg>
    ${pins}
  </div>
  <div class="map-panel" aria-hidden="true">
    <span class="map-panel-n" id="map-n">8</span>
    <div class="map-panel-text">
      <strong id="map-title">Восемь кейсов корпуса</strong>
      <span id="map-meta">${e(hero.plate_caption)}</span>
    </div>
  </div>
  <figcaption class="plate-caption"><span>Проекция Робинсона · Natural Earth 110m</span><span>8 точек · 8 кейсов</span></figcaption>
</figure>`;
}

function regionalFigure(s, opts = {}) {
  const { bbox, fixed } = normalizeBbox(s);
  if (fixed) console.warn(`bbox ${s.slug}: source frame adjusted to contain marker -> ${bbox.join(",")}`);
  const fit = fitFrame(bbox, s.marker);
  const p = regionalPlate(rings, fit.bbox, s.marker);
  const t = theme(s.n);

  let callouts = "";
  if (s.n === 1) {
    const [minX, minY, vw, vh] = p.viewBox.split(" ").map(Number);
    const mx = minX + (p.marker.x / 100) * vw;
    const my = minY + (p.marker.y / 100) * vh;
    const actors = [
      ["Китай", 18, 26],
      ["США", 62, 20],
      ["Франция", 24, 74],
    ];
    const lines = actors.map(([, x, y]) => {
      const ax = minX + (x / 100) * vw;
      const ay = minY + (y / 100) * vh;
      return `<line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"/>`;
    }).join("");
    const chips = actors.map(([name, x, y]) => `<span class="actor" style=\"left:${x}%;top:${y}%\"><i></i>${name}</span>`).join("");
    callouts = `<svg class="callout-lines" viewBox="${p.viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${lines}</svg>${chips}`;
  }

  return `<figure class="case-plate" style="--accent:${t.accent};--deep:${t.deep}" >
  <div class="case-stage" style="aspect-ratio:${p.ratio.toFixed(4)}" role="img" aria-label="Региональная карта. ${e(s.place)}. Рамка ${e(formatBounds(fit.bbox))}.">
    <svg viewBox="${p.viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path class="c-grat" d="${p.grat}"/>
      <path class="c-land" d="${p.land}"/>
      <path class="c-frame" d="${p.frame}"/>
    </svg>
    ${callouts}
    <span class="site-pin" style="--x:${p.marker.x.toFixed(3)}%;--y:${p.marker.y.toFixed(3)}%"><span></span></span>
  </div>
  <figcaption class="case-caption"><span>${e(s.coords)}</span><span>${e(formatBounds(fit.bbox))}</span></figcaption>
</figure>`;
}

function caseCard(s, root) {
  const t = thumbData.get(s.n);
  const th = theme(s.n);
  return `<a class="case" href="${root}seminars/${s.slug}/" data-format="${e(s.format_key)}" style="--accent:${th.accent};--deep:${th.deep};--soft:${th.soft}">
  <span class="case-media">
    <svg viewBox="${t.viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <use href="${t.href}" x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" width="${t.w.toFixed(1)}" height="${t.h.toFixed(1)}"></use>
      <circle class="case-pin" cx="${t.cx.toFixed(1)}" cy="${t.cy.toFixed(1)}" r="${(t.r * 1.15).toFixed(1)}"></circle>
    </svg>
    <span class="case-num" aria-hidden="true">${pad(s.n)}</span>
    <span class="case-sigil" aria-hidden="true">${caseSigil(s.n)}</span>
    <span class="case-place">${e(s.place)}</span>
  </span>
  <span class="case-body">
    <span class="case-kicker">${e(s.week)} · ${e(shortFormat.get(s.format) || s.format)}</span>
    <h3>${e(s.title)}</h3>
    <span class="case-short">${e(s.short)}</span>
    ${mechanismChain(s.mechanism, "case-chain")}
    <span class="case-open">Открыть кейс <i aria-hidden="true">→</i></span>
  </span>
</a>`;
}

// ---------------------------------------------------------------- shared pieces

const NAV = [
  ["", "Главная", "home"],
  ["seminars/", "Кейсы", "seminars"],
  ["course/", "Дисциплина", "discipline"],
  ["method/", "Методика", "methodology"],
  ["artifacts/", "Артефакты", "artifacts"],
  ["reading/", "Литература", "literature"],
];

function modeSwitch() {
  return `<div class="mode" role="group" aria-label="Режим просмотра">
      <button type="button" data-set-mode="student" aria-pressed="true">Студент</button>
      <button type="button" data-set-mode="teacher" aria-pressed="false">Преподаватель</button>
    </div>`;
}

function header(root, active) {
  const links = NAV.map(([href, label, key]) => {
    const cur = key === active ? ' aria-current="page"' : "";
    return `<a href="${root}${href}"${cur}>${label}</a>`;
  }).join("");
  return `<header class="site-head">
  <div class="wrap head-in">
    <a class="brand" href="${root}">
      ${mark()}
      <span class="brand-text"><b>${e(meta.title)}</b><i>курс · ${e(meta.year)}</i></span>
    </a>
    <nav class="nav" aria-label="Основная навигация">${links}</nav>
    ${modeSwitch()}
  </div>
</header>
<div class="teacher-banner teacher-only"><div class="wrap"><span>Режим преподавателя: открыты ответы, роли в комнате и таймер.</span><button type="button" data-set-mode="student">Выйти</button></div></div>`;
}

function footer(root) {
  const links = NAV.map(([href, label]) => `<a href="${root}${href}">${label}</a>`).join("");
  return `<footer class="site-foot">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand brand--light" href="${root}">${mark("mark mark--light")}<span class="brand-text"><b>${e(meta.title)}</b><i>${e(meta.subtitle)}</i></span></a>
    </div>
    <nav class="foot-nav" aria-label="Навигация в подвале">${links}</nav>
    <dl class="foot-meta">
      <div><dt>Подразделение</dt><dd>${e(meta.institution)}</dd></div>
      <div><dt>Семестр</dt><dd>${e(meta.semester)}</dd></div>
    </dl>
    <p class="colophon">Карты: Natural Earth 110m, проекция Робинсона. Шрифты: Golos Text, Literata, IBM Plex Mono. Тексты и числа собраны из content.json.</p>
  </div>
</footer>`;
}

function layout({ root = "/", active = "", title, description, body, pageClass = "", pagePath = "", accent = PAGE_ACCENT.home }) {
  const canonical = `${SITE}/${pagePath}`;
  return `<!doctype html>
<html lang="ru" data-mode="student">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${e(meta.title)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${canonical}">
<meta name="theme-color" content="#0C1E2A">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}assets/fonts.css">
<link rel="stylesheet" href="${root}assets/styles.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body class="${pageClass}" style="--page-accent:${accent}">
<a class="skip" href="#main">Перейти к содержанию</a>
${header(root, active)}
<main id="main">
${body}
</main>
${footer(root)}
<script src="${root}assets/app.js" defer></script>
</body>
</html>`;
}

function pageHead({ plate, label, title, lead }) {
  return `<header class="page-head">
  <div class="wrap">
    <p class="eyebrow"><span class="tick" aria-hidden="true"></span>${plate}${label ? ` · ${label}` : ""}</p>
    <h1>${title}</h1>
    ${lead ? `<p class="page-lead">${lead}</p>` : ""}
  </div>
</header>`;
}

function secHead(eyebrow, title, lead = "", light = false) {
  return `<header class="sec-head${light ? " sec-head--light" : ""}">
  <p class="eyebrow"><span class="tick" aria-hidden="true"></span>${eyebrow}</p>
  <h2>${title}</h2>
  ${lead ? `<p class="sec-lead">${lead}</p>` : ""}
</header>`;
}

function qaList(items, gated = false) {
  return items.map((item, i) => `<details class="qa"${i === 0 ? " open" : ""}>
  <summary><span class="qa-q">${e(item.q)}</span><span class="qa-mark" aria-hidden="true"></span></summary>
  <div class="qa-a">
    ${gated ? `<p class="teacher-only">${e(item.a)}</p><p class="student-only qa-locked">Ответ разбирается на семинаре. В режиме «Преподаватель» он открыт.</p>` : `<p>${e(item.a)}</p>`}
  </div>
</details>`).join("\n");
}

function accessBadge(r) {
  return r.link
    ? `<a class="src-open" href="${e(r.link)}" target="_blank" rel="noopener">Открытый доступ <span aria-hidden="true">↗</span></a>`
    : `<span class="src-lib">Закрытый доступ · в библиотеке</span>`;
}

function sourceCard(r, i) {
  const person = people[r.author];
  return `<article class="source">
  <span class="source-n">${pad(i + 1)}</span>
  <div class="source-cite">
    <h3>${e(r.author)}</h3>
    <p class="source-title">${e(r.title)}</p>
    <p class="source-year">${e(r.year)}</p>
    <span class="source-access">${accessBadge(r)}</span>
    ${person ? personLine(r.author, person.initials, person.bio) : ""}
  </div>
  <div class="source-body">
    <p class="source-note">${e(r.note)}</p>
    <p class="source-ann">${e(r.annotation)}</p>
  </div>
</article>`;
}

function readingBlock(s) {
  return `<div class="sources">${s.reading.map(sourceCard).join("")}</div>`;
}

function bookCover(r, s) {
  const t = theme(s.n);
  const person = people[r.author];
  return `<article class="book" style="--accent:${t.accent};--deep:${t.deep}">
  <span class="book-top">Семинар ${pad(s.n)}</span>
  ${person ? personMark(person.initials) : ""}
  <span class="book-author">${e(r.author)}</span>
  <span class="book-title">${e(r.title)}</span>
  <span class="book-foot"><span>${e(r.year)}</span><span>${e(shortFormat.get(s.format) || s.format)}</span></span>
</article>`;
}

function pager(s, root) {
  const prev = s.n > 1 ? seminars[s.n - 2] : null;
  const next = s.n < seminars.length ? seminars[s.n] : null;
  const prevT = prev ? theme(prev.n) : theme(s.n);
  const nextT = next ? theme(next.n) : theme(s.n);
  const prevHref = prev ? `${root}seminars/${prev.slug}/` : `${root}seminars/`;
  const nextHref = next ? `${root}seminars/${next.slug}/` : `${root}seminars/`;
  return `<nav class="pager" aria-label="Соседние кейсы">
  <a class="pager-link" style="--accent:${prevT.accent};--deep:${prevT.deep}" href="${prevHref}">
    <span class="pager-kicker">${prev ? "Предыдущий кейс" : "Все кейсы"}</span>
    <b>${prev ? `${pad(prev.n)} · ${e(prev.title)}` : "Восемь кейсов"}</b>
    <span class="pager-arrow" aria-hidden="true">←</span>
  </a>
  <a class="pager-link pager-link--next" style="--accent:${nextT.accent};--deep:${nextT.deep}" href="${nextHref}">
    <span class="pager-kicker">${next ? "Следующий кейс" : "Все кейсы"}</span>
    <b>${next ? `${pad(next.n)} · ${e(next.title)}` : "Восемь кейсов"}</b>
    <span class="pager-arrow" aria-hidden="true">→</span>
  </a>
</nav>`;
}

// ---------------------------------------------------------------- format glyphs

const FORMAT_KEYS = ["dispute", "simulation", "jigsaw", "negotiation", "redteam", "court", "sprint", "exhibition"];

function formatGlyph(key) {
  const paths = {
    dispute: '<path d="M11 18a13 13 0 0 1 21-4"/><path d="M37 30a13 13 0 0 1-21 4"/><path d="M32 8l1 6-6-1"/><path d="M16 40l-1-6 6 1"/>',
    simulation: '<circle cx="24" cy="24" r="3"/><circle cx="24" cy="10" r="2.5"/><circle cx="37" cy="18" r="2.5"/><circle cx="33" cy="35" r="2.5"/><circle cx="15" cy="35" r="2.5"/><circle cx="11" cy="18" r="2.5"/><path d="M24 13v8M34 20l-7 3M30 33l-4-6M18 33l3-6M14 20l7 3"/>',
    jigsaw: '<rect x="8" y="9" width="14" height="14"/><rect x="26" y="9" width="14" height="14"/><rect x="8" y="27" width="14" height="14"/><path d="M26 27h14v14H26"/><path d="M22 16h4M22 34h4M15 23v4M33 23v4"/>',
    negotiation: '<ellipse cx="24" cy="26" rx="13" ry="7"/><circle cx="24" cy="10" r="3"/><circle cx="10" cy="19" r="3"/><circle cx="38" cy="19" r="3"/><circle cx="15" cy="40" r="3"/><circle cx="33" cy="40" r="3"/><path d="M24 13v6M13 21l5 3M35 21l-5 3M17 37l4-4M31 37l-4-4"/>',
    redteam: '<path d="M24 6l14 5v11c0 9-6 15-14 20-8-5-14-11-14-20V11z"/><path d="M12 16l8 6M36 16l-8 6"/><path d="M9 12l5 1-1 5M39 12l-5 1 1 5"/>',
    court: '<path d="M24 6L8 15h32z"/><path d="M8 15v3h32v-3"/><path d="M13 21v14M24 21v14M35 21v14"/><path d="M9 39h30"/>',
    sprint: '<circle cx="9" cy="24" r="2.5"/><circle cx="22" cy="24" r="2.5"/><circle cx="35" cy="24" r="2.5"/><path d="M12 24h7M25 24h7"/><path d="M30 24l5-8M30 24l5 8"/><path d="M35 10v8h8"/>',
    exhibition: '<path d="M7 12h14v12H7zM27 12h14v12H27zM17 30h14v11H17z"/><path d="M11 24v3M37 24v3M21 30v-3M27 30v-3M24 41v-4"/>',
  };
  return `<svg class="glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${paths[key] || paths.dispute}</svg>`;
}

// ---------------------------------------------------------------- runner

function parseRange(t) {
  const m = t.match(/(\d+)\D+(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

function runnerDialog(s) {
  const stages = s.timeline.map((t) => {
    const [a, b] = parseRange(t.t);
    return `<li data-start="${a}" data-end="${b}">
      <span class="rs-time">${e(t.t)}</span>
      <span class="rs-label">${e(t.label)}</span>
      <span class="rs-text">${e(t.text)}</span>
    </li>`;
  }).join("");
  return `<dialog class="runner" id="runner" aria-labelledby="runner-title">
  <div class="runner-in">
    <header class="runner-head">
      <div><p class="eyebrow">Кейс ${pad(s.n)} · ${e(s.week)}</p><h2 id="runner-title">${e(s.title)}</h2></div>
      <button class="runner-close" type="button" data-runner-close aria-label="Закрыть таймер">×</button>
    </header>
    <div class="runner-main">
      <div class="runner-clockbox">
        <span class="runner-clock" id="runner-clock">90:00</span>
        <span class="runner-state" id="runner-state">Готов к старту</span>
        <div class="runner-bar"><i id="runner-bar"></i></div>
      </div>
      <div class="runner-now">
        <p class="eyebrow">Сейчас</p>
        <h3 id="runner-now-label">${e(s.timeline[0].label)}</h3>
        <p id="runner-now-text">${e(s.timeline[0].text)}</p>
      </div>
    </div>
    <ol class="runner-stages" id="runner-stages">${stages}</ol>
    <footer class="runner-controls">
      <button type="button" class="btn btn--cream" id="runner-start">Начать</button>
      <button type="button" class="btn btn--ghost-light" id="runner-prev">Назад</button>
      <button type="button" class="btn btn--ghost-light" id="runner-next">Дальше</button>
      <button type="button" class="btn btn--ghost-light" id="runner-reset">Сброс</button>
    </footer>
  </div>
</dialog>`;
}

// ---------------------------------------------------------------- route

const ROUTE_LABELS = ["Интерес", "Уязвимость", "Признание", "Цепочка", "Инфраструктура", "Право", "Поток", "Синтез"];

function routeSection() {
  const stops = seminars.map((s) => `<li>
    <a class="route-stop${s.n === 1 ? " is-active" : ""}" href="/seminars/${s.slug}/" data-route="${s.n}" aria-label="Кейс ${pad(s.n)}: ${e(s.title)}">
      <span class="route-sigil" aria-hidden="true">${caseSigil(s.n)}</span>
      <span class="route-n">${pad(s.n)} · ${e(s.week)}</span>
      <b>${e(ROUTE_LABELS[s.n - 1])}</b>
    </a>
  </li>`).join("");
  const panels = seminars.map((s) => `<article class="route-panel" data-panel="${s.n}"${s.n === 1 ? "" : " hidden"}>
    <div class="route-panel-head">
      <p class="eyebrow">${e(s.week)} · ${e(shortFormat.get(s.format) || s.format)}</p>
      <h3>${e(s.title)}</h3>
    </div>
    <p class="route-q">${e(s.question)}</p>
    <div class="route-panel-foot">
      <span>${e(s.place)}</span>
      <a class="link-arrow" href="/seminars/${s.slug}/">Открыть кейс <span aria-hidden="true">→</span></a>
    </div>
  </article>`).join("");

  return `<section class="band band--tint" id="route">
  <div class="wrap">
    ${secHead("01 · Маршрут", "От интереса к синтезу", "Восемь остановок складываются в один аргумент: от ставки и уязвимости к праву, потоку и синтезу.")}
    <ol class="route-track">${stops}</ol>
    <div class="route-panels">${panels}</div>
  </div>
</section>`;
}

// ---------------------------------------------------------------- home

function homePage() {
  const cards = seminars.map((s) => caseCard(s, "/")).join("\n    ");
  const nots = aim.nots.map((n) => `<li>${e(n)}</li>`).join("");
  const pr = principles.map((p) => `<li class="principle">
      <span class="principle-n">${e(p.n)}</span>
      <h3>${e(p.title)}</h3>
      <p>${e(p.text)}</p>
    </li>`).join("");
  const tacts = methodology.tacts.map((t) => `<li><span class="tact-time">${e(t.time)}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></li>`).join("");
  const covers = seminars.slice(0, 3).map((s) => bookCover(s.reading[0], s)).join("");
  const legend = assessment.rows.map((r) => `<li><span>${e(r.weight)}</span>${e(r.component)}</li>`).join("");

  const body = `${mapSprite()}
<section class="home-hero">
  <div class="wrap hero-inner">
    <p class="eyebrow eyebrow--warm"><span class="tick" aria-hidden="true"></span>Дисциплина · восемь кейсов</p>
    <h1>${e(meta.title)}</h1>
    <div class="hero-cols">
      <p class="hero-lead">${e(hero.lead)}</p>
      <p class="hero-thesis">${e(hero.thesis)}</p>
    </div>
    <div class="actions">
      <a class="btn btn--cream" href="/seminars/">Смотреть кейсы</a>
      <a class="btn btn--ghost-light" href="/course/">Паспорт дисциплины</a>
    </div>
  </div>
  <div class="wrap hero-map">${worldStage("/")}</div>
</section>

${routeSection()}

<section class="band" id="cases">
  <div class="wrap">
    ${secHead("02 · Программа", "Восемь кейсов", "Каждый кейс держит один механизм, один формат работы и один артефакт в GitHub.")}
    <div class="case-grid" id="seminar-grid">${cards}</div>
  </div>
</section>

<section class="band band--tint" id="aim">
  <div class="wrap aim">
    <div class="aim-main">
      <p class="eyebrow">03 · ${e(aim.label)}</p>
      <h2>${e(aim.title)}</h2>
      <div class="prose">${aim.body.map((p) => `<p>${e(p)}</p>`).join("")}</div>
    </div>
    <aside class="nots">
      <h3>Чего здесь нет</h3>
      <ul>${nots}</ul>
    </aside>
  </div>
</section>

<section class="band band--ink" id="principles">
  <div class="wrap">
    ${secHead("04 · Принципы", "Три принципа", "", true)}
    <ol class="principles">${pr}</ol>
  </div>
</section>

<section class="band" id="method">
  <div class="wrap">
    ${secHead("05 · Как устроены 90 минут", "Вход, работа, фиксация", "Середина меняется от кейса к кейсу. Ритм остаётся.")}
    <ol class="tact-grid">${tacts}</ol>
    <div class="assess-teaser">
      <div>
        <p class="eyebrow">Оценивание</p>
        <p class="assess-total">100 <span>баллов</span></p>
        <p class="assess-copy">${e(assessment.intro)}</p>
        <a class="link-arrow" href="/course/#assessment">Таблица оценивания <span aria-hidden="true">→</span></a>
      </div>
      <div class="assess-viz">
        <div class="weight-bar" aria-hidden="true">${assessment.rows.map((r) => `<span style="--w:${Number(r.weight)}%"></span>`).join("")}</div>
        <ul class="weight-legend">${legend}</ul>
      </div>
    </div>
  </div>
</section>

<section class="band band--tint" id="reading">
  <div class="wrap">
    ${secHead("06 · Литература", "Что читать", `${readingCount} источника с аннотациями: три на каждый кейс.`)}
    <div class="book-row">${covers}</div>
    <a class="link-arrow" href="/reading/">Вся литература по кейсам <span aria-hidden="true">→</span></a>
  </div>
</section>`;

  return layout({
    title: `${meta.title} · сайт дисциплины`,
    description: meta.description,
    active: "home",
    body,
    pageClass: "page-home",
    pagePath: "",
    accent: PAGE_ACCENT.home,
  });
}

// ---------------------------------------------------------------- seminars index

function seminarsPage() {
  const seen = new Set();
  const chips = seminars.filter((s) => {
    if (seen.has(s.format_key)) return false;
    seen.add(s.format_key);
    return true;
  }).map((s) => {
    const label = shortFormat.get(s.format) || s.format;
    const count = seminars.filter((x) => x.format_key === s.format_key).length;
    return `<button class="chip" type="button" data-filter="${e(s.format_key)}" aria-pressed="false">${e(label)} <span>${count}</span></button>`;
  }).join("");
  const cards = seminars.map((s) => caseCard(s, "/")).join("\n    ");
  const rows = seminars.map((s) => `<tr data-format="${e(s.format_key)}">
      <td>${pad(s.n)}</td>
      <td><a href="/seminars/${s.slug}/">${e(s.title)}</a></td>
      <td>${e(s.place)}</td>
      <td>${e(shortFormat.get(s.format) || s.format)}</td>
      <td>${e(s.mechanism)}</td>
      <td>${e(s.artifact.name)}</td>
    </tr>`).join("");

  const body = `${pageHead({ plate: "Программа", label: "8 кейсов", title: "Кейсы", lead: e(hero.thesis) })}
<section class="band">
  <div class="wrap">
    <div class="filter js-only" role="group" aria-label="Фильтр по формату работы">
      <button class="chip is-on" type="button" data-filter="all" aria-pressed="true">Все <span>8</span></button>
      ${chips}
    </div>
    <p class="filter-status js-only">Показаны все 8 кейсов</p>
    <div class="view-switch js-only" role="group" aria-label="Вид списка">
      <button type="button" data-view="cards" aria-pressed="true">Карточки</button>
      <button type="button" data-view="table" aria-pressed="false">Таблица</button>
    </div>
    <div class="case-grid" id="seminar-grid">${cards}</div>
    <div class="case-table-wrap js-only" id="case-table" hidden>
      <table class="case-table">
        <caption class="sr-only">Восемь кейсов курса</caption>
        <thead><tr><th scope="col">№</th><th scope="col">Кейс</th><th scope="col">Место</th><th scope="col">Формат</th><th scope="col">Механизм</th><th scope="col">Артефакт</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="filter-empty js-only" hidden>В этом формате пока нет кейсов.</p>
  </div>
</section>`;

  return layout({
    title: `Кейсы · ${meta.title}`,
    description: `Восемь кейсов дисциплины «${meta.title}»: форматы, карты, артефакты и литература.`,
    active: "seminars",
    body,
    pagePath: "seminars/",
    accent: PAGE_ACCENT.seminars,
  });
}

// ---------------------------------------------------------------- seminar page

function seminarPage(s) {
  const t = theme(s.n);
  const outcomes = s.outcomes.map((o) => `<li>${e(o)}</li>`).join("");
  const timeline = s.timeline.map((item) => {
    const [a, b] = parseRange(item.t);
    return `<li data-start="${a}" data-end="${b}">
      <span class="t-time">${e(item.t)}</span>
      <div class="t-body"><h3>${e(item.label)}</h3><p>${e(item.text)}</p></div>
    </li>`;
  }).join("");
  const segs = s.timeline.map((item) => {
    const [a, b] = parseRange(item.t);
    const w = Math.max(0, b - a);
    return `<span style="--w:${(w / 90) * 100}%;--o:${(a / 90) * 100}%" title="${e(item.t)} · ${e(item.label)}"></span>`;
  }).join("");

  const tree = s.artifact.tree.map((line) => {
    const m = line.match(/^([^—]+)—\s*(.*)$/);
    const file = m ? m[1].trim() : line;
    const desc = m ? m[2] : "";
    return `<li><span class="file">${e(file)}</span>${desc ? `<span class="desc">${e(desc)}</span>` : ""}</li>`;
  }).join("");
  const criteria = s.artifact.criteria.map((c) => `<li>${e(c)}</li>`).join("");
  const before = s.before.map((b) => `<li>${e(b)}</li>`).join("");
  const checks = qaList(s.check, true);
  const isCorpus = s.n === seminars.length;

  const body = `${isCorpus ? mapSprite() : ""}
<header class="case-hero" style="--accent:${t.accent};--deep:${t.deep};--soft:${t.soft}">
  <div class="wrap case-hero-grid">
    <div class="case-hero-copy">
      <div class="case-hero-top">
        <span class="case-sigil case-sigil--hero" aria-hidden="true">${caseSigil(s.n)}</span>
        <p class="eyebrow eyebrow--light"><span class="tick" aria-hidden="true"></span>Кейс ${pad(s.n)} · ${e(s.week)}</p>
      </div>
      <h1>${e(s.title)}</h1>
      <p class="case-lead">${e(s.short)}</p>
      <div class="case-actions">
        <button class="btn btn--cream teacher-only" type="button" data-runner>Провести 90 минут</button>
        <a class="btn btn--ghost-light" href="#reading">Источники</a>
      </div>
    </div>
    <div class="case-hero-map">${isCorpus ? worldStage("/", s.n) : regionalFigure(s)}</div>
  </div>
  <div class="wrap case-facts">
    <div><span>Место</span><b>${e(s.place)}</b></div>
    <div><span>${isCorpus ? "Схема" : "Координаты"}</span><b>${e(s.coords)}</b></div>
    <div><span>Формат</span><b>${e(s.format)}</b></div>
    <div><span>Механизм</span><b>${mechanismChain(s.mechanism, "chain chain--light")}</b></div>
  </div>
</header>

<nav class="case-subnav" aria-label="Разделы кейса">
  <div class="wrap">
    <a href="#question">Вопрос</a>
    <a href="#timeline">90 минут</a>
    <a href="#artifact">Артефакт</a>
    <a href="#check">Проверка</a>
    <a href="#reading">Источники</a>
    <button class="teacher-only" type="button" data-runner>Таймер</button>
  </div>
</nav>

<section class="band band--paper" id="question">
  <div class="wrap case-q">
    <div class="case-q-main">
      <p class="eyebrow">01 · Вопрос</p>
      <h2>${e(s.question)}</h2>
    </div>
    <div class="outcomes">
      <p class="eyebrow">Что закрепляем</p>
      <ol>${outcomes}</ol>
    </div>
  </div>
</section>

<section class="band band--soft teacher-only" style="--soft:${t.soft}">
  <div class="wrap teacher-grid">
    <div>
      <p class="eyebrow">Для преподавателя</p>
      <h2>Как это работает</h2>
      <div class="prose"><p>${e(s.why)}</p></div>
      <p class="format-note">${e(s.format_note)}</p>
      <button class="btn btn--ink" type="button" data-runner>Запустить таймер</button>
      <p class="teacher-hint">Таймер идёт по этапам: «Дальше» переводит к следующему, «Назад» возвращает, пробел ставит паузу.</p>
    </div>
    <aside class="roles">
      <p class="eyebrow">Роли в комнате</p>
      <p>${e(s.roles)}</p>
    </aside>
  </div>
</section>

<section class="band" id="timeline">
  <div class="wrap">
    ${secHead("02 · 90 минут", "Таймлайн", "Семь-восемь шагов, каждый со своей задачей.")}
    <div class="ruler" aria-hidden="true">${segs}</div>
    <p class="ruler-scale" aria-hidden="true"><span>0</span><span>30</span><span>60</span><span>90</span></p>
    <ol class="timeline">${timeline}</ol>
  </div>
</section>

<section class="band band--ink" id="artifact">
  <div class="wrap">
    <p class="eyebrow eyebrow--warm">03 · Артефакт</p>
    <h2 class="artifact-name">${e(s.artifact.name)}</h2>
    <div class="artifact-top">
      <code>${e(s.artifact.repo)}</code>
      <span>${e(s.artifact.deadline)}</span>
    </div>
    <p class="artifact-brief">${e(s.artifact.brief)}</p>
    <div class="artifact-cols">
      <div><p class="eyebrow">Дерево файлов</p><ul class="tree">${tree}</ul></div>
      <div><p class="eyebrow">Критерии</p><ul class="criteria">${criteria}</ul></div>
    </div>
  </div>
</section>

<section class="band band--paper" id="around">
  <div class="wrap around">
    <div>
      <p class="eyebrow">04 · До семинара</p>
      <ol class="numbered">${before}</ol>
    </div>
    <div>
      <p class="eyebrow">После семинара</p>
      <p class="after">${e(s.after)}</p>
    </div>
  </div>
</section>

<section class="band band--tint" id="check">
  <div class="wrap">
    ${secHead("05 · Проверь себя", "Вопросы к кейсу", "Откройте вопрос и сформулируйте ответ до того, как читать разбор.")}
    <div class="qa-list">${checks}</div>
    <p class="student-only mode-note">Ответы открыты в режиме «Преподаватель».</p>
  </div>
</section>

<section class="band" id="reading">
  <div class="wrap">
    ${secHead("06 · Источники", "Три источника и статья", "Три источника кейса и одна открытая статья с КиберЛенинки.")}
    ${readingBlock(s)}
    ${articleFor(s.n) ? `<div class="article-feature">${articleCard(articleFor(s.n), t.accent, true)}</div>` : ""}
    <a class="link-arrow" href="/reading/">Вся литература курса <span aria-hidden="true">→</span></a>
  </div>
</section>

<div class="wrap">${pager(s, "/")}</div>
${runnerDialog(s)}`;

  return layout({
    title: `${pad(s.n)}. ${s.title} · ${meta.title}`,
    description: `${s.title}. ${s.short} Кейс ${s.n} из 8, ${s.place}.`,
    active: "seminars",
    body,
    pageClass: "page-case",
    pagePath: `seminars/${s.slug}/`,
    accent: t.accent,
  });
}

// ---------------------------------------------------------------- discipline

function disciplinePage() {
  const pass = [
    ["Название", meta.title],
    ["Подзаголовок", meta.subtitle],
    ["Объём", meta.hours_note],
    ["Длительность", meta.semester],
    ["Аудитория", meta.audience],
    ["Контактная работа", meta.contact],
    ["Подразделение", meta.institution],
    ["Язык", meta.lang],
    ["Год", meta.year],
  ].map(([k, v]) => `<div class="pass-row"><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("");

  const tacts = methodology.tacts.map((t) => `<li><span class="tact-time">${e(t.time)}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></li>`).join("");
  const policy = assessment.policy.map((p) => `<li>${e(p)}</li>`).join("");
  const rows = assessment.rows.map((r) => `<tr>
    <td>${e(r.component)}</td>
    <td class="score-weight"><b>${e(r.weight)}</b><i style="--w:${Number(r.weight)}%"></i></td>
    <td>${e(r.detail)}</td>
  </tr>`).join("");

  const body = `${pageHead({ plate: e(meta.kicker), label: meta.year, title: "Паспорт курса", lead: e(meta.subtitle) })}
<section class="band band--paper" id="passport">
  <div class="wrap">
    ${secHead("01 · Паспорт", "Что это за курс")}
    <dl class="passport">${pass}</dl>
  </div>
</section>

<section class="band band--tint" id="does">
  <div class="wrap split">
    <div>
      ${secHead("02 · Границы", "Что курс делает и чего не делает")}
      <div class="prose">${aim.body.map((p) => `<p>${e(p)}</p>`).join("")}</div>
    </div>
    <ul class="nots">${aim.nots.map((n) => `<li>${e(n)}</li>`).join("")}</ul>
  </div>
</section>

<section class="band" id="rhythm">
  <div class="wrap">
    ${secHead("03 · Ритм", "90 минут, три такта")}
    <ol class="tact-grid">${tacts}</ol>
  </div>
</section>

<section class="band band--tint" id="assessment">
  <div class="wrap">
    ${secHead("04 · Оценивание", "100 баллов", e(assessment.intro))}
    <table class="score">
      <caption class="sr-only">Оценивание на 100 баллов</caption>
      <thead><tr><th scope="col">Компонент</th><th scope="col">Вес</th><th scope="col">Что оценивается</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Итого</td><td class="score-weight"><b>100</b></td><td></td></tr></tfoot>
    </table>
  </div>
</section>

<section class="band" id="rules">
  <div class="wrap">
    ${secHead("05 · Правила", "Три правила оценивания")}
    <ol class="rule-list">${policy}</ol>
  </div>
</section>

<section class="band band--tint" id="faq">
  <div class="wrap">
    ${secHead("06 · Вопросы", "Частые вопросы")}
    <div class="qa-list">${qaList(faq)}</div>
  </div>
</section>`;

  return layout({
    title: `Дисциплина · ${meta.title}`,
    description: `${meta.title}: паспорт дисциплины, ритм 90 минут, оценивание на 100 баллов, правила и ответы на вопросы.`,
    active: "discipline",
    body,
    pagePath: "course/",
    accent: PAGE_ACCENT.discipline,
  });
}

// ---------------------------------------------------------------- methodology

function methodologyPage() {
  const tacts = methodology.tacts.map((t) => `<li><span class="tact-time">${e(t.time)}</span><h3>${e(t.title)}</h3><p>${e(t.text)}</p></li>`).join("");
  const levels = methodology.icap.levels.map((l) => `<li class="icap-level">
      <span class="icap-key">${e(l.key)}</span>
      <div><h3>${e(l.name)}</h3><p>${e(l.text)}</p><span class="icap-share">${e(l.share)}</span></div>
    </li>`).join("");
  const formats = methodology.formats.map((f, i) => `<li class="format">
      <span class="format-glyph">${formatGlyph(FORMAT_KEYS[i])}</span>
      <div class="format-body">
        <div class="format-head"><span class="format-n">${pad(i + 1)}</span><h3>${e(f.name)}</h3><span class="tag">${e(f.short)}</span></div>
        <p>${e(f.text)}</p>
        <span class="format-where">${e(f.where)}</span>
      </div>
    </li>`).join("");
  const kolb = [
    ["01", "Опыт", "Вход", "Письменный ответ на вопрос, без обсуждения. Студент достаёт из памяти то, что уже есть."],
    ["02", "Рефлексия", "Работа", "Формат семинара: что произошло, где рассыпалась цепочка, чей аргумент оказался сильнее."],
    ["03", "Концептуализация", "Рамка", "Критерии и механизм: какое объяснение выдерживает проверку, а какое только звучит убедительно."],
    ["04", "Эксперимент", "Артефакт", "Артефакт и следующий семинар: что я сделаю иначе и как это проверю."],
  ].map(([n, title, time, text]) => `<li class="kolb-step">
      <span class="kolb-n">${n}</span>
      <div><span class="kolb-time">${time}</span><h3>${title}</h3><p>${text}</p></div>
    </li>`).join("");

  const neighbors = methodology.neighbors.items.map((n) => {
    const name = n.link
      ? `<a href="${e(n.link)}" target="_blank" rel="noopener">${e(n.name)} <span aria-hidden="true">↗</span></a>`
      : `<span>${e(n.name)}</span>`;
    return `<li class="neighbor">
      <div class="neighbor-head"><h3>${name}</h3><span>${e(n.org)}</span></div>
      <p><b>Берём.</b> ${e(n.take)}</p>
      <p><b>Чего нет.</b> ${e(n.gap)}</p>
    </li>`;
  }).join("");

  const body = `${pageHead({ plate: "Методика", label: "90 минут", title: "Как устроен семинар", lead: e(methodology.lead) })}
<section class="band band--paper" id="tacts">
  <div class="wrap">
    ${secHead("01 · Такты", "Вход, работа, фиксация")}
    <ol class="tact-grid">${tacts}</ol>
  </div>
</section>

<section class="band band--tint" id="cycle">
  <div class="wrap">
    ${secHead("02 · Как мы учимся", "Цикл Колба внутри 90 минут", "Семинар устроен как один виток цикла Колба. Между семинарами виток повторяется: фиксация становится входом следующего.")}
    <ol class="kolb-grid">${kolb}</ol>
    <div class="method-reading">${methodArticles.map((a) => articleCard(a, PAGE_ACCENT.methodology)).join("")}</div>
  </div>
</section>

<section class="band" id="icap">
  <div class="wrap">
    ${secHead("03 · Шкала", e(methodology.icap.title), e(methodology.icap.text))}
    <ol class="icap-grid">${levels}</ol>
  </div>
</section>

<section class="band band--tint" id="formats">
  <div class="wrap">
    ${secHead("04 · Форматы", "Восемь форматов и где они ломаются")}
    <ol class="formats">${formats}</ol>
  </div>
</section>

<section class="band band--ink" id="thirty">
  <div class="wrap group-note">
    <p class="eyebrow eyebrow--warm">05 · 30 человек</p>
    <h2>Одна комната, один преподаватель</h2>
    <p>${e(methodology.group_note)}</p>
  </div>
</section>

<section class="band" id="neighbors">
  <div class="wrap">
    ${secHead("06 · Контекст", e(methodology.neighbors.title), e(methodology.neighbors.intro))}
    <ol class="neighbors">${neighbors}</ol>
  </div>
</section>`;

  return layout({
    title: `Методика · ${meta.title}`,
    description: "Три такта семинара, шкала ICAP, восемь форматов с точками отказа, правила для тридцати человек и соседи по жанру.",
    active: "methodology",
    body,
    pagePath: "method/",
    accent: PAGE_ACCENT.methodology,
  });
}

// ---------------------------------------------------------------- artifacts

function artifactsPage() {
  const rules = artifacts_page.rules.map((r, i) => `<li><span>${pad(i + 1)}</span><p>${e(r)}</p></li>`).join("");
  const anatomy = artifacts_page.anatomy.map((line) => {
    const m = line.match(/^([^—]+)—\s*(.*)$/);
    return `<li><span class="file">${e(m ? m[1].trim() : line)}</span>${m ? `<span class="desc">${e(m[2])}</span>` : ""}</li>`;
  }).join("");
  const submit = artifacts_page.submit.map((r, i) => `<li><span>${pad(i + 1)}</span><p>${e(r)}</p></li>`).join("");
  const slots = seminars.map((s) => {
    const t = theme(s.n);
    return `<a class="slot" href="/seminars/${s.slug}/" style="--accent:${t.accent};--soft:${t.soft}">
      <span class="slot-top"><span>Слот ${pad(s.n)}</span><code>${e(s.artifact.repo)}</code></span>
      <h3>${e(s.artifact.name)}</h3>
      <p>${e(s.title)}</p>
      <span class="slot-state">Слот пуст</span>
    </a>`;
  }).join("");

  const body = `${pageHead({ plate: "Артефакты", label: "8 репозиториев", title: "Артефакт вместо конспекта", lead: e(artifacts_page.lead) })}
<section class="band band--paper" id="rules">
  <div class="wrap">
    ${secHead("01 · Правила", "Пять правил артефакта")}
    <ol class="rule-list rule-list--lg">${rules}</ol>
  </div>
</section>

<section class="band band--ink" id="anatomy">
  <div class="wrap anatomy">
    <p class="eyebrow eyebrow--warm">02 · Анатомия</p>
    <h2>Что лежит в репозитории</h2>
    <ul class="tree tree--lg">${anatomy}</ul>
  </div>
</section>

<section class="band" id="submit">
  <div class="wrap">
    ${secHead("03 · Сдача", "Как сдавать")}
    <ol class="rule-list">${submit}</ol>
  </div>
</section>

<section class="band band--tint" id="showcase">
  <div class="wrap">
    ${secHead("04 · Витрина", "Восемь слотов", "Курс ещё не читался. Витрина пустая: места под первые работы, без вымышленных проектов.")}
    <div class="slots">${slots}</div>
  </div>
</section>`;

  return layout({
    title: `Артефакты · ${meta.title}`,
    description: "Правила артефактов, анатомия репозитория и восемь пустых слотов витрины: курс ещё не читался.",
    active: "artifacts",
    body,
    pagePath: "artifacts/",
    accent: PAGE_ACCENT.artifacts,
  });
}

// ---------------------------------------------------------------- literature

function literaturePage() {
  const covers = seminars.map((s) => `<a class="book-link" href="/seminars/${s.slug}/" aria-label="Семинар ${pad(s.n)}: ${e(s.title)}">${bookCover(s.reading[0], s)}</a>`).join("");
  const groups = seminars.map((s) => `<section class="lit-group" id="s${s.n}">
    <div class="lit-head">
      <div><p class="eyebrow"><span class="tick" aria-hidden="true"></span>Семинар ${pad(s.n)} · ${e(s.week)}</p><h2><a href="/seminars/${s.slug}/">${e(s.title)} <span aria-hidden="true">→</span></a></h2></div>
      <p class="lit-place">${e(s.place)}</p>
    </div>
    ${readingBlock(s)}
  </section>`).join("");

  const body = `${pageHead({ plate: "Литература", label: `${readingCount} источника и 10 статей`, title: "Что читать к каждому кейсу", lead: "Три источника и открытая статья на каждый кейс. У статей указаны авторы и короткая справка, у книг — пометка о доступе." })}
<section class="band band--paper" id="core">
  <div class="wrap">
    ${secHead("01 · Основное", "Восемь книг", "Первый источник каждого кейса. Обложки собраны типографикой, без чужих изображений.")}
    <div class="book-grid">${covers}</div>
  </div>
</section>

<section class="band band--tint" id="articles">
  <div class="wrap">
    ${secHead("02 · Статьи", "Открытые статьи", "Восемь статей к кейсам и две про методику. Все доступны на КиберЛенинке.")}
    <div class="article-grid">${extra.articles.map((a) => articleCard(a)).join("")}</div>
  </div>
</section>

<section class="band band--paper" id="note">
  <div class="wrap access-note">
    <p class="eyebrow">03 · Доступ</p>
    <p>Ссылка ведёт туда, где источник опубликован. Два издания выходят без открытой ссылки: они помечены «закрытый доступ · в библиотеке». Мы не подменяем их ссылками на неофициальные копии.</p>
  </div>
</section>

<div class="wrap lit-list">${groups}</div>`;

  return layout({
    title: `Литература · ${meta.title}`,
    description: `Все ${readingCount} источника и 10 открытых статей курса «${meta.title}» по кейсам, с аннотациями, авторами и пометкой о доступе.`,
    active: "literature",
    body,
    pagePath: "reading/",
    accent: PAGE_ACCENT.literature,
  });
}

// ---------------------------------------------------------------- 404

function notFoundPage() {
  const body = `${mapSprite()}
${pageHead({ plate: "Ошибка 404", label: "Нет такой точки", title: "Такой точки на карте нет", lead: "Адрес не совпал ни с одной страницей курса. Ниже — восемь кейсов, из которых состоит сайт." })}
<section class="band band--ink">
  <div class="wrap">
    <div class="actions">
      <a class="btn btn--cream" href="/">На главную</a>
      <a class="btn btn--ghost-light" href="/seminars/">Все кейсы</a>
    </div>
    <div class="notfound-map">${worldStage("/")}</div>
  </div>
</section>`;

  return layout({
    title: `Страница не найдена · ${meta.title}`,
    description: "Страница не найдена. Восемь кейсов, методика, артефакты и литература курса.",
    active: "",
    body,
    pagePath: "404.html",
    accent: PAGE_ACCENT.error,
  });
}

// ---------------------------------------------------------------- write

fs.rmSync(OUT, { recursive: true, force: true });

const pages = [
  ["index.html", homePage()],
  ["course/index.html", disciplinePage()],
  ["seminars/index.html", seminarsPage()],
  ["method/index.html", methodologyPage()],
  ["artifacts/index.html", artifactsPage()],
  ["reading/index.html", literaturePage()],
  ...seminars.map((s) => [`seminars/${s.slug}/index.html`, seminarPage(s)]),
  ["404.html", notFoundPage()],
];

for (const [file, html] of pages) {
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

fs.mkdirSync(path.join(OUT, "assets", "fonts"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(OUT, "assets", "styles.css"));
fs.copyFileSync(path.join(ROOT, "src", "app.js"), path.join(OUT, "assets", "app.js"));
fs.copyFileSync(path.join(ROOT, "assets", "fonts.css"), path.join(OUT, "assets", "fonts.css"));
for (const f of fs.readdirSync(path.join(ROOT, "assets", "fonts"))) {
  if (f.endsWith(".woff2")) fs.copyFileSync(path.join(ROOT, "assets", "fonts", f), path.join(OUT, "assets", "fonts", f));
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0C1E2A"/><circle cx="32" cy="30" r="17" fill="none" stroke="#F6F1E7" stroke-width="2.4"/><path d="M15 30h34M32 13c8 8 8 26 0 34M32 13c-8 8-8 26 0 34" stroke="#F6F1E7" stroke-width="1.5" opacity=".55" fill="none"/><circle cx="43" cy="18" r="6" fill="#C24B2A" stroke="#0C1E2A" stroke-width="2.5"/></svg>`;
fs.writeFileSync(path.join(OUT, "favicon.svg"), favicon);

const routes = [
  "", "course/", "seminars/", ...seminars.map((s) => `seminars/${s.slug}/`),
  "method/", "artifacts/", "reading/",
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((r) => `  <url><loc>${SITE}/${r}</loc></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

const bytes = pages.reduce((n, [f]) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${pages.length} pages, ${(bytes / 1024).toFixed(1)} KB of HTML`);
for (const [file] of pages) console.log(" ", file);
