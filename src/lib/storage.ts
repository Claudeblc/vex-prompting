// Stockage dans le navigateur de la personne, et nulle part ailleurs.
// Tout accès peut échouer (navigation privée, stockage bloqué) : on retombe alors
// sur les valeurs par défaut sans casser l'application.

import { z } from 'zod';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'vex-prompting:';

function browserStore(kind: 'local' | 'session'): KeyValueStore | null {
  try {
    return kind === 'local' ? globalThis.localStorage ?? null : globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, schema: z.ZodType<T>, fallback: T, store: KeyValueStore | null = browserStore('local')): T {
  try {
    const raw = store?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, store: KeyValueStore | null = browserStore('local')): boolean {
  try {
    store?.setItem(PREFIX + key, JSON.stringify(value));
    return store !== null;
  } catch {
    return false;
  }
}

const API_KEY = 'cle-ia:';
const API_KEY_PATTERN = /^[\x21-\x7e]{8,300}$/;

export function isPlausibleKey(value: string): boolean {
  return API_KEY_PATTERN.test(value.trim());
}

/**
 * La clé d'un fournisseur : dans le stockage local si la personne veut la garder, sinon pour cet onglet seulement.
 * Chaque fournisseur a sa propre clé : changer de fournisseur n'envoie jamais la clé d'un autre.
 */
export function saveApiKey(provider: string, value: string, remember: boolean, stores = { local: browserStore('local'), session: browserStore('session') }): boolean {
  const key = value.trim();
  if (!isPlausibleKey(key)) return false;
  forgetApiKey(provider, stores);
  try {
    const target = remember ? stores.local : stores.session;
    target?.setItem(PREFIX + API_KEY + provider, key);
    return target !== null;
  } catch {
    return false;
  }
}

export function loadApiKey(provider: string, stores = { local: browserStore('local'), session: browserStore('session') }): string {
  for (const store of [stores.session, stores.local]) {
    try {
      const value = store?.getItem(PREFIX + API_KEY + provider);
      if (value && isPlausibleKey(value)) return value;
    } catch {
      // stockage indisponible : on essaie le suivant
    }
  }
  return '';
}

export function forgetApiKey(provider: string, stores = { local: browserStore('local'), session: browserStore('session') }): void {
  for (const store of [stores.local, stores.session]) {
    try {
      store?.removeItem(PREFIX + API_KEY + provider);
    } catch {
      // rien à effacer
    }
  }
}

/** « …a1b2 » : de quoi reconnaître sa clé sans la montrer à l'écran, même en live. */
export function maskKey(value: string): string {
  const key = value.trim();
  if (key.length < 20) return '';
  return `…${key.slice(-4)}`;
}
