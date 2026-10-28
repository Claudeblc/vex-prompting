// Suivi de la lecture à la voix : on compare ce que la reconnaissance vocale
// entend aux mots du script, avec de la tolérance (accords, mots avalés,
// erreurs de transcription), et la position n'avance jamais toute seule.

import type { ScriptWord } from './text';

export interface AdvanceOptions {
  /** Combien de mots on accepte de sauter quand un mot du script n'a pas été entendu. */
  lookahead: number;
  /** Fenêtre de recalage quand la personne saute un passage entier. */
  resyncWindow: number;
  /** Nombre de mots consécutifs reconnus qu'il faut pour se recaler loin devant. */
  resyncRun: number;
}

export const DEFAULT_ADVANCE: AdvanceOptions = { lookahead: 4, resyncWindow: 30, resyncRun: 3 };

const SHORT_WORD = 3;

/** Distance d'édition de Levenshtein, sur deux lignes de tableau. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

/** Retire les terminaisons muettes les plus courantes (pluriels, accords, verbes en -ent). */
function stem(word: string): string {
  if (word.length <= 4) return word;
  return word.replace(/(ent|es|s|x|e|t)$/, '');
}

/** Le mot entendu correspond-il au mot attendu ? */
export function wordsMatch(heard: string, expected: string): boolean {
  if (heard === expected) return true;
  if (heard.length === 0 || expected.length === 0) return false;
  const a = stem(heard);
  const b = stem(expected);
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return false;
  const allowed = longest >= 8 ? 2 : 1;
  return editDistance(a, b) <= allowed;
}

/**
 * Sauter des mots du script n'est permis que si le mot reconnu est assez long
 * pour ne pas être un « le » ou un « de » croisé par hasard plus loin.
 */
function canJump(words: ScriptWord[], from: number, skip: number): boolean {
  if (skip === 0) return true;
  const target = words[from + skip];
  if (!target) return false;
  if (target.norm.length > SHORT_WORD) return true;
  if (skip > 1) return false;
  const skipped = words[from];
  return skipped !== undefined && skipped.norm.length <= SHORT_WORD;
}

function matchNear(words: ScriptWord[], position: number, heard: string, lookahead: number): number {
  for (let skip = 0; skip < lookahead && position + skip < words.length; skip++) {
    const target = words[position + skip];
    if (target && wordsMatch(heard, target.norm) && canJump(words, position, skip)) {
      return position + skip + 1;
    }
  }
  return -1;
}

/** Cherche plus loin une suite de mots entendus qui se suivent aussi dans le script. */
function resync(words: ScriptWord[], position: number, recent: string[], options: AdvanceOptions): number {
  const run = recent.slice(-options.resyncRun);
  const significant = run.filter((word) => word.length > SHORT_WORD).length;
  if (run.length < options.resyncRun || significant < 1) return -1;
  const end = Math.min(words.length - run.length, position + options.resyncWindow);
  for (let start = position + 1; start <= end; start++) {
    const fits = run.every((heard, offset) => {
      const target = words[start + offset];
      return target !== undefined && wordsMatch(heard, target.norm);
    });
    if (fits) return start + run.length;
  }
  return -1;
}

/**
 * Nouvelle position dans le script après avoir entendu `heard`, en partant de `start`.
 * Un mot entendu qui ne correspond à rien (« euh », une improvisation) est ignoré :
 * sans parole reconnue, la position ne bouge pas.
 */
export function advance(
  words: ScriptWord[],
  start: number,
  heard: string[],
  options: AdvanceOptions = DEFAULT_ADVANCE,
): number {
  let position = start;
  let unmatched: string[] = [];
  for (const word of heard) {
    if (position >= words.length) break;
    const next = matchNear(words, position, word, options.lookahead);
    if (next >= 0) {
      position = next;
      unmatched = [];
      continue;
    }
    unmatched = unmatched.concat(word);
    const jumped = resync(words, position, unmatched, options);
    if (jumped >= 0) {
      position = jumped;
      unmatched = [];
    }
  }
  return position;
}
