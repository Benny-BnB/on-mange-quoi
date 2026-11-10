// Assemble les modules (artifact/src + shared) en UNE page HTML autonome : `node artifact/build.js` → artifact/index.html
// Mini-assembleur sans dépendance : chaque module devient une fonction, imports/exports sont réécrits.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'artifact', 'src');
const SHARED = join(ROOT, 'shared');

const resolveSpec = (from, spec) => {
  if (spec.startsWith('/shared/')) return join(SHARED, spec.slice('/shared/'.length));
  if (spec.startsWith('/js/')) return join(SRC, spec.slice('/js/'.length));
  return resolve(dirname(from), spec);
};
const idOf = (file) => relative(ROOT, file).replace(/\\/g, '/');

const mods = new Map(); // file → { id, code, deps }
const order = [];
const visiting = new Set();

function load(file) {
  if (mods.has(file)) return mods.get(file);
  if (visiting.has(file)) throw new Error(`Dépendance circulaire : ${idOf(file)}`);
  visiting.add(file);
  let code = readFileSync(file, 'utf8');
  const exports = [];
  const deps = [];

  // import { a, b as c } from 'x'  |  import * as X from 'x'
  code = code.replace(/^import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm, (_, what, spec) => {
    const dep = load(resolveSpec(file, spec));
    deps.push(dep);
    const ns = what.match(/^\*\s+as\s+(\w+)$/);
    if (ns) return `const ${ns[1]} = __M[${JSON.stringify(dep.id)}];`;
    const names = what.replace(/^\{|\}$/g, '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(\w+)\s+as\s+(\w+)$/); return m ? `${m[1]}: ${m[2]}` : x; });
    return `const { ${names.join(', ')} } = __M[${JSON.stringify(dep.id)}];`;
  });
  // export const|let|function|async function|class
  code = code.replace(/^export\s+(const|let|var|function\*?|async\s+function|class)\s+(\w+)/gm, (_, kind, name) => { exports.push(name); return `${kind} ${name}`; });
  // export { a, b }
  code = code.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_, list) => { for (const x of list.split(',').map((s) => s.trim()).filter(Boolean)) exports.push(x.replace(/\s+as\s+.*/, '')); return ''; });
  if (/^\s*import\s*\(|^\s*export\s+default|^\s*export\s+\*/m.test(code)) throw new Error(`Syntaxe non gérée dans ${idOf(file)}`);
  if (/^\s*(import|export)\s/m.test(code)) throw new Error(`import/export non réécrit dans ${idOf(file)}`);

  const id = idOf(file);
  const mod = { id, deps, code: `__M[${JSON.stringify(id)}] = (() => {\n${code}\nreturn { ${[...new Set(exports)].join(', ')} };\n})();\n` };
  visiting.delete(file);
  mods.set(file, mod);
  order.push(mod);
  return mod;
}

load(join(SRC, 'main.js'));
let js = `'use strict';\nconst __M = {};\n${order.map((m) => `// ---- ${m.id}\n${m.code}`).join('\n')}`;
js = js.replace(/<\/script/gi, '<\\/script'); // ne jamais refermer la balise par erreur

const tpl = readFileSync(join(ROOT, 'artifact', 'template.html'), 'utf8');
const css = readFileSync(join(ROOT, 'artifact', 'style.css'), 'utf8');
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
writeFileSync(join(ROOT, 'artifact', 'index.html'), html);
writeFileSync(join(ROOT, 'artifact', 'bundle.js'), js); // pour `node --check`
console.log(`artifact/index.html : ${(html.length / 1024).toFixed(0)} Ko, ${order.length} modules`);
