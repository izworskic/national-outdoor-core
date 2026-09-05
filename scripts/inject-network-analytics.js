"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "public");
const measurementId = "G-Y5D2V2W7HN";
const marker = "<!-- network-ga4 -->";
const snippet = `${marker}\n<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId}');</script>`;

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.isFile() && entry.name.endsWith(".html") ? [full] : [];
  });
}

function inject(file) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(measurementId)) return false;
  if (!/<\/head>/i.test(html)) throw new Error(`Cannot inject GA4: missing </head> in ${path.relative(root, file)}`);
  html = html.replace(/<\/head>/i, `${snippet}\n</head>`);
  fs.writeFileSync(file, html);
  return true;
}

const files = htmlFiles(root);
let changed = 0;
for (const file of files) if (inject(file)) changed += 1;
for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes(measurementId)) throw new Error(`GA4 coverage missing: ${path.relative(root, file)}`);
}
console.log(`Network analytics verified on ${files.length} HTML file(s); injected ${changed}.`);
