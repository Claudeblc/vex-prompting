// Petits services du navigateur : état mémorisé, presse-papiers, écran allumé, synthèse vocale.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { pickFrenchVoice } from '../../lib/prompts';
import { readJson, writeJson } from '../../lib/storage';

/** Un état React gardé dans le stockage local, relu et validé au chargement. */
export function useStoredState<T>(key: string, schema: z.ZodType<T>, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readJson(key, schema, fallback));
  const update = useCallback((next: T) => {
    setValue(next);
    writeJson(key, next);
  }, [key]);
  return [value, update];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Un bouton « Copier » qui dit pendant deux secondes si la copie a marché. */
export function useCopy(): [string, (id: string, text: string) => void] {
  const [copied, setCopied] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = useCallback((id: string, text: string) => {
    void copyText(text).then((ok) => {
      setCopied(ok ? id : `${id}:erreur`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(''), 2000);
    });
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [copied, copy];
}

interface WakeLockSentinelLike { release(): Promise<void> }

/** Garde l'écran allumé tant que `active` est vrai (téléphone posé pendant un tournage). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!active || !wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    wakeLock.request('screen').then((lock) => {
      if (cancelled) void lock.release();
      else sentinel = lock;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

export interface SpeechSynthesisControls {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  speaking: boolean;
  speak: (text: string) => void;
  cancel: () => void;
}

/** Synthèse vocale du navigateur, gratuite, sur la sortie audio par défaut (lunettes, écouteurs). */
export function useSpeechSynthesis(voiceName: string, rate: number): SpeechSynthesisControls {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('fr')));
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || text.trim().length === 0) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    const voice = pickFrenchVoice(window.speechSynthesis.getVoices(), voiceName);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [supported, voiceName, rate]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, voices, speaking, speak, cancel };
}
