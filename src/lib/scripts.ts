// Générateur de scripts : remplit un modèle avec le sujet de la personne,
// l'ajuste à la durée visée, et prépare le prompt à coller dans ChatGPT.

import { DEFAULT_TARGET_WPM, estimateSeconds } from './pace';
import { pick, seededRandom } from './random';
import { findFormat, type Format, type FormatId, type Line, type Tone, TONES } from './templates';
import { countWords } from './text';

export interface ScriptInput {
  format: FormatId;
  tool: string;
  result: string;
  request: string;
  audience: string;
  tone: Tone;
  minutes: number;
  cta: string;
}

export interface GeneratedSection {
  title: string;
  lines: string[];
  shot?: string;
}

export interface GeneratedScript {
  title: string;
  text: string;
  sections: GeneratedSection[];
  wordCount: number;
  seconds: number;
  targetSeconds: number;
  /** Le modèle seul ne remplit pas la durée visée : il faut l'IA ou le prompt ChatGPT. */
  shorterThanTarget: boolean;
}

export const EMPTY_INPUT: ScriptInput = {
  format: 'live-flemme',
  tool: '',
  result: '',
  request: '',
  audience: '',
  tone: 'detendu',
  minutes: 3,
  cta: '',
};

const FALLBACK = {
  tool: 'mon outil',
  result: 'un site complet',
  request: 'un site pour une boulangerie de quartier',
  audience: 'indépendant',
  cta: 'le lien est dans la description.',
} as const;

const LOWERCASE_STARTS = /^(Le|La|Les|L['’]|Un|Une|Des|C['’]est|Il|Elle|Tout|Rendez-vous|Abonnez-vous|Cliquez|Allez|Testez|Essayez|Retrouvez)\b/;

function clean(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : fallback;
}

function withoutFinalPeriod(value: string): string {
  return value.replace(/[.!…]+$/, '');
}

function asClause(cta: string): string {
  const ended = /[.!?…]$/.test(cta) ? cta : `${cta}.`;
  return LOWERCASE_STARTS.test(ended) ? ended.charAt(0).toLowerCase() + ended.slice(1) : ended;
}

function capitalize(line: string): string {
  if (line.startsWith('[')) return line;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function fieldsOf(input: ScriptInput): Record<string, string> {
  return {
    outil: clean(input.tool, FALLBACK.tool),
    resultat: withoutFinalPeriod(clean(input.result, FALLBACK.result)),
    demande: withoutFinalPeriod(clean(input.request, FALLBACK.request)),
    public: clean(input.audience, FALLBACK.audience),
    cta: asClause(clean(input.cta, FALLBACK.cta)),
  };
}

function fill(template: string, fields: Record<string, string>): string {
  return capitalize(template.replace(/\{(\w+)\}/g, (match, key: string) => fields[key] ?? match));
}

function resolveLine(line: Line, tone: Tone, random: () => number): string {
  if (typeof line === 'string') return line;
  if (Array.isArray(line)) return pick(line as readonly string[], random);
  const byTone = (line as Readonly<Record<Tone, string | readonly string[]>>)[tone];
  return typeof byTone === 'string' ? byTone : pick(byTone, random);
}

/** Choisit les lignes « en plus » une par section à tour de rôle, jusqu'à la durée visée. */
function chooseExtras(format: Format, coreWords: number, targetWords: number, measure: (line: Line) => number): Set<string> {
  const chosen = new Set<string>();
  let words = coreWords;
  const longest = Math.max(...format.sections.map((section) => section.extra?.length ?? 0));
  for (let round = 0; round < longest && words < targetWords; round++) {
    format.sections.forEach((section, sectionIndex) => {
      const line = section.extra?.[round];
      if (line === undefined || words >= targetWords) return;
      chosen.add(`${sectionIndex}:${round}`);
      words += measure(line);
    });
  }
  return chosen;
}

export function generateScript(input: ScriptInput, seed: number, wpm = DEFAULT_TARGET_WPM): GeneratedScript {
  const format = findFormat(input.format);
  const fields = fieldsOf(input);
  const random = seededRandom(seed);
  const resolved = new Map<Line, string>();
  const textOf = (line: Line): string => {
    const known = resolved.get(line);
    if (known !== undefined) return known;
    const text = fill(resolveLine(line, input.tone, random), fields);
    resolved.set(line, text);
    return text;
  };

  const minutes = Math.min(Math.max(input.minutes, 0.5), 15);
  const targetWords = Math.round(minutes * wpm);
  const coreWords = format.sections.reduce((sum, section) => sum + section.core.reduce((s, line) => s + countWords(textOf(line)), 0), 0);
  const extras = chooseExtras(format, coreWords, targetWords, (line) => countWords(textOf(line)));

  const sections: GeneratedSection[] = format.sections.map((section, sectionIndex) => {
    const extraLines = (section.extra ?? []).filter((_, round) => extras.has(`${sectionIndex}:${round}`));
    const lines = [...section.core, ...extraLines].map(textOf);
    return section.shot ? { title: section.title, lines, shot: section.shot } : { title: section.title, lines };
  });

  const text = sections.map((section) => section.lines.join('\n')).join('\n\n');
  const wordCount = countWords(text);
  const seconds = estimateSeconds(wordCount, wpm);
  const targetSeconds = Math.round(minutes * 60);
  return {
    title: `${format.label} · ${fields.outil}`,
    text,
    sections,
    wordCount,
    seconds,
    targetSeconds,
    shorterThanTarget: seconds < targetSeconds * 0.8,
  };
}

function toneLabel(tone: Tone): string {
  return TONES.find((item) => item.id === tone)?.label.toLowerCase() ?? 'détendu';
}

/** Le prompt complet, prêt à coller dans ChatGPT ou à envoyer à l'IA de la personne. */
export function buildScriptPrompt(input: ScriptInput, draft: GeneratedScript, wpm = DEFAULT_TARGET_WPM): string {
  const format = findFormat(input.format);
  const fields = fieldsOf(input);
  const words = Math.round(input.minutes * wpm);
  const shots = format.id === 'video-ia'
    ? '- pour chaque partie, écris d’abord entre crochets le plan à générer avec une IA vidéo, puis la voix off ;\n'
    : '';
  return [
    'Tu es scénariste pour des vidéos et des lives en français.',
    `Écris le script complet d’un format « ${format.label} » d’environ ${formatMinutes(input.minutes)} (à peu près ${words} mots), à lire au téléprompteur.`,
    '',
    `Outil présenté : ${fields.outil}, qui crée ${fields.resultat}.`,
    `Demande montrée à l’écran : ${fields.demande}.`,
    `Public : ${fields.public}.`,
    `Ton : ${toneLabel(input.tone)}.`,
    `Fin du script : ${fields.cta}`,
    '',
    'Règles :',
    '- français parlé, phrases courtes, une idée par phrase ;',
    '- une phrase par ligne, sans titres, sans listes, sans emoji ;',
    '- les gestes et les actions à l’écran entre crochets, par exemple [Partager l’écran] ;',
    shots + '- n’invente ni chiffres, ni clients, ni témoignages.',
    '',
    'Pars de ce brouillon et améliore-le :',
    '---',
    draft.text,
    '---',
    'Réponds uniquement avec le script.',
  ].join('\n');
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} secondes`;
  return minutes === 1 ? '1 minute' : `${String(minutes).replace('.', ',')} minutes`;
}

/** Nettoie une réponse d'IA pour le prompteur : pas de Markdown, pas de blocs de code. */
export function cleanForPrompter(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*•]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^---+$/, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
