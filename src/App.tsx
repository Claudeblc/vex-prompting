import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { DEMO_SCRIPT } from './lib/demo';
import { clampTarget, DEFAULT_TARGET_WPM } from './lib/pace';
import { EMPTY_CONTEXT, type LiveContext } from './lib/prompts';
import { MODEL_NAME, type ProviderId } from './lib/provider';
import { loadApiKey } from './lib/storage';
import { useStoredState } from './ui/hooks/browser';
import { PrompterScreen } from './ui/prompter/PrompterScreen';
import { ScriptsScreen } from './ui/scripts/ScriptsScreen';
import { SettingsScreen } from './ui/settings/SettingsScreen';
import { SouffleurScreen } from './ui/souffleur/SouffleurScreen';
import { TopBar } from './ui/TopBar';

export type Route = 'prompteur' | 'souffleur' | 'scripts' | 'reglages';

const ROUTES: readonly Route[] = ['prompteur', 'souffleur', 'scripts', 'reglages'];

export interface AiSettings {
  provider: ProviderId;
  model: string;
}

const aiSettingsSchema = z.object({ provider: z.enum(['mistral', 'groq', 'openai']), model: z.union([z.literal(''), z.string().regex(MODEL_NAME)]) });
const contextSchema = z.object({ speaker: z.string().max(400), topic: z.string().max(400), notes: z.string().max(4000) });

function routeFromHash(): Route {
  const hash = window.location.hash.replace('#', '');
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : 'prompteur';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [scriptText, setScriptText] = useStoredState('script', z.string().max(60_000), DEMO_SCRIPT);
  const [targetWpm, setTargetWpm] = useStoredState('cible', z.number().transform(clampTarget), DEFAULT_TARGET_WPM);
  const [aiSettings, setAiSettings] = useStoredState<AiSettings>('ia', aiSettingsSchema, { provider: 'mistral', model: '' });
  const [liveContext, setLiveContext] = useStoredState<LiveContext>('contexte-live', contextSchema, EMPTY_CONTEXT);
  const [apiKey, setApiKey] = useState(() => loadApiKey(aiSettings.provider));

  const changeAiSettings = useCallback((next: AiSettings) => {
    setAiSettings(next);
    setApiKey(loadApiKey(next.provider));
  }, [setAiSettings]);

  useEffect(() => {
    // Seules les ancres d'écran changent d'écran : « #contenu » (lien d'évitement) laisse l'écran en place.
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if ((ROUTES as readonly string[]).includes(hash)) setRoute(hash as Route);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const titles: Record<Route, string> = {
      prompteur: 'Téléprompteur',
      souffleur: 'Souffleur IA',
      scripts: 'Générateur de scripts',
      reglages: 'Réglages',
    };
    document.title = `${titles[route]} · Vex Prompting`;
    window.scrollTo(0, 0);
  }, [route]);

  const sendToPrompter = useCallback((text: string) => {
    setScriptText(text);
    window.location.hash = 'prompteur';
  }, [setScriptText]);

  return (
    <>
      <TopBar route={route} hasKey={apiKey.length > 0} />
      <main className="column" id="contenu" tabIndex={-1}>
        {route === 'prompteur' && (
          <PrompterScreen scriptText={scriptText} onScriptChange={setScriptText} targetWpm={targetWpm} onTargetChange={setTargetWpm} />
        )}
        {route === 'souffleur' && (
          <SouffleurScreen apiKey={apiKey} aiSettings={aiSettings} context={liveContext} onContextChange={setLiveContext} />
        )}
        {route === 'scripts' && (
          <ScriptsScreen apiKey={apiKey} aiSettings={aiSettings} targetWpm={targetWpm} onSend={sendToPrompter} />
        )}
        {route === 'reglages' && (
          <SettingsScreen apiKey={apiKey} onKeyChange={setApiKey} aiSettings={aiSettings} onAiSettingsChange={changeAiSettings} />
        )}
      </main>
      <footer className="column footer">
        <p>
          Vex Prompting est gratuit et open source (licence MIT). Il n’a pas de serveur : vos scripts et votre clé restent dans ce navigateur. Avec une IA reliée, vos questions et vos brouillons partent chez ce fournisseur, et chez lui seul.
        </p>
        <a href="https://github.com/Claudeblc/vex-prompting" rel="noopener noreferrer" target="_blank">Code source</a>
      </footer>
    </>
  );
}
