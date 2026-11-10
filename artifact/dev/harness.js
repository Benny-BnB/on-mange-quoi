// Banc d'essai : simule `window.claude.use('db')` (stockage sur le petit serveur de dev, écoute par interrogation).
(() => {
  const call = (path, body) => fetch('/__db/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const snapDoc = (d) => ({ id: d.id, exists: true, data: () => d.body, metadata: { fromCache: false, hasPendingWrites: false } });
  const collection = (c) => ({
    path: c,
    async get() { const docs = (await call('list', { c })).docs.map(snapDoc); return { docs, size: docs.length, empty: !docs.length, metadata: {} }; },
    onSnapshot(next, err) {
      let last = null, stopped = false;
      const tick = async () => {
        if (stopped) return;
        try {
          const out = await call('list', { c });
          const s = JSON.stringify(out.docs);
          if (s !== last) { last = s; const docs = out.docs.map(snapDoc); next({ docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }); }
        } catch (e) { err?.({ code: 'unavailable', message: String(e) }); }
        setTimeout(tick, 400);
      };
      tick();
      return () => { stopped = true; };
    },
    doc(id) { return doc(`${c}/${id}`); },
  });
  const doc = (path) => ({
    path, id: path.split('/').pop(),
    set: (body) => call('set', { path, body }).then(() => {}),
    delete: () => call('delete', { path }).then(() => {}),
    async get() { const d = (await call('get', { path })).doc; return d ? snapDoc(d) : { exists: false, data: () => undefined }; },
  });
  const db = { doc, collection };
  window.__sampleCalls = [];
  window.claude = {
    use: async (name) => {
      if (name === 'db' && !location.search.includes('nodb')) return db;
      if (name === 'user') return { can: async () => !location.search.includes('ro'), isOwner: () => !location.search.includes('ro') };
      if (name === 'downloads') return { save: async (r) => { window.__download = r; return { status: 'saved' }; } };
      if (name === 'sample') {
        const f = async (input) => { window.__sampleCalls.push(input); return { text: '{}' }; };
        f.json = async (input) => {
          window.__sampleCalls.push(input);
          return { name: 'Poêlée express du frigo', emoji: '🥘', prep: 5, cook: 10, diff: 'facile', eq: ['plaques'], ing: [{ id: 'pates', q: 90 }, { id: 'champignons', q: 100 }, { id: 'huile-olive', q: 5 }], steps: [{ t: 'Cuire les pâtes.', timer: 9 }, { t: 'Poêler les champignons.' }], keep: '2 jours au frigo' };
        };
        return f;
      }
      return null;
    },
  };
})();
