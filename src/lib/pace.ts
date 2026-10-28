// Vitesse de parole, en mots par minute : la cible, la mesure sur les dernières
// secondes, et le verdict « trop lent / bon rythme / trop vite ».

export type PaceVerdict = 'slow' | 'good' | 'fast';

export interface PaceSample {
  /** Instant de la mesure, en millisecondes. */
  at: number;
  /** Mots du script franchis à cet instant. */
  words: number;
}

/** Rythme conseillé pour une vidéo face caméra en français. */
export const DEFAULT_TARGET_WPM = 140;
export const TARGET_RANGE = { min: 90, max: 200 } as const;
/** Écart toléré autour de la cible avant de dire « trop lent » ou « trop vite ». */
export const DEFAULT_TOLERANCE = 0.12;

const WINDOW_MS = 20_000;
const MIN_SPAN_MS = 4_000;
const MIN_WORDS = 4;
/** Au-delà de ce silence, la personne fait une pause : on ne juge plus sa vitesse. */
const PAUSE_MS = 4_000;

/** Ne garde que les mesures encore utiles à la fenêtre glissante. */
export function trimSamples(samples: PaceSample[], now: number, windowMs = WINDOW_MS): PaceSample[] {
  return samples.filter((sample) => now - sample.at <= windowMs);
}

/**
 * Mots par minute sur les `windowMs` dernières millisecondes. La durée va du premier
 * relevé de la fenêtre jusqu'à maintenant ; les mots de ce premier relevé, dits avant
 * lui, ne comptent pas. Un plancher de durée évite un chiffre absurde au démarrage,
 * et un silence fait baisser la mesure. `null` tant qu'il y a trop peu à mesurer.
 */
export function measureWpm(samples: PaceSample[], now: number, windowMs = WINDOW_MS): number | null {
  const recent = trimSamples(samples, now, windowMs);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || now - last.at > PAUSE_MS) return null;
  const words = recent.reduce((sum, sample) => sum + sample.words, 0) - first.words;
  if (words < MIN_WORDS) return null;
  const span = Math.max(now - first.at, MIN_SPAN_MS);
  return Math.round((words / span) * 60_000);
}

export function paceVerdict(wpm: number | null, target: number, tolerance = DEFAULT_TOLERANCE): PaceVerdict | null {
  if (wpm === null) return null;
  if (wpm < target * (1 - tolerance)) return 'slow';
  if (wpm > target * (1 + tolerance)) return 'fast';
  return 'good';
}

export const VERDICT_LABEL: Record<PaceVerdict, string> = {
  slow: 'Trop lent',
  good: 'Bon rythme',
  fast: 'Trop vite',
};

export function clampTarget(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TARGET_WPM;
  return Math.round(Math.min(Math.max(value, TARGET_RANGE.min), TARGET_RANGE.max));
}

/** Durée de lecture estimée, en secondes, au rythme visé. */
export function estimateSeconds(wordCount: number, targetWpm: number): number {
  if (wordCount <= 0 || targetWpm <= 0) return 0;
  return Math.round((wordCount / targetWpm) * 60);
}

/** « 45 s », « 2 min 05 s ». */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe} s`;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${String(rest).padStart(2, '0')} s`;
}
