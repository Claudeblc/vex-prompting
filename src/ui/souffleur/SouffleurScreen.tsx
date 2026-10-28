import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { AiSettings } from '../../App';
import { buildAnswerMessages, buildAnswerPrompt, cleanAnswer, shouldAutoAnswer, trimQuestion, type AnswerLength, type AutoAnswerMemory, type LiveContext } from '../../lib/prompts';
import { complete, findProvider, ProviderError } from '../../lib/provider';
import { useCopy, useSpeechSynthesis, useStoredState } from '../hooks/browser';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { ListenStatus } from '../ListenStatus';
import { ContextPanel } from './ContextPanel';
import { ReadyPrompts } from './ReadyPrompts';

type Props = {
  apiKey: string;
  aiSettings: AiSettings;
  context: LiveContext;
  onContextChange: (context: LiveContext) => void;
};

type Answer =
  | { kind: 'idle' }
  | { kind: 'loading'; question: string }
  | { kind: 'done'; question: string; text: string }
  | { kind: 'error'; question: string; message: string }
  | { kind: 'prompt'; question: string; prompt: string };

interface Exchange {
  id: number;
  question: string;
  answer: string;
}

const HISTORY_SIZE = 5;

export function SouffleurScreen({ apiKey, aiSettings, context, onContextChange }: Props) {
  const [answer, setAnswer] = useState<Answer>({ kind: 'idle' });
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [isAuto, setAuto] = useStoredState('souffleur-auto', z.boolean(), true);
  const [isSpoken, setSpoken] = useStoredState('souffleur-voix', z.boolean(), true);
  const [length, setLength] = useStoredState<AnswerLength>('souffleur-longueur', z.enum(['court', 'moyen']), 'court');
  const [voiceName, setVoiceName] = useStoredState('voix', z.string().max(200), '');
  const [rate, setRate] = useStoredState('debit', z.number().min(0.6).max(1.6), 1.05);
  const [copied, copy] = useCopy();
  const tts = useSpeechSynthesis(voiceName, rate);
  const { speak } = tts;
  const requestRef = useRef<AbortController | null>(null);
  const speakingRef = useRef(false);
  const lastAutoRef = useRef<AutoAnswerMemory | null>(null);
  const provider = findProvider(aiSettings.provider);
  const hasKey = apiKey.length > 0;

  useEffect(() => {
    speakingRef.current = tts.speaking;
  }, [tts.speaking]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const ask = useCallback((rawQuestion: string) => {
    const question = trimQuestion(rawQuestion);
    if (question.length === 0) return;
    requestRef.current?.abort();
    if (!hasKey) {
      setAnswer({ kind: 'prompt', question, prompt: buildAnswerPrompt(question, context, length) });
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setAnswer({ kind: 'loading', question });
    complete(aiSettings.provider, apiKey, buildAnswerMessages(question, context, length), { model: aiSettings.model, maxTokens: length === 'court' ? 120 : 220, signal: controller.signal })
      .then((raw) => {
        const text = cleanAnswer(raw);
        setAnswer({ kind: 'done', question, text });
        setHistory((items) => [{ id: Date.now(), question, answer: text }, ...items].slice(0, HISTORY_SIZE));
        if (isSpoken) speak(text);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof ProviderError ? error.message : 'La réponse n’a pas pu être obtenue.';
        setAnswer({ kind: 'error', question, message });
      });
  }, [hasKey, context, length, aiSettings.provider, aiSettings.model, apiKey, isSpoken, speak]);

  const onResult = useCallback((transcript: string, isFinal: boolean) => {
    if (speakingRef.current) return;
    setHeard(transcript);
    if (!isFinal || !isAuto) return;
    const now = Date.now();
    if (!shouldAutoAnswer(transcript, lastAutoRef.current, now)) return;
    lastAutoRef.current = { question: transcript, at: now };
    ask(transcript);
  }, [isAuto, ask]);

  const listening = useSpeechRecognition(onResult);
  const isListening = listening.status === 'listening' || listening.status === 'starting';

  const submitTyped = (event: React.FormEvent) => {
    event.preventDefault();
    ask(typed);
    setTyped('');
  };

  return (
    <div className="screen">
      <div className="title-row">
        <div>
          <h1>Souffleur IA</h1>
          <ListenStatus status={listening.status} error={listening.error} idleText={hasKey ? `Réponses par ${provider.label}, avec votre clé.` : 'Sans clé : chaque question donne un prompt prêt à coller dans ChatGPT.'} />
        </div>
        <div className="actions">
          <button type="button" className="button is-primary" onClick={isListening ? listening.stop : listening.start} disabled={listening.status === 'unsupported'}>
            {isListening ? 'Arrêter l’écoute' : 'Écouter les questions'}
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="col span-8">
          <section className="panel answer order-1" aria-labelledby="titre-reponse" aria-busy={answer.kind === 'loading'}>
            <div className="panel-head">
              <h2 id="titre-reponse" className="panel-title">Réponse à dire</h2>
              {answer.kind !== 'idle' && <p className="meta question">Question : {answer.question}</p>}
            </div>
            <AnswerBody answer={answer} copied={copied} onCopy={copy} onRetry={ask} onSpeak={tts.speak} canSpeak={tts.supported} isSpeaking={tts.speaking} onStop={tts.cancel} />
            <div className="heard">
              <p className="meta">Entendu : {heard || (isListening ? 'en attente d’une question…' : 'le micro est coupé.')}</p>
              <button type="button" className="button is-quiet" onClick={() => ask(heard)} disabled={heard.trim().length === 0}>Répondre à ce qui a été entendu</button>
            </div>
            <form className="ask" onSubmit={submitTyped}>
              <label className="sr-only" htmlFor="question">Question du chat</label>
              <input id="question" className="input" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="Ou tapez la question lue dans le chat" maxLength={500} autoComplete="off" />
              <button type="submit" className="button" disabled={typed.trim().length === 0}>Répondre</button>
            </form>
          </section>
          <ReadyPrompts context={context} question={answer.kind === 'idle' ? heard : answer.question} copied={copied} onCopy={copy} />
          {history.length > 0 && (
            <section className="panel order-5" aria-labelledby="titre-historique">
              <h2 id="titre-historique" className="panel-title">Réponses précédentes</h2>
              <ul className="rows">
                {history.map((item) => (
                  <li key={item.id} className="row">
                    <p className="meta">{item.question}</p>
                    <p>{item.answer}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="col">
          <ContextPanel context={context} onChange={onContextChange} />
          <section className="panel order-3" aria-labelledby="titre-reglages-souffleur">
            <h2 id="titre-reglages-souffleur" className="panel-title">Réponses</h2>
            <label className="switch"><input type="checkbox" checked={isAuto} onChange={(event) => setAuto(event.target.checked)} /><span>Répondre dès qu’une question est repérée</span></label>
            <label className="switch"><input type="checkbox" checked={isSpoken} onChange={(event) => setSpoken(event.target.checked)} disabled={!tts.supported} /><span>Lire la réponse à voix haute</span></label>
            <fieldset className="choice">
              <legend>Longueur</legend>
              <label><input type="radio" name="longueur" checked={length === 'court'} onChange={() => setLength('court')} /> Deux phrases</label>
              <label><input type="radio" name="longueur" checked={length === 'moyen'} onChange={() => setLength('moyen')} /> Quatre phrases</label>
            </fieldset>
            <div className="field">
              <label htmlFor="voix">Voix</label>
              <select id="voix" className="input" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} disabled={tts.voices.length === 0}>
                <option value="">Voix française par défaut</option>
                {tts.voices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="debit">Débit <span className="value">{rate.toFixed(2).replace('.', ',')}</span></label>
              <input id="debit" type="range" min={0.6} max={1.6} step={0.05} value={rate} onChange={(event) => setRate(Number(event.target.value))} />
            </div>
            <p className="hint">La voix sort sur la sortie audio par défaut : choisissez vos lunettes ou vos écouteurs dans le système.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

type AnswerBodyProps = {
  answer: Answer;
  copied: string;
  onCopy: (id: string, text: string) => void;
  onRetry: (question: string) => void;
  onSpeak: (text: string) => void;
  onStop: () => void;
  canSpeak: boolean;
  isSpeaking: boolean;
};

function AnswerBody({ answer, copied, onCopy, onRetry, onSpeak, onStop, canSpeak, isSpeaking }: AnswerBodyProps) {
  if (answer.kind === 'idle') {
    return <p className="answer-text is-empty">Lancez l’écoute ou tapez une question : la réponse courte s’affiche ici, en grand.</p>;
  }
  if (answer.kind === 'loading') {
    return <p className="answer-text is-loading">Réponse en préparation…</p>;
  }
  if (answer.kind === 'error') {
    return (
      <div>
        <p className="answer-text is-error" role="alert">{answer.message}</p>
        <div className="actions"><button type="button" className="button" onClick={() => onRetry(answer.question)}>Réessayer</button><a className="button is-quiet" href="#reglages">Vérifier la clé</a></div>
      </div>
    );
  }
  if (answer.kind === 'prompt') {
    return (
      <div>
        <p className="answer-hint">Pas de clé reliée : copiez ce prompt et collez-le dans ChatGPT.</p>
        <pre className="prompt-box">{answer.prompt}</pre>
        <div className="actions">
          <button type="button" className="button is-primary" onClick={() => onCopy('souffleur', answer.prompt)}>{copied === 'souffleur' ? 'Copié' : copied === 'souffleur:erreur' ? 'Copie refusée' : 'Copier le prompt'}</button>
          <a className="button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Ouvrir ChatGPT</a>
          <a className="button is-quiet" href="#reglages">Relier une IA</a>
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="answer-text" aria-live="polite">{answer.text}</p>
      <div className="actions">
        {canSpeak && (isSpeaking
          ? <button type="button" className="button" onClick={onStop}>Couper la voix</button>
          : <button type="button" className="button" onClick={() => onSpeak(answer.text)}>Réécouter</button>)}
        <button type="button" className="button is-quiet" onClick={() => onCopy('reponse', answer.text)}>{copied === 'reponse' ? 'Copié' : 'Copier'}</button>
        <button type="button" className="button is-quiet" onClick={() => onRetry(answer.question)}>Autre réponse</button>
      </div>
    </div>
  );
}
