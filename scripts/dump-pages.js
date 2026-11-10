// Dev helper: lit spreads.json du folder Delhaize (Publitas) et écrit le texte par page.
const slug = process.argv[2] || 'w45-2026-fr';
const url = `https://view.publitas.com/delhaize-belgium/${slug}/spreads.json`;
const r = await fetch(url, { headers: { 'user-agent': 'on-mange-quoi/0.1 (usage personnel)' } });
console.log('HTTP', r.status, r.headers.get('content-type'));
const spreads = await r.json();
const pages = spreads.flatMap((s) => s.pages).map((p, i) => ({ n: i + 1, text: p.text || '' }));
import { writeFileSync } from 'node:fs';
writeFileSync(new URL(`../data/folders/${slug}.pages.json`, import.meta.url), JSON.stringify(pages, null, 1));
console.log('pages', pages.length, 'chars', pages.reduce((a, p) => a + p.text.length, 0));
