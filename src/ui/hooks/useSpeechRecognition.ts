// Reconnaissance vocale du navigateur (Web Speech API), en français.
// Elle s'arrête d'elle-même après un silence ou une coupure : tant que l'écoute
// est voulue, on la relance.

import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative; length: number }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionErrorEvent { error: string }

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

export type ListeningStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'unsupported' | 'error';

export interface SpeechRecognitionControls {
  status: ListeningStatus;
  error: string;
  start: () => void;
  stop: () => void;
}

const RESTART_DELAY_MS = 250;

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = globalThis as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return recognitionConstructor() !== null;
}

const ERROR_TEXT: Record<string, string> = {
  network: 'La reconnaissance vocale a besoin d’une connexion internet.',
  'audio-capture': 'Aucun micro trouvé. Branchez-en un ou vérifiez les réglages.',
  'service-not-allowed': 'Ce navigateur refuse la reconnaissance vocale sur cette page.',
  'language-not-supported': 'Le français n’est pas proposé par la reconnaissance vocale de ce navigateur.',
};

/**
 * `onResult(texte, définitif)` est appelé pour chaque résultat, dans l'ordre.
 * La fonction peut changer à chaque rendu : on garde toujours la dernière.
 */
export function useSpeechRecognition(onResult: (transcript: string, isFinal: boolean) => void): SpeechRecognitionControls {
  const [status, setStatus] = useState<ListeningStatus>(() => (isSpeechRecognitionSupported() ? 'idle' : 'unsupported'));
  const [error, setError] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);
  const wantedRef = useRef(false);
  const handlerRef = useRef(onResult);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    handlerRef.current = onResult;
  }, [onResult]);

  const create = useCallback((): Recognition | null => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return null;
    const recognition = new Constructor();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result) handlerRef.current(result[0].transcript, result.isFinal);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed') {
        wantedRef.current = false;
        setStatus('denied');
        setError('Le micro est bloqué. Autorisez-le dans la barre d’adresse, puis relancez l’écoute.');
        return;
      }
      setError(Object.hasOwn(ERROR_TEXT, event.error) ? ERROR_TEXT[event.error] ?? '' : `La reconnaissance vocale s’est arrêtée (${event.error}).`);
      if (event.error !== 'network') return;
      wantedRef.current = false;
      setStatus('error');
    };
    recognition.onend = () => {
      if (!wantedRef.current) {
        setStatus((current) => (current === 'listening' || current === 'starting' ? 'idle' : current));
        return;
      }
      restartRef.current = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // déjà relancée
        }
      }, RESTART_DELAY_MS);
    };
    return recognition;
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current ?? create();
    if (!recognition) {
      setStatus('unsupported');
      return;
    }
    recognitionRef.current = recognition;
    wantedRef.current = true;
    setError('');
    setStatus('starting');
    try {
      recognition.start();
    } catch {
      // une écoute est déjà en cours : on la garde
      setStatus('listening');
    }
  }, [create]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    if (restartRef.current) clearTimeout(restartRef.current);
    recognitionRef.current?.stop();
    setStatus((current) => (current === 'unsupported' ? current : 'idle'));
  }, []);

  useEffect(() => () => {
    wantedRef.current = false;
    if (restartRef.current) clearTimeout(restartRef.current);
    recognitionRef.current?.abort();
  }, []);

  return { status, error, start, stop };
}
