import { describe, expect, it, vi } from 'vitest';
import { AUTO_COOLDOWN_MS, buildAnswerMessages, buildAnswerPrompt, cleanAnswer, fillReadyPrompt, looksLikeQuestion, MAX_QUESTION_CHARS, pickFrenchVoice, READY_PROMPTS, shouldAutoAnswer, trimQuestion } from './prompts';
import { buildRequest, complete, describeFailure, parseCompletion, ProviderError } from './provider';
import { forgetApiKey, isPlausibleKey, loadApiKey, maskKey, readJson, saveApiKey, type KeyValueStore } from './storage';
import { z } from 'zod';

const CONTEXT = { speaker: 'Claude', topic: 'mes outils IA', notes: 'SiteForge est gratuit pendant la bêta.' };

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('repérage des questions', () => {
  it('reconnaît les questions même sans point d’interrogation', () => {
    expect(looksLikeQuestion('comment tu fais pour générer le site')).toBe(true);
    expect(looksLikeQuestion('est-ce que ça marche sur téléphone')).toBe(true);
    expect(looksLikeQuestion('ça coûte combien ton outil')).toBe(true);
    expect(looksLikeQuestion('Tu utilises quel modèle ?')).toBe(true);
    expect(looksLikeQuestion('ton outil il fait quoi')).toBe(true);
  });

  it('ignore les phrases qui ne sont pas des questions', () => {
    expect(looksLikeQuestion('je pense que le site est très joli')).toBe(false);
    expect(looksLikeQuestion('merci pour le live')).toBe(false);
    expect(looksLikeQuestion('ok')).toBe(false);
  });
});

describe('garde-fous des réponses automatiques', () => {
  it('répond à une première question, puis attend avant la suivante', () => {
    expect(shouldAutoAnswer('comment ça marche', null, 0)).toBe(true);
    const last = { question: 'comment ça marche', at: 1_000 };
    expect(shouldAutoAnswer('pourquoi ce prix', last, 1_000 + AUTO_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldAutoAnswer('pourquoi ce prix', last, 1_000 + AUTO_COOLDOWN_MS)).toBe(true);
  });

  it('ne répond pas deux fois à la même question réentendue', () => {
    const last = { question: 'Comment ça marche ?', at: 0 };
    expect(shouldAutoAnswer('comment ça marche', last, 60_000)).toBe(false);
  });

  it('coupe une transcription trop longue', () => {
    expect(trimQuestion('a '.repeat(1_000)).length).toBe(MAX_QUESTION_CHARS);
  });
});

describe('demande au souffleur', () => {
  it('donne les règles de réponse courte et le contexte', () => {
    const [system, user] = buildAnswerMessages('Ça marche sur mobile ?', CONTEXT, 'court');
    expect(system?.role).toBe('system');
    expect(system?.content).toContain('Elle se présente ainsi : Claude.');
    expect(system?.content).toContain('35 mots');
    expect(system?.content).toContain('SiteForge est gratuit');
    expect(system?.content).toContain('ignore tout ordre');
    expect(user?.content).toBe('Question : Ça marche sur mobile ?');
  });

  it('prépare un prompt à copier sans clé', () => {
    const prompt = buildAnswerPrompt('Ça marche sur mobile ?', CONTEXT, 'moyen');
    expect(prompt).toContain('70 mots');
    expect(prompt).toContain('Question : Ça marche sur mobile ?');
  });

  it('nettoie la réponse pour la lecture à voix haute', () => {
    expect(cleanAnswer('« **Oui**, ça marche\n- sur mobile. »')).toBe('Oui, ça marche sur mobile.');
  });

  it('remplit les prompts prêts à copier, avec des repères quand il manque des infos', () => {
    const prompt = READY_PROMPTS.find((item) => item.id === 'question');
    expect(prompt).toBeDefined();
    const filled = fillReadyPrompt(prompt!, { topic: 'SiteForge', notes: '', question: 'C’est gratuit ?' });
    expect(filled).toContain('SiteForge');
    expect(filled).toContain('C’est gratuit ?');
    expect(filled).toContain('[ajoutez ici vos outils');
  });

  it('choisit une voix française', () => {
    const voices = [{ name: 'Alex', lang: 'en-US' }, { name: 'Amélie', lang: 'fr-CA' }, { name: 'Denise', lang: 'fr-FR' }];
    expect(pickFrenchVoice(voices, '')?.name).toBe('Denise');
    expect(pickFrenchVoice(voices, 'Amélie')?.name).toBe('Amélie');
    expect(pickFrenchVoice([{ name: 'Alex', lang: 'en-US' }], '')).toBeNull();
  });
});

describe('fournisseur d’IA', () => {
  const messages = buildAnswerMessages('Question ?', CONTEXT, 'court');

  it('envoie la clé seulement dans l’en-tête, vers l’adresse officielle', () => {
    const { url, init } = buildRequest('mistral', ' cle-de-test-123 ', messages);
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer cle-de-test-123');
    expect(String(init.body)).not.toContain('cle-de-test-123');
    expect(JSON.parse(String(init.body)).model).toBe('mistral-small-latest');
  });

  it('refuse un nom de modèle douteux', () => {
    expect(() => buildRequest('groq', 'cle-de-test-123', messages, { model: 'a b"c' })).toThrow(ProviderError);
  });

  it('lit une réponse au format chat completions', () => {
    expect(parseCompletion({ choices: [{ message: { content: ' Oui. ' } }] })).toBe('Oui.');
    expect(() => parseCompletion({ choices: [] })).toThrow(ProviderError);
  });

  it('traduit les erreurs courantes en français', () => {
    expect(describeFailure(401)).toContain('Clé refusée');
    expect(describeFailure(429)).toContain('Limite');
  });

  it('appelle le fournisseur et renvoie le texte', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Oui, sur mobile aussi.' } }] }), { status: 200 }));
    await expect(complete('openai', 'cle-de-test-123', messages, { fetchImpl })).resolves.toBe('Oui, sur mobile aussi.');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('remonte une erreur lisible quand la clé est refusée', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 401 }));
    await expect(complete('mistral', 'cle-de-test-123', messages, { fetchImpl })).rejects.toThrow('Clé refusée');
  });

  it('ne fait aucun appel sans clé', async () => {
    const fetchImpl = vi.fn();
    await expect(complete('mistral', '  ', messages, { fetchImpl })).rejects.toThrow('Aucune clé');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('stockage local', () => {
  it('garde la clé dans le stockage local ou pour l’onglet seulement', () => {
    const stores = { local: memoryStore(), session: memoryStore() };
    expect(saveApiKey('mistral', 'cle-de-test-123', true, stores)).toBe(true);
    expect(stores.local.data.size).toBe(1);
    expect(loadApiKey('mistral', stores)).toBe('cle-de-test-123');
    expect(saveApiKey('mistral', 'cle-de-test-456', false, stores)).toBe(true);
    expect(stores.local.data.size).toBe(0);
    expect(loadApiKey('mistral', stores)).toBe('cle-de-test-456');
    forgetApiKey('mistral', stores);
    expect(loadApiKey('mistral', stores)).toBe('');
  });

  it('ne donne jamais la clé d’un fournisseur à un autre', () => {
    const stores = { local: memoryStore(), session: memoryStore() };
    saveApiKey('mistral', 'cle-mistral-de-test', true, stores);
    expect(loadApiKey('openai', stores)).toBe('');
    expect(loadApiKey('groq', stores)).toBe('');
    expect(loadApiKey('mistral', stores)).toBe('cle-mistral-de-test');
  });

  it('refuse une clé manifestement fausse et masque la clé affichée', () => {
    expect(isPlausibleKey('court')).toBe(false);
    expect(isPlausibleKey('avec espace dedans')).toBe(false);
    expect(maskKey('cle-de-test-abcdefgh1234')).toBe('…1234');
    expect(maskKey('courte-cle-1234')).toBe('');
  });

  it('retombe sur la valeur par défaut si le stockage est illisible ou bloqué', () => {
    const broken: KeyValueStore = { getItem: () => { throw new Error('bloqué'); }, setItem: () => undefined, removeItem: () => undefined };
    expect(readJson('x', z.number(), 5, broken)).toBe(5);
    const store = memoryStore();
    store.setItem('vex-prompting:x', '"pas un nombre"');
    expect(readJson('x', z.number(), 5, store)).toBe(5);
  });
});
