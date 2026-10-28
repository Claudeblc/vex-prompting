// Découpage et normalisation du texte français : ce qui est écrit dans le script
// et ce que la reconnaissance vocale renvoie doivent finir sous la même forme.

const DIGIT_WORDS: Record<number, string> = {
  0: 'zero', 1: 'un', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six',
  7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix', 11: 'onze', 12: 'douze',
  13: 'treize', 14: 'quatorze', 15: 'quinze', 16: 'seize', 20: 'vingt',
  30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante', 100: 'cent', 1000: 'mille',
};

const SENTENCE_END = /[.!?…]["»)\]]*$/;

export interface ScriptWord {
  /** Forme comparable du mot. */
  norm: string;
  /** Phrase à laquelle il appartient. */
  sentence: number;
}

export interface ScriptToken {
  /** Texte affiché tel qu'écrit, ponctuation comprise. */
  text: string;
  /** Indication de jeu entre crochets : affichée, jamais attendue à l'oral. */
  direction: boolean;
  /** Premier mot de `words` couvert par ce jeton. */
  firstWord: number;
  /** Nombre de mots à dire dans ce jeton (0 pour une indication ou un tiret). */
  wordCount: number;
}

export interface ScriptSentence {
  tokens: ScriptToken[];
  firstWord: number;
  lastWord: number;
}

export interface ParsedScript {
  sentences: ScriptSentence[];
  words: ScriptWord[];
}

interface RawToken {
  text: string;
  direction: boolean;
}

/** Un mot ramené à sa forme comparable : minuscules, sans accents ni ponctuation. */
export function normalizeWord(word: string): string {
  const plain = word
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (/^\d+$/.test(plain)) {
    return DIGIT_WORDS[Number(plain)] ?? plain;
  }
  return plain;
}

/** Les mots comparables d'un bout de texte (« l'outil » donne « l » et « outil »). */
export function toMatchWords(text: string): string[] {
  return text
    .split(/[\s'’\-–—/]+/)
    .map(normalizeWord)
    .filter((word) => word.length > 0);
}

/** Retire les indications de jeu entre crochets, qui ne se lisent pas à voix haute. */
export function stripDirections(text: string): string {
  return text.replace(/\[[^\]]*\]/g, ' ');
}

export function countWords(text: string): number {
  return toMatchWords(stripDirections(text)).length;
}

function splitDisplayTokens(line: string): RawToken[] {
  const tokens: RawToken[] = [];
  let inDirection = false;
  for (const text of line.split(/\s+/).filter(Boolean)) {
    const opens = text.startsWith('[');
    tokens.push({ text, direction: inDirection || opens });
    if (opens) inDirection = true;
    if (text.includes(']')) inDirection = false;
  }
  return tokens;
}

function groupSentences(text: string): RawToken[][] {
  const sentences: RawToken[][] = [];
  let current: RawToken[] = [];
  const close = () => {
    if (current.length > 0) sentences.push(current);
    current = [];
  };
  for (const line of text.split(/\r?\n/)) {
    for (const token of splitDisplayTokens(line)) {
      current.push(token);
      if (!token.direction && SENTENCE_END.test(token.text)) close();
    }
    close();
  }
  return sentences;
}

function isSpeakable(tokens: RawToken[]): boolean {
  return tokens.some((token) => !token.direction && toMatchWords(token.text).length > 0);
}

/**
 * Prépare un script pour le téléprompteur.
 * - `sentences` : ce qu'on affiche, phrase par phrase ;
 * - `words` : la suite des mots à dire, celle que suit la reconnaissance vocale.
 * Une phrase faite seulement d'indications (« [Montrer l'écran] ») est rattachée
 * à la phrase suivante, pour ne jamais bloquer la lecture.
 */
export function parseScript(text: string): ParsedScript {
  const sentences: ScriptSentence[] = [];
  const words: ScriptWord[] = [];
  let pendingCue: RawToken[] = [];

  for (const rawTokens of groupSentences(text)) {
    if (!isSpeakable(rawTokens)) {
      pendingCue = pendingCue.concat(rawTokens);
      continue;
    }
    const sentence = sentences.length;
    const firstWord = words.length;
    const tokens = pendingCue.concat(rawTokens).map((raw): ScriptToken => {
      const norms = raw.direction ? [] : toMatchWords(raw.text);
      const tokenFirst = words.length;
      for (const norm of norms) words.push({ norm, sentence });
      return { text: raw.text, direction: raw.direction, firstWord: tokenFirst, wordCount: norms.length };
    });
    pendingCue = [];
    sentences.push({ tokens, firstWord, lastWord: words.length - 1 });
  }

  const last = sentences[sentences.length - 1];
  if (pendingCue.length > 0 && last) {
    for (const raw of pendingCue) {
      last.tokens.push({ text: raw.text, direction: raw.direction, firstWord: words.length, wordCount: 0 });
    }
  }
  return { sentences, words };
}

/** Indice de la phrase qui contient le mot `position` (la dernière si le script est fini). */
export function sentenceAt(script: ParsedScript, position: number): number {
  if (script.sentences.length === 0) return -1;
  const word = script.words[Math.max(0, position)];
  return word ? word.sentence : script.sentences.length - 1;
}
