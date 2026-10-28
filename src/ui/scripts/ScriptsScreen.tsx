import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { AiSettings } from '../../App';
import { formatDuration } from '../../lib/pace';
import { complete, findProvider, ProviderError } from '../../lib/provider';
import { buildScriptPrompt, cleanForPrompter, EMPTY_INPUT, generateScript, type ScriptInput } from '../../lib/scripts';
import { FORMATS, TONES } from '../../lib/templates';
import { countWords } from '../../lib/text';
import { useCopy, useStoredState } from '../hooks/browser';

type Props = {
  apiKey: string;
  aiSettings: AiSettings;
  targetWpm: number;
  onSend: (text: string) => void;
};

const inputSchema = z.object({
  format: z.enum(['live-flemme', 'live-demo', 'video-ia', 'short', 'tuto']),
  tool: z.string().max(120),
  result: z.string().max(200),
  request: z.string().max(300),
  audience: z.string().max(120),
  tone: z.enum(['detendu', 'pro', 'energique']),
  minutes: z.number().min(0.5).max(15),
  cta: z.string().max(200),
});

const DURATIONS = [0.5, 1, 2, 3, 5, 10] as const;

const EXAMPLE: ScriptInput = {
  ...EMPTY_INPUT,
  tool: 'SiteForge',
  result: 'un site vitrine complet',
  request: 'un site pour une boulangerie de Pointe-à-Pitre',
  audience: 'indépendant',
  minutes: 2,
  cta: 'le lien est dans la description.',
};

type Improve = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

export function ScriptsScreen({ apiKey, aiSettings, targetWpm, onSend }: Props) {
  const [input, setInput] = useStoredState<ScriptInput>('generateur', inputSchema, EXAMPLE);
  const [seed, setSeed] = useState(1);
  const [edited, setEdited] = useState<string | null>(null);
  const [improve, setImprove] = useState<Improve>({ kind: 'idle' });
  const [copied, copy] = useCopy();
  const requestRef = useRef<AbortController | null>(null);
  const generated = useMemo(() => generateScript(input, seed, targetWpm), [input, seed, targetWpm]);
  const prompt = useMemo(() => buildScriptPrompt(input, generated, targetWpm), [input, generated, targetWpm]);
  const text = edited ?? generated.text;
  const words = countWords(text);
  const provider = findProvider(aiSettings.provider);

  useEffect(() => () => requestRef.current?.abort(), []);

  const change = (patch: Partial<ScriptInput>) => {
    setInput({ ...input, ...patch });
    setEdited(null);
  };

  const improveWithAi = () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setImprove({ kind: 'loading' });
    complete(aiSettings.provider, apiKey, [{ role: 'user', content: prompt }], { model: aiSettings.model, maxTokens: 1800, temperature: 0.7, timeoutMs: 60_000, signal: controller.signal })
      .then((raw) => {
        setEdited(cleanForPrompter(raw));
        setImprove({ kind: 'idle' });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setImprove({ kind: 'error', message: error instanceof ProviderError ? error.message : 'Le script n’a pas pu être amélioré.' });
      });
  };

  const copyLabel = (id: string, idle: string) => (copied === id ? 'Copié' : copied === `${id}:erreur` ? 'Copie refusée' : idle);

  return (
    <div className="screen">
      <div className="title-row">
        <div>
          <h1>Générateur de scripts</h1>
          <p className="status-line">Choisissez un format, décrivez l’outil, puis envoyez le script au prompteur.</p>
        </div>
        <div className="actions">
          <button type="button" className="button is-primary" onClick={() => onSend(text)} disabled={words === 0}>Envoyer au prompteur</button>
        </div>
      </div>

      <div className="grid">
        <form className="panel span-4 brief" onSubmit={(event) => event.preventDefault()} aria-labelledby="titre-brief">
          <h2 id="titre-brief" className="panel-title">Le sujet</h2>
          <fieldset className="formats">
            <legend>Format</legend>
            {FORMATS.map((format) => (
              <label key={format.id} className={`format${input.format === format.id ? ' is-selected' : ''}`}>
                <input type="radio" name="format" checked={input.format === format.id} onChange={() => change({ format: format.id, minutes: format.defaultMinutes })} />
                <span className="format-label">{format.label}</span>
                <span className="meta">{format.summary}</span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="outil">Outil présenté</label>
            <input id="outil" className="input" value={input.tool} maxLength={120} onChange={(event) => change({ tool: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="resultat">Ce qu’il crée</label>
            <input id="resultat" className="input" value={input.result} maxLength={200} onChange={(event) => change({ result: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="demande">Demande montrée à l’écran</label>
            <input id="demande" className="input" value={input.request} maxLength={300} onChange={(event) => change({ request: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="public">Public (« Si vous êtes… »)</label>
            <input id="public" className="input" value={input.audience} maxLength={120} onChange={(event) => change({ audience: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="fin">Phrase de fin</label>
            <input id="fin" className="input" value={input.cta} maxLength={200} onChange={(event) => change({ cta: event.target.value })} />
          </div>
          <div className="field-pair">
            <div className="field">
              <label htmlFor="ton">Ton</label>
              <select id="ton" className="input" value={input.tone} onChange={(event) => change({ tone: event.target.value as ScriptInput['tone'] })}>
                {TONES.map((tone) => <option key={tone.id} value={tone.id}>{tone.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="duree">Durée visée</label>
              <select id="duree" className="input" value={input.minutes} onChange={(event) => change({ minutes: Number(event.target.value) })}>
                {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes < 1 ? '30 s' : `${minutes} min`}</option>)}
              </select>
            </div>
          </div>
        </form>

        <section className="panel span-8 preview is-stretched" aria-labelledby="titre-apercu" aria-busy={improve.kind === 'loading'}>
          <div className="panel-head">
            <h2 id="titre-apercu" className="panel-title">{generated.title}</h2>
            <p className="meta">{words} mots · {formatDuration(Math.round((words / targetWpm) * 60))} à {targetWpm} mots/min{edited !== null ? ' · modifié' : ''}</p>
          </div>
          {generated.shorterThanTarget && edited === null && (
            <p className="notice">Le modèle couvre {formatDuration(generated.seconds)} sur {formatDuration(generated.targetSeconds)} visées. Pour la version longue, copiez le prompt ChatGPT{apiKey ? ` ou améliorez-le avec ${provider.label}` : ''}.</p>
          )}
          {improve.kind === 'error' && <p className="notice is-error" role="alert">{improve.message}</p>}
          <label className="sr-only" htmlFor="apercu">Script généré, modifiable</label>
          <textarea id="apercu" className="script-input is-document" value={text} onChange={(event) => setEdited(event.target.value)} rows={16} maxLength={60_000} />
          <div className="actions">
            <button type="button" className="button" onClick={() => { setSeed(seed + 1); setEdited(null); }}>Autre variante</button>
            <button type="button" className="button is-quiet" onClick={() => copy('script', text)}>{copyLabel('script', 'Copier le script')}</button>
            <button type="button" className="button is-quiet" onClick={() => copy('prompt', prompt)}>{copyLabel('prompt', 'Copier le prompt ChatGPT')}</button>
            {apiKey
              ? <button type="button" className="button is-quiet" onClick={improveWithAi} disabled={improve.kind === 'loading'}>{improve.kind === 'loading' ? 'Écriture en cours…' : `Améliorer avec ${provider.label}`}</button>
              : <a className="button is-quiet" href="#reglages">Relier une IA</a>}
          </div>
        </section>

        {input.format === 'video-ia' && (
          <section className="panel span-12" aria-labelledby="titre-plans">
            <div className="panel-head">
              <h2 id="titre-plans" className="panel-title">Plans à générer avec une IA vidéo</h2>
              <p className="meta">Un plan par partie de la voix off, à coller dans Veo, Kling, Wan ou Runway.</p>
            </div>
            <ul className="rows">
              {generated.sections.map((section) => section.shot && (
                <li key={section.title} className="row row-action">
                  <div>
                    <p className="row-title">{section.title}</p>
                    <p>{section.shot}</p>
                  </div>
                  <button type="button" className="button is-quiet" aria-label={`Copier le plan « ${section.title} »`} onClick={() => copy(`plan-${section.title}`, section.shot ?? '')}>{copyLabel(`plan-${section.title}`, 'Copier')}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
