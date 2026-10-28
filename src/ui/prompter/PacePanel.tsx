import { DEFAULT_TOLERANCE, formatDuration, type PaceVerdict, VERDICT_LABEL } from '../../lib/pace';

type Props = {
  wpm: number | null;
  target: number;
  verdict: PaceVerdict | null;
  isListening: boolean;
  sentence: number;
  sentenceCount: number;
  remainingSeconds: number;
};

const SCALE = { min: 60, max: 220 } as const;

function percent(value: number): number {
  const clamped = Math.min(Math.max(value, SCALE.min), SCALE.max);
  return ((clamped - SCALE.min) / (SCALE.max - SCALE.min)) * 100;
}

function verdictText(verdict: PaceVerdict | null, isListening: boolean): string {
  if (verdict) return VERDICT_LABEL[verdict];
  return isListening ? 'Parlez pour mesurer' : 'En attente';
}

/** Vitesse réelle contre vitesse visée : la barre montre la zone visée et le repère mesuré. */
export function PacePanel({ wpm, target, verdict, isListening, sentence, sentenceCount, remainingSeconds }: Props) {
  const low = percent(target * (1 - DEFAULT_TOLERANCE));
  const high = percent(target * (1 + DEFAULT_TOLERANCE));
  return (
    <section className="panel pace order-2" aria-labelledby="titre-vitesse">
      <h2 id="titre-vitesse" className="panel-title">Vitesse de parole</h2>
      <div className="pace-figures">
        <p className="pace-real">
          <span className="figure">{wpm ?? '–'}</span>
          <span className="unit">mots/min</span>
        </p>
        <p className={`pace-verdict is-${verdict ?? 'none'}`} role="status">{verdictText(verdict, isListening)}</p>
      </div>
      <div className="pace-bar" role="img" aria-label={`Zone visée de ${Math.round(target * (1 - DEFAULT_TOLERANCE))} à ${Math.round(target * (1 + DEFAULT_TOLERANCE))} mots par minute${wpm ? `, mesuré ${wpm}` : ''}`}>
        <span className="pace-zone" style={{ left: `${low}%`, width: `${high - low}%` }} />
        {wpm !== null && <span className={`pace-marker is-${verdict ?? 'none'}`} style={{ left: `${percent(wpm)}%` }} />}
      </div>
      <div className="pace-scale" aria-hidden="true">
        <span>{SCALE.min}</span>
        <span>Idéal {target}</span>
        <span>{SCALE.max}</span>
      </div>
      <dl className="facts">
        <div><dt>Phrase</dt><dd>{sentenceCount > 0 ? `${sentence + 1} sur ${sentenceCount}` : '–'}</dd></div>
        <div><dt>Reste à lire</dt><dd>{formatDuration(remainingSeconds)}</dd></div>
      </dl>
    </section>
  );
}
