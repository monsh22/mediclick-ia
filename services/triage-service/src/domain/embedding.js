// ===== DOMINIO: embeddings locales =====
// Convierte texto en un vector de 256 números ("hashing trick") para el RAG.
// Funciona sin internet ni API keys. Se guarda en PostgreSQL con pgvector.
import { normalize } from './redFlags.js';

export const DIMS = 1536;

const STOP = new Set('de la el los las un una y o a en con por para mi me se que es muy tengo siento desde hace del al lo le su mas ya pero como estoy tiene hola buenas dias tardes noches cuando'.split(' '));

// Sinónimos frecuentes para que "me duele" se parezca a "dolor", etc.
const SYN = { duele: 'dolor', duelen: 'dolor', dolio: 'dolor', adolorido: 'dolor', veo: 'vision', ver: 'vision', nino: 'hijo', nina: 'hijo', hija: 'hijo', bebe: 'hijo', panza: 'estomago', barriga: 'estomago', ansioso: 'ansiedad', ansiosa: 'ansiedad', estresado: 'estres', estresada: 'estres', triste: 'tristeza', granitos: 'granos' };

function hash(str, seed = 2166136261) {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Palabras muy comunes en todos los documentos: pesan menos (idea de IDF)
const LOW = new Set(['dolor', 'fuerte', 'mucho', 'frecuente', 'leve']);

export function embed(text) {
  const words = normalize(text).replace(/[^a-z0-9ñ ]/g, ' ').split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => SYN[w] || w);
  const v = new Array(DIMS).fill(0);
  // Cada token cae en 2 posiciones distintas: si choca en una, la otra lo distingue
  const add = (tok, w) => {
    v[hash(tok) % DIMS] += w;
    v[hash(tok, 374761393) % DIMS] += w;
  };
  words.forEach((w, i) => {
    const weight = LOW.has(w) ? 0.25 : 1;
    add(w, weight);                              // palabra completa
    if (w.length > 4) add(`#${w.slice(0, 5)}`, 0.8 * weight); // raíz (borroso ~ borrosa)
    if (words[i + 1]) add(`${w}_${words[i + 1]}`, 0.3); // bigramas
  });
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => +(x / norm).toFixed(5));
}

export const toPgVector = (v) => `[${v.join(',')}]`;
