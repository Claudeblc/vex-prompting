// Appel direct, depuis le navigateur, au fournisseur d'IA choisi par la personne,
// avec SA clé. Aucun serveur intermédiaire : la clé ne quitte le navigateur que
// vers l'adresse officielle du fournisseur.

import { z } from 'zod';
import type { ChatMessage } from './prompts';

export type ProviderId = 'mistral' | 'openai' | 'groq';

export interface Provider {
  id: ProviderId;
  label: string;
  endpoint: string;
  defaultModel: string;
  /** Où créer une clé. */
  keyPage: string;
}

export const PROVIDERS: readonly Provider[] = [
  { id: 'mistral', label: 'Mistral', endpoint: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-small-latest', keyPage: 'https://console.mistral.ai/api-keys' },
  { id: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile', keyPage: 'https://console.groq.com/keys' },
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4.1-mini', keyPage: 'https://platform.openai.com/api-keys' },
];

export function findProvider(id: ProviderId): Provider {
  return PROVIDERS.find((provider) => provider.id === id) ?? (PROVIDERS[0] as Provider);
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = 'ProviderError';
  }
}

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

export const MODEL_NAME = /^[\w.:/-]{1,80}$/;

export function buildRequest(providerId: ProviderId, apiKey: string, messages: ChatMessage[], options: CompletionOptions = {}): { url: string; init: RequestInit } {
  const provider = findProvider(providerId);
  const model = options.model?.trim() || provider.defaultModel;
  if (!MODEL_NAME.test(model)) throw new ProviderError('Nom de modèle invalide.', null);
  return {
    url: provider.endpoint,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({ model, messages, max_tokens: options.maxTokens ?? 220, temperature: options.temperature ?? 0.5 }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
    },
  };
}

export function parseCompletion(payload: unknown): string {
  const parsed = completionSchema.safeParse(payload);
  const content = parsed.success ? parsed.data.choices[0]?.message.content : null;
  if (!content || content.trim().length === 0) throw new ProviderError('Réponse vide ou illisible du fournisseur.', null);
  return content.trim();
}

/** Message en français pour chaque échec courant ; jamais la clé ni le corps brut de la requête. */
export function describeFailure(status: number): string {
  if (status === 401 || status === 403) return 'Clé refusée par le fournisseur. Vérifiez-la dans les réglages.';
  if (status === 404) return 'Modèle introuvable chez ce fournisseur. Vérifiez son nom dans les réglages.';
  if (status === 429) return 'Limite d’utilisation atteinte chez le fournisseur. Réessayez dans un instant.';
  if (status >= 500) return 'Le fournisseur ne répond pas correctement pour le moment.';
  return `Le fournisseur a refusé la demande (erreur ${status}).`;
}

export async function complete(providerId: ProviderId, apiKey: string, messages: ChatMessage[], options: CompletionOptions = {}): Promise<string> {
  if (apiKey.trim().length === 0) throw new ProviderError('Aucune clé enregistrée.', null);
  const { url, init } = buildRequest(providerId, apiKey, messages, options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 20_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;
  try {
    const response = await fetchImpl(url, { ...init, signal });
    if (!response.ok) throw new ProviderError(describeFailure(response.status), response.status);
    return parseCompletion(await response.json());
  } catch (error: unknown) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProviderError(options.signal?.aborted ? 'Demande annulée.' : 'Le fournisseur met trop de temps à répondre.', null);
    }
    throw new ProviderError('Impossible de joindre le fournisseur (réseau coupé ou accès bloqué par le navigateur).', null);
  } finally {
    clearTimeout(timer);
  }
}
