import type { ParsedScript, ScriptSentence, ScriptToken } from '../../lib/text';

type Props = {
  script: ParsedScript;
  sentence: number;
  position: number;
  size: number;
  isMirrored: boolean;
  isFinished: boolean;
};

function tokenState(token: ScriptToken, position: number): 'read' | 'current' | 'upcoming' | 'cue' {
  if (token.direction) return 'cue';
  if (token.wordCount === 0) return position >= token.firstWord ? 'read' : 'upcoming';
  const last = token.firstWord + token.wordCount - 1;
  if (position > last) return 'read';
  if (position >= token.firstWord) return 'current';
  return 'upcoming';
}

function Sentence({ sentence, position }: { sentence: ScriptSentence; position: number }) {
  return (
    <>
      {sentence.tokens.map((token, index) => (
        <span key={`${token.firstWord}-${index}`} className={`token is-${tokenState(token, position)}`}>
          {token.text}{' '}
        </span>
      ))}
    </>
  );
}

/** La scène de lecture : la phrase en cours en très grand, la suivante en retrait. */
export function Stage({ script, sentence, position, size, isMirrored, isFinished }: Props) {
  const current = script.sentences[sentence];
  const next = script.sentences[sentence + 1];
  const nextText = next?.tokens.filter((token) => !token.direction).map((token) => token.text).join(' ');

  if (!current) {
    return (
      <div className="stage-text is-empty">
        <p>Le script est vide. Collez un texte plus bas ou générez-en un dans l’onglet Scripts.</p>
      </div>
    );
  }

  return (
    <div className={`stage-text${isMirrored ? ' is-mirrored' : ''}`} style={{ '--prompter-size': `${size}px` } as React.CSSProperties}>
      <p className="stage-current" aria-live="off">
        <Sentence sentence={current} position={position} />
      </p>
      {nextText && !isFinished && <p className="stage-next">{nextText}</p>}
      {isFinished && <p className="stage-next">Fin du script.</p>}
    </div>
  );
}
