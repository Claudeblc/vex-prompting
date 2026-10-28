import { describe, expect, it } from 'vitest';
import { hear, isFinished, jumpToSentence, sentenceProgress, START } from './follower';
import { advance, editDistance, wordsMatch } from './matcher';
import { normalizeWord, parseScript, sentenceAt, toMatchWords } from './text';

const SCRIPT = parseScript(
  "Ce soir, je ne travaille pas. C'est l'outil qui génère le site à ma place.\n[Montrer l'écran]\nEt moi, je lis simplement le prompteur !",
);

describe('normalisation du texte', () => {
  it('retire accents, majuscules et ponctuation', () => {
    expect(normalizeWord('Génère,')).toBe('genere');
    expect(normalizeWord('Œuvre')).toBe('oeuvre');
  });

  it('coupe les élisions et écrit les petits nombres en lettres', () => {
    expect(toMatchWords("l'outil fait 3 sites")).toEqual(['l', 'outil', 'fait', 'trois', 'sites']);
  });
});

describe('découpage du script', () => {
  it('sépare les phrases et rattache l’indication de jeu à la phrase suivante', () => {
    expect(SCRIPT.sentences).toHaveLength(3);
    const third = SCRIPT.sentences[2];
    expect(third?.tokens[0]?.direction).toBe(true);
    expect(third?.tokens.map((t) => t.text).join(' ')).toContain('[Montrer');
  });

  it('ne compte pas les indications parmi les mots à dire', () => {
    expect(SCRIPT.words.map((w) => w.norm)).not.toContain('montrer');
  });

  it('retrouve la phrase d’un mot, et la dernière quand le script est fini', () => {
    expect(sentenceAt(SCRIPT, 0)).toBe(0);
    expect(sentenceAt(SCRIPT, SCRIPT.words.length)).toBe(2);
  });
});

describe('correspondance tolérante des mots', () => {
  it('accepte les accords et les petites erreurs de transcription', () => {
    expect(wordsMatch('generent', 'genere')).toBe(true);
    expect(wordsMatch('prompteurs', 'prompteur')).toBe(true);
    expect(wordsMatch('simplemant', 'simplement')).toBe(true);
  });

  it('refuse des mots différents', () => {
    expect(wordsMatch('chat', 'site')).toBe(false);
    expect(wordsMatch('le', 'la')).toBe(false);
  });

  it('calcule la distance d’édition', () => {
    expect(editDistance('site', 'sites')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('avance à la voix', () => {
  it('ne bouge pas tant que rien n’est dit', () => {
    expect(advance(SCRIPT.words, 0, [])).toBe(0);
    expect(hear(SCRIPT, START, '', false).state.position).toBe(0);
  });

  it('ne bouge pas sur des mots hors script (« euh », improvisation)', () => {
    expect(advance(SCRIPT.words, 0, ['euh', 'bon', 'alors'])).toBe(0);
  });

  it('suit une lecture exacte', () => {
    const step = hear(SCRIPT, START, 'ce soir je ne travaille pas', true);
    expect(step.state.position).toBe(6);
    expect(step.advancedBy).toBe(6);
    expect(sentenceAt(SCRIPT, step.state.position)).toBe(1);
  });

  it('tolère un petit mot avalé par la reconnaissance', () => {
    expect(advance(SCRIPT.words, 0, toMatchWords('ce soir je travaille pas'))).toBe(6);
  });

  it('ne saute pas loin sur un mot court croisé par hasard', () => {
    const position = advance(SCRIPT.words, 6, ['le']);
    expect(position).toBe(6);
  });

  it('se recale quand la personne saute un passage', () => {
    const start = 6;
    const position = advance(SCRIPT.words, start, toMatchWords('je lis simplement'));
    expect(sentenceAt(SCRIPT, position - 1)).toBe(2);
  });

  it('les résultats provisoires avancent l’affichage sans fixer le départ', () => {
    const interim = hear(SCRIPT, START, 'ce soir je', false);
    expect(interim.state).toEqual({ committed: 0, position: 3 });
    const final = hear(SCRIPT, interim.state, 'ce soir je ne travaille pas', true);
    expect(final.state).toEqual({ committed: 6, position: 6 });
    expect(final.advancedBy).toBe(3);
  });

  it('un résultat provisoire corrigé ne fait pas reculer l’affichage', () => {
    const first = hear(SCRIPT, START, 'ce soir je ne', false);
    const revised = hear(SCRIPT, first.state, 'ce soir', false);
    expect(revised.state.position).toBe(4);
    expect(revised.advancedBy).toBe(0);
  });

  it('va jusqu’à la fin du script', () => {
    const text = "ce soir je ne travaille pas c'est l'outil qui génère le site à ma place et moi je lis simplement le prompteur";
    const step = hear(SCRIPT, START, text, true);
    expect(isFinished(SCRIPT, step.state)).toBe(true);
  });

  it('se place au début d’une phrase et mesure l’avancée dans la phrase', () => {
    const state = jumpToSentence(SCRIPT, 1);
    expect(state.position).toBe(SCRIPT.sentences[1]?.firstWord);
    expect(sentenceProgress(SCRIPT, 1, state.position)).toBe(0);
    expect(jumpToSentence(SCRIPT, 99).position).toBe(SCRIPT.sentences[2]?.firstWord);
  });
});
