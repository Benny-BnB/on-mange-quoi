// Assemble la version statique : `node site/build.js` → docs/ (publié par GitHub Pages, branche principale, dossier /docs).
// Les modules (site/src + shared) sont fusionnés en UN SEUL fichier app.js (chemins relatifs : fonctionne à la racine d'un domaine
// comme dans un sous-dossier github.io/<dépôt>/). Les dossiers docs/data (promos) et le fichier docs/CNAME ne sont jamais touchés.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'site', 'src');
const SHARED = join(ROOT, 'shared');
const STATIC = join(ROOT, 'site', 'static');
const OUT = join(ROOT, 'docs');

const resolveSpec = (from, spec) => {
  if (spec.startsWith('/shared/')) return join(SHARED, spec.slice('/shared/'.length));
  if (spec.startsWith('/js/')) return join(SRC, spec.slice('/js/'.length));
  return resolve(dirname(from), spec);
};
const idOf = (file) => relative(ROOT, file).replace(/\\/g, '/');
const mods = new Map();
const order = [];
const visiting = new Set();

function load(file) {
  if (mods.has(file)) return mods.get(file);
  if (visiting.has(file)) throw new Error(`Dépendance circulaire : ${idOf(file)}`);
  visiting.add(file);
  let code = readFileSync(file, 'utf8');
  const exports = [];
  code = code.replace(/^import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm, (_, what, spec) => {
    const dep = load(resolveSpec(file, spec));
    const ns = what.match(/^\*\s+as\s+(\w+)$/);
    if (ns) return `const ${ns[1]} = __M[${JSON.stringify(dep.id)}];`;
    const names = what.replace(/^\{|\}$/g, '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(\w+)\s+as\s+(\w+)$/); return m ? `${m[1]}: ${m[2]}` : x; });
    return `const { ${names.join(', ')} } = __M[${JSON.stringify(dep.id)}];`;
  });
  code = code.replace(/^export\s+(const|let|var|function\*?|async\s+function|class)\s+(\w+)/gm, (_, kind, name) => { exports.push(name); return `${kind} ${name}`; });
  code = code.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_, list) => { for (const x of list.split(',').map((s) => s.trim()).filter(Boolean)) exports.push(x.replace(/\s+as\s+.*/, '')); return ''; });
  if (/^\s*export\s+default|^\s*export\s+\*|^\s*import\s*\(/m.test(code) || /^\s*(import|export)\s/m.test(code)) throw new Error(`import/export non géré dans ${idOf(file)}`);
  const id = idOf(file);
  const mod = { id, code: `__M[${JSON.stringify(id)}] = (() => {\n${code}\nreturn { ${[...new Set(exports)].join(', ')} };\n})();\n` };
  visiting.delete(file);
  mods.set(file, mod);
  order.push(mod);
  return mod;
}

load(join(SRC, 'main.js'));
const js = `'use strict';\nconst __M = {};\n${order.map((m) => `// ---- ${m.id}\n${m.code}`).join('\n')}`;
const build = createHash('sha1').update(js).update(readFileSync(join(STATIC, 'styles.css'))).digest('hex').slice(0, 10);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'app.js'), js);
writeFileSync(join(OUT, 'styles.css'), readFileSync(join(STATIC, 'styles.css')));
writeFileSync(join(OUT, 'index.html'), readFileSync(join(STATIC, 'index.html'), 'utf8').replace(/__BUILD__/g, build));
writeFileSync(join(OUT, 'sw.js'), readFileSync(join(STATIC, 'sw.js'), 'utf8').replace(/__BUILD__/g, build));
writeFileSync(join(OUT, 'manifest.webmanifest'), readFileSync(join(STATIC, 'manifest.webmanifest')));
writeFileSync(join(OUT, '.nojekyll'), '');
cpSync(join(STATIC, 'icons'), join(OUT, 'icons'), { recursive: true });
console.log(`docs/ : app.js ${(js.length / 1024).toFixed(0)} Ko, ${order.length} modules, version ${build}${existsSync(join(OUT, 'CNAME')) ? ', CNAME conservé' : ''}`);
