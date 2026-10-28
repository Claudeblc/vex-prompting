import { describe, expect, it } from 'vitest';
import { clampTarget, estimateSeconds, formatDuration, measureWpm, paceVerdict, trimSamples } from './pace';

describe('vitesse de parole', () => {
  it('ne donne pas de chiffre avec trop peu de mots', () => {
    expect(measureWpm([], 10_000)).toBeNull();
    expect(measureWpm([{ at: 0, words: 2 }], 1_000)).toBeNull();
  });

  it('mesure exactement 140 mots par minute à un mot toutes les 429 ms', () => {
    const interval = 60_000 / 140;
    const samples = Array.from({ length: 36 }, (_, i) => ({ at: 1_000 + i * interval, words: 1 }));
    expect(measureWpm(samples, 1_000 + 35 * interval)).toBe(140);
  });

  it('fait baisser la mesure pendant un silence', () => {
    const interval = 60_000 / 140;
    const samples = Array.from({ length: 36 }, (_, i) => ({ at: 1_000 + i * interval, words: 1 }));
    expect(measureWpm(samples, 1_000 + 35 * interval + 3_000)).toBeLessThan(120);
  });

  it('ne juge plus la vitesse après une vraie pause', () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({ at: i * 400, words: 1 }));
    expect(measureWpm(samples, 3_600 + 4_500)).toBeNull();
  });

  it('applique un plancher de durée au tout début', () => {
    const samples = [{ at: 0, words: 1 }, { at: 200, words: 4 }];
    expect(measureWpm(samples, 500)).toBe(60);
  });

  it('oublie ce qui sort de la fenêtre glissante', () => {
    const samples = [{ at: 0, words: 50 }, { at: 25_000, words: 1 }, { at: 30_000, words: 5 }];
    expect(trimSamples(samples, 31_000)).toHaveLength(2);
    expect(measureWpm(samples, 31_000)).toBe(50);
  });

  it('donne le verdict autour de la cible', () => {
    expect(paceVerdict(null, 140)).toBeNull();
    expect(paceVerdict(100, 140)).toBe('slow');
    expect(paceVerdict(140, 140)).toBe('good');
    expect(paceVerdict(155, 140)).toBe('good');
    expect(paceVerdict(170, 140)).toBe('fast');
  });

  it('borne la cible réglable', () => {
    expect(clampTarget(40)).toBe(90);
    expect(clampTarget(500)).toBe(200);
    expect(clampTarget(Number.NaN)).toBe(140);
  });

  it('estime et écrit les durées', () => {
    expect(estimateSeconds(280, 140)).toBe(120);
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min 05 s');
  });
});
