import { fillReadyPrompt, READY_PROMPTS, type LiveContext } from '../../lib/prompts';

type Props = {
  context: LiveContext;
  question: string;
  copied: string;
  onCopy: (id: string, text: string) => void;
};

/** Prompts prêts à copier dans ChatGPT : ils marchent sans clé, avant comme pendant le live. */
export function ReadyPrompts({ context, question, copied, onCopy }: Props) {
  return (
    <section className="panel order-4" aria-labelledby="titre-prompts">
      <div className="panel-head">
        <h2 id="titre-prompts" className="panel-title">Prompts prêts à copier</h2>
        <p className="meta">Remplis avec le contexte du live, à coller dans ChatGPT ou n’importe quelle IA.</p>
      </div>
      <ul className="rows">
        {READY_PROMPTS.map((prompt) => {
          const id = `pret-${prompt.id}`;
          const label = copied === id ? 'Copié' : copied === `${id}:erreur` ? 'Copie refusée' : 'Copier';
          return (
            <li key={prompt.id} className="row row-action">
              <div>
                <p className="row-title">{prompt.label}</p>
                <p className="meta">{prompt.when}</p>
              </div>
              <button type="button" className="button is-quiet" aria-label={`Copier le prompt « ${prompt.label} »`} onClick={() => onCopy(id, fillReadyPrompt(prompt, { topic: context.topic, notes: context.notes, question }))}>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
