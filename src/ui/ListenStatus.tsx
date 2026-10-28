import type { ListeningStatus } from './hooks/useSpeechRecognition';

type Props = {
  status: ListeningStatus;
  error: string;
  idleText: string;
};

const TEXT: Partial<Record<ListeningStatus, string>> = {
  starting: 'Ouverture du micro…',
  listening: 'Écoute en cours.',
  unsupported: 'Ce navigateur ne propose pas la reconnaissance vocale. Utilisez Chrome, Edge ou Safari récent ; en attendant, avancez avec les boutons.',
};

/** La ligne d'état sous le titre : ce que fait le micro, ou pourquoi il ne marche pas. */
export function ListenStatus({ status, error, idleText }: Props) {
  const text = error || TEXT[status] || idleText;
  const tone = error || status === 'denied' || status === 'unsupported' ? 'is-error' : status === 'listening' ? 'is-live' : '';
  return (
    <p className={`status-line ${tone}`} role="status">
      {status === 'listening' && !error && <span className="live-dot" aria-hidden="true" />}
      {text}
    </p>
  );
}
