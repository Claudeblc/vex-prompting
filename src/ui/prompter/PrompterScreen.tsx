import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { hear, isFinished as scriptFinished, jumpToSentence, START, type FollowerState } from '../../lib/follower';
import { clampTarget, estimateSeconds, measureWpm, paceVerdict, trimSamples, type PaceSample, TARGET_RANGE } from '../../lib/pace';
import { parseScript, sentenceAt } from '../../lib/text';
import { useStoredState, useWakeLock } from '../hooks/browser';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { ListenStatus } from '../ListenStatus';
import { PacePanel } from './PacePanel';
import { Stage } from './Stage';

type Props = {
  scriptText: string;
  onScriptChange: (text: string) => void;
  targetWpm: number;
  onTargetChange: (value: number) => void;
};

const SIZE = { min: 28, max: 120, step: 4, fallback: 52 } as const;
const TICK_MS = 1000;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName));
}

export function PrompterScreen({ scriptText, onScriptChange, targetWpm, onTargetChange }: Props) {
  const script = useMemo(() => parseScript(scriptText), [scriptText]);
  const [follow, setFollow] = useState<FollowerState>(START);
  const followRef = useRef<FollowerState>(START);
  const samplesRef = useRef<PaceSample[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [size, setSize] = useStoredState('taille', z.number().min(SIZE.min).max(SIZE.max), SIZE.fallback);
  const [isMirrored, setMirrored] = useStoredState('miroir', z.boolean(), false);
  const [isStageOpen, setStageOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const place = useCallback((state: FollowerState) => {
    followRef.current = state;
    setFollow(state);
  }, []);

  const onResult = useCallback((transcript: string, isFinal: boolean) => {
    const step = hear(script, followRef.current, transcript, isFinal);
    if (step.advancedBy > 0) {
      const at = Date.now();
      samplesRef.current = [...trimSamples(samplesRef.current, at), { at, words: step.advancedBy }];
    }
    place(step.state);
  }, [script, place]);

  const listening = useSpeechRecognition(onResult);
  const isListening = listening.status === 'listening' || listening.status === 'starting';
  useWakeLock(isListening || isStageOpen);

  useEffect(() => {
    if (!isListening) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  const sentence = Math.max(sentenceAt(script, follow.position), 0);
  const finished = scriptFinished(script, follow);
  const wpm = isListening ? measureWpm(samplesRef.current, now) : null;
  const verdict = paceVerdict(wpm, targetWpm);
  const remainingSeconds = estimateSeconds(Math.max(script.words.length - follow.position, 0), targetWpm);

  const goTo = useCallback((index: number) => place(jumpToSentence(script, index)), [script, place]);
  const restart = useCallback(() => {
    samplesRef.current = [];
    place(START);
  }, [place]);

  const { start: startListening, stop: stopListening } = listening;
  const toggleListening = useCallback(() => (isListening ? stopListening() : startListening()), [isListening, startListening, stopListening]);

  const openStage = useCallback(() => {
    setStageOpen(true);
    const element = stageRef.current;
    if (element?.requestFullscreen) void element.requestFullscreen().catch(() => undefined);
  }, []);

  const closeStage = useCallback(() => {
    setStageOpen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setStageOpen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const actions: Record<string, () => void> = {
        ' ': toggleListening,
        ArrowRight: () => goTo(sentence + 1),
        ArrowDown: () => goTo(sentence + 1),
        ArrowLeft: () => goTo(sentence - 1),
        ArrowUp: () => goTo(sentence - 1),
        Escape: closeStage,
        m: () => setMirrored(!isMirrored),
        f: () => (isStageOpen ? closeStage() : openStage()),
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleListening, goTo, sentence, closeStage, openStage, isStageOpen, isMirrored, setMirrored]);

  const changeScript = (text: string) => {
    onScriptChange(text);
    samplesRef.current = [];
    place(START);
  };

  const listenLabel = isListening ? 'Arrêter l’écoute' : 'Démarrer l’écoute';

  return (
    <div className="screen">
      <div className="title-row">
        <div>
          <h1>Téléprompteur</h1>
          <ListenStatus status={listening.status} error={listening.error} idleText="Cliquez sur « Démarrer l’écoute », autorisez le micro, puis lisez à voix haute." />
        </div>
        <div className="actions">
          <button type="button" className="button" onClick={openStage} disabled={script.sentences.length === 0}>Plein écran</button>
          <button type="button" className="button is-primary" onClick={toggleListening} disabled={listening.status === 'unsupported'}>{listenLabel}</button>
        </div>
      </div>

      <div className="grid">
        <div className="col span-8">
          <div ref={stageRef} className={`stage order-1${isStageOpen ? ' is-open' : ''}`}>
            <Stage script={script} sentence={sentence} position={follow.position} size={isStageOpen ? Math.round(size * 1.35) : size} isMirrored={isMirrored} isFinished={finished} />
            <div className="stage-controls" aria-label="Commandes du prompteur" role="group">
              <button type="button" className="button is-quiet" onClick={() => goTo(sentence - 1)} disabled={sentence === 0}>Phrase précédente</button>
              <button type="button" className="button is-quiet" onClick={() => goTo(sentence + 1)} disabled={sentence >= script.sentences.length - 1}>Phrase suivante</button>
              <button type="button" className="button is-quiet" onClick={restart}>Reprendre au début</button>
              {isStageOpen && (
                <>
                  <span className={`stage-pace is-${verdict ?? 'none'}`}>{wpm ?? '–'} mots/min</span>
                  <button type="button" className="button is-quiet" onClick={toggleListening}>{listenLabel}</button>
                  <button type="button" className="button is-quiet" onClick={closeStage}>Quitter</button>
                </>
              )}
            </div>
          </div>

          <section className="panel editor order-4" aria-labelledby="titre-script">
            <div className="panel-head">
              <h2 id="titre-script" className="panel-title">Votre script</h2>
              <p className="meta">{script.words.length} mots · une phrase par ligne · [indications] entre crochets</p>
            </div>
            <label className="sr-only" htmlFor="script">Texte du script</label>
            <textarea id="script" className="script-input" value={scriptText} onChange={(event) => changeScript(event.target.value)} rows={9} maxLength={60_000} spellCheck />
          </section>
        </div>

        <div className="col">
          <PacePanel wpm={wpm} target={targetWpm} verdict={verdict} isListening={isListening} sentence={sentence} sentenceCount={script.sentences.length} remainingSeconds={remainingSeconds} />
          <section className="panel reading order-3" aria-labelledby="titre-lecture">
            <h2 id="titre-lecture" className="panel-title">Lecture</h2>
            <div className="field">
              <label htmlFor="taille">Taille du texte <span className="value">{size} px</span></label>
              <input id="taille" type="range" min={SIZE.min} max={SIZE.max} step={SIZE.step} value={size} onChange={(event) => setSize(Number(event.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="cible">Vitesse idéale <span className="value">{targetWpm} mots/min</span></label>
              <input id="cible" type="range" min={TARGET_RANGE.min} max={TARGET_RANGE.max} step={5} value={targetWpm} onChange={(event) => onTargetChange(clampTarget(Number(event.target.value)))} />
            </div>
            <label className="switch">
              <input type="checkbox" checked={isMirrored} onChange={(event) => setMirrored(event.target.checked)} />
              <span>Miroir, pour une vitre de prompteur</span>
            </label>
            <p className="hint">Espace : écoute · flèches : phrase · F : plein écran · M : miroir</p>
          </section>
        </div>
      </div>
    </div>
  );
}
