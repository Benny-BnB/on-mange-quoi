import { readFileSync } from 'node:fs';
import { parseFolder, checkExtraction } from '../shared/folder-parser.js';
const slug = process.argv[2] || 'w45-2026-fr';
const pages = JSON.parse(readFileSync(new URL(`../data/folders/${slug}.pages.json`, import.meta.url), 'utf8'));
const parsed = parseFolder(pages, { slug });
console.log('validité', parsed.validity, '| articles', parsed.items.length);
console.log(JSON.stringify(checkExtraction(parsed, pages)));
const only = process.argv[3];
for (const i of parsed.items) {
  if (only === 'food' && !i.ingredientId) continue;
  console.log(`p${i.page} [${i.confidence[0]}] ${(i.brand ? i.brand + ' | ' : '')}${i.name.slice(0, 55)} → ${i.ingredientId ?? '-'} | fmt ${i.format ? i.format.qty + i.format.unit : '?'} n${i.n} ${i.normal ?? '?'}→${i.promo ?? '?'} ${i.mechanic ?? '?'} ${i.perUnit ? i.perUnit.value + '/' + i.perUnit.unit : ''}`);
}
