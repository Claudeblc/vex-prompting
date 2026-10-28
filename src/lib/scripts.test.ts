import { describe, expect, it } from 'vitest';
import { buildScriptPrompt, cleanForPrompter, EMPTY_INPUT, generateScript, type ScriptInput } from './scripts';
import { FORMATS } from './templates';
import { parseScript } from './text';

const LIVE: ScriptInput = {
  ...EMPTY_INPUT,
  format: 'live-flemme',
  tool: 'SiteForge',
  result: 'un site vitrine complet',
  request: 'un site pour une boulangerie de Pointe-à-Pitre',
  audience: 'indépendant',
  minutes: 3,
  cta: 'Le lien est dans la description',
};

describe('générateur de scripts', () => {
  it('reprend le sujet du live « j’ai la flemme »', () => {
    const script = generateScript(LIVE, 1);
    expect(script.text).toContain('SiteForge');
    expect(script.text).toContain('un site pour une boulangerie de Pointe-à-Pitre');
    expect(script.text).toContain('le lien est dans la description.');
    expect(script.text).not.toMatch(/\{\w+\}/);
  });

  it('allonge le script quand la durée visée augmente', () => {
    const short = generateScript({ ...LIVE, minutes: 0.5 }, 1);
    const long = generateScript({ ...LIVE, minutes: 5 }, 1);
    expect(long.wordCount).toBeGreaterThan(short.wordCount);
  });

  it('signale quand le modèle seul ne remplit pas la durée', () => {
    expect(generateScript({ ...LIVE, minutes: 10 }, 1).shorterThanTarget).toBe(true);
  });

  it('est reproductible pour une même graine', () => {
    expect(generateScript(LIVE, 42).text).toBe(generateScript(LIVE, 42).text);
  });

  it('change de variante avec le ton', () => {
    const relaxed = generateScript({ ...LIVE, tone: 'detendu' }, 3).text;
    const pro = generateScript({ ...LIVE, tone: 'pro' }, 3).text;
    expect(relaxed).not.toBe(pro);
  });

  it('remplace les champs vides par des valeurs lisibles', () => {
    const script = generateScript({ ...EMPTY_INPUT }, 1);
    expect(script.text).toContain('mon outil');
    expect(script.text).not.toMatch(/\{\w+\}/);
  });

  it('chaque format produit un script lisible au prompteur', () => {
    for (const format of FORMATS) {
      const script = generateScript({ ...LIVE, format: format.id, minutes: format.defaultMinutes }, 7);
      const parsed = parseScript(script.text);
      expect(parsed.sentences.length).toBeGreaterThan(1);
      expect(parsed.words.length).toBe(script.wordCount);
    }
  });

  it('donne un plan à générer pour chaque partie de la vidéo IA', () => {
    const script = generateScript({ ...LIVE, format: 'video-ia', minutes: 1 }, 1);
    expect(script.sections.every((section) => typeof section.shot === 'string' && section.shot.length > 20)).toBe(true);
  });

  it('prépare un prompt ChatGPT complet avec le brouillon', () => {
    const draft = generateScript(LIVE, 1);
    const prompt = buildScriptPrompt(LIVE, draft);
    expect(prompt).toContain('SiteForge');
    expect(prompt).toContain('3 minutes');
    expect(prompt).toContain(draft.text);
    expect(prompt).toContain('entre crochets');
  });

  it('nettoie une réponse d’IA en Markdown pour le prompteur', () => {
    const raw = '```\n# Titre\n- **Bonjour** à tous.\n\n\n\nOn commence.\n```';
    expect(cleanForPrompter(raw)).toBe('Titre\nBonjour à tous.\n\nOn commence.');
  });
});
