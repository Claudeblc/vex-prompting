// Le suiveur relie la reconnaissance vocale au script : les résultats provisoires
// font avancer l'affichage, les résultats définitifs fixent le point de départ
// suivant. La position affichée ne recule jamais d'elle-même.

import { advance, DEFAULT_ADVANCE, type AdvanceOptions } from './matcher';
import { toMatchWords, type ParsedScript } from './text';

export interface FollowerState {
  /** Position fixée par les résultats définitifs. */
  committed: number;
  /** Position affichée (avance aussi avec les résultats provisoires). */
  position: number;
}

export interface FollowerStep {
  state: FollowerState;
  /** Mots du script franchis par cette mise à jour (pour la mesure de la vitesse). */
  advancedBy: number;
}

export const START: FollowerState = { committed: 0, position: 0 };

export function hear(
  script: ParsedScript,
  state: FollowerState,
  transcript: string,
  isFinal: boolean,
  options: AdvanceOptions = DEFAULT_ADVANCE,
): FollowerStep {
  const reached = advance(script.words, state.committed, toMatchWords(transcript), options);
  const position = Math.max(state.position, reached);
  const committed = isFinal ? Math.max(state.committed, position) : state.committed;
  return { state: { committed, position }, advancedBy: position - state.position };
}

/** Place la lecture au début d'une phrase (boutons, flèches, toucher). */
export function jumpToSentence(script: ParsedScript, sentence: number): FollowerState {
  const count = script.sentences.length;
  if (count === 0) return START;
  const target = script.sentences[Math.min(Math.max(sentence, 0), count - 1)];
  const position = target ? target.firstWord : 0;
  return { committed: position, position };
}

export function isFinished(script: ParsedScript, state: FollowerState): boolean {
  return script.words.length > 0 && state.position >= script.words.length;
}

/** Part lue de la phrase en cours, de 0 à 1. */
export function sentenceProgress(script: ParsedScript, sentence: number, position: number): number {
  const current = script.sentences[sentence];
  if (!current) return 0;
  const total = current.lastWord - current.firstWord + 1;
  const read = Math.min(Math.max(position - current.firstWord, 0), total);
  return total > 0 ? read / total : 1;
}
