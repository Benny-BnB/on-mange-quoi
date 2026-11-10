// Chiffrement des promos publiées sur le site (AES-GCM 256, clé dérivée d'un « code du foyer » par PBKDF2-SHA256).
// Le site est public (GitHub Pages) mais le contenu du folder Delhaize ne doit pas l'être : usage strictement personnel.
// Fonctionne à l'identique dans le navigateur et dans Node (WebCrypto).
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const deriveKey = async (pass, salt, iterations) => {
  const base = await crypto.subtle.importKey('raw', enc.encode(String(pass).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

/** Chiffre un objet JSON. Sel et vecteur d'initialisation aléatoires à chaque appel. */
export async function seal(obj, pass, { iterations = 250000 } = {}) {
  if (!pass) throw new Error('Code du foyer manquant');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** Déchiffre ; lève « Code incorrect » si la clé ne convient pas ou si le fichier est altéré. */
export async function open(sealed, pass) {
  if (!sealed || sealed.v !== 1) throw new Error('Format de fichier inconnu');
  if (!pass) throw new Error('Code du foyer manquant');
  try {
    const key = await deriveKey(pass, unb64(sealed.salt), sealed.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new Error('Code incorrect');
  }
}
