import type { LiveContext } from '../../lib/prompts';

type Props = {
  context: LiveContext;
  onChange: (context: LiveContext) => void;
};

/** Ce que le souffleur doit savoir du live, gardé dans ce navigateur. */
export function ContextPanel({ context, onChange }: Props) {
  return (
    <section className="panel context order-2" aria-labelledby="titre-contexte">
      <h2 id="titre-contexte" className="panel-title">Contexte du live</h2>
      <div className="field">
        <label htmlFor="orateur">Qui vous êtes</label>
        <input id="orateur" className="input" value={context.speaker} maxLength={400} onChange={(event) => onChange({ ...context, speaker: event.target.value })} placeholder="Ex. : développeuse solo, je crée mes propres outils IA" />
      </div>
      <div className="field">
        <label htmlFor="sujet">Sujet du live</label>
        <input id="sujet" className="input" value={context.topic} maxLength={400} onChange={(event) => onChange({ ...context, topic: event.target.value })} placeholder="Ex. : la Suite Forge, mes outils de création" />
      </div>
      <div className="field">
        <label htmlFor="notes">À savoir pour répondre</label>
        <textarea id="notes" className="input" rows={5} value={context.notes} maxLength={4000} onChange={(event) => onChange({ ...context, notes: event.target.value })} placeholder="Vos outils, vos liens, vos vrais prix, vos réponses habituelles" />
        <p className="hint">L’IA ne connaît que ce que vous écrivez ici : sans prix noté, elle dira qu’elle vérifiera. N’y mettez rien de confidentiel : une réponse peut en reprendre un passage, à voix haute.</p>
      </div>
    </section>
  );
}
