import { useState } from 'react';
import type { AiSettings } from '../../App';
import { complete, findProvider, PROVIDERS, ProviderError, type ProviderId } from '../../lib/provider';
import { forgetApiKey, isPlausibleKey, maskKey, saveApiKey } from '../../lib/storage';

type Props = {
  apiKey: string;
  onKeyChange: (key: string) => void;
  aiSettings: AiSettings;
  onAiSettingsChange: (settings: AiSettings) => void;
};

type Check = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

export function SettingsScreen({ apiKey, onKeyChange, aiSettings, onAiSettingsChange }: Props) {
  const [draft, setDraft] = useState('');
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState('');
  const [check, setCheck] = useState<Check>({ kind: 'idle' });
  const provider = findProvider(aiSettings.provider);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isPlausibleKey(draft)) {
      setMessage('Cette clé ne ressemble pas à une clé d’API (au moins 8 caractères, sans espace).');
      return;
    }
    const stored = saveApiKey(aiSettings.provider, draft, remember);
    onKeyChange(draft.trim());
    setDraft('');
    setCheck({ kind: 'idle' });
    setMessage(stored ? (remember ? 'Clé enregistrée dans ce navigateur.' : 'Clé gardée pour cet onglet seulement.') : 'Le stockage du navigateur est bloqué : la clé servira jusqu’à la fermeture de la page.');
  };

  const forget = () => {
    forgetApiKey(aiSettings.provider);
    onKeyChange('');
    setCheck({ kind: 'idle' });
    setMessage('Clé effacée de ce navigateur.');
  };

  const test = () => {
    setCheck({ kind: 'loading' });
    complete(aiSettings.provider, apiKey, [{ role: 'user', content: 'Réponds seulement : OK' }], { model: aiSettings.model, maxTokens: 5 })
      .then(() => setCheck({ kind: 'ok', text: `${provider.label} répond : la clé fonctionne.` }))
      .catch((error: unknown) => setCheck({ kind: 'error', text: error instanceof ProviderError ? error.message : 'Le test a échoué.' }));
  };

  return (
    <div className="screen">
      <div className="title-row">
        <div>
          <h1>Réglages</h1>
          <p className="status-line">{apiKey ? `IA reliée : ${provider.label}${maskKey(apiKey) ? `, clé ${maskKey(apiKey)}` : ''}.` : 'Aucune IA reliée : le souffleur et le générateur donnent des prompts à copier.'}</p>
        </div>
      </div>

      <div className="settings">
        <section className="settings-row" aria-labelledby="titre-fournisseur">
          <div className="settings-label">
            <h2 id="titre-fournisseur" className="panel-title">Fournisseur d’IA</h2>
            <p className="meta">Facultatif. Avec votre propre clé, le souffleur répond tout seul pendant le live. Groq et Mistral proposent des offres d’essai gratuites. Prenez de préférence une clé dédiée, avec un plafond de dépense chez le fournisseur.</p>
          </div>
          <div className="panel">
            <fieldset className="choice">
              <legend>Fournisseur</legend>
              {PROVIDERS.map((item) => (
                <label key={item.id}>
                  <input type="radio" name="fournisseur" checked={aiSettings.provider === item.id} onChange={() => onAiSettingsChange({ provider: item.id as ProviderId, model: '' })} /> {item.label}
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor="modele">Modèle</label>
              <input id="modele" className="input" value={aiSettings.model} placeholder={provider.defaultModel} maxLength={80} onChange={(event) => onAiSettingsChange({ ...aiSettings, model: event.target.value })} />
            </div>
            <form className="field" onSubmit={save}>
              <label htmlFor="cle">Clé d’API {provider.label}</label>
              <div className="ask">
                <input id="cle" className="input" type="password" value={draft} onChange={(event) => setDraft(event.target.value)} autoComplete="new-password" spellCheck={false} placeholder={apiKey ? `Clé enregistrée ${maskKey(apiKey)}` : 'Collez votre clé'} />
                <button type="submit" className="button is-primary" disabled={draft.trim().length === 0}>Enregistrer</button>
              </div>
              <label className="switch">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Garder la clé dans ce navigateur (sinon, pour cet onglet seulement)</span>
              </label>
              <p className="hint"><a href={provider.keyPage} target="_blank" rel="noopener noreferrer">Créer une clé {provider.label}</a></p>
            </form>
            {message && <p className="notice" role="status">{message}</p>}
            {apiKey && (
              <div className="actions">
                <button type="button" className="button" onClick={test} disabled={check.kind === 'loading'}>{check.kind === 'loading' ? 'Test en cours…' : 'Tester la clé'}</button>
                <button type="button" className="button is-quiet" onClick={forget}>Effacer la clé</button>
              </div>
            )}
            {(check.kind === 'ok' || check.kind === 'error') && <p className={`notice${check.kind === 'error' ? ' is-error' : ' is-ok'}`} role="status">{check.text}</p>}
          </div>
        </section>

        <section className="settings-row" aria-labelledby="titre-confidentialite">
          <div className="settings-label">
            <h2 id="titre-confidentialite" className="panel-title">Où vont vos données</h2>
            <p className="meta">Vex Prompting n’a pas de serveur : la page est un simple fichier, tout le reste se passe dans votre navigateur.</p>
          </div>
          <div className="panel">
            <ul className="rows">
              <li className="row"><p className="row-title">Vos scripts et réglages</p><p className="meta">Gardés dans le stockage local de ce navigateur. Sans IA reliée, rien ne sort.</p></li>
              <li className="row"><p className="row-title">Votre clé d’IA</p><p className="meta">Gardée dans ce navigateur, une par fournisseur, et envoyée seulement à son adresse officielle ({new URL(provider.endpoint).host}).</p></li>
              <li className="row"><p className="row-title">Avec une IA reliée</p><p className="meta">Vos questions, le contexte du live (notes comprises) et les brouillons de scripts sont envoyés à ce fournisseur, et à lui seul.</p></li>
              <li className="row"><p className="row-title">Votre voix</p><p className="meta">La reconnaissance vocale est celle du navigateur : Chrome, Edge et Safari envoient l’audio à leurs propres services pour le transcrire.</p></li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
