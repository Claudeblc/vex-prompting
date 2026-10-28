import type { Route } from '../App';

const LINKS: readonly { route: Route; label: string }[] = [
  { route: 'prompteur', label: 'Prompteur' },
  { route: 'souffleur', label: 'Souffleur' },
  { route: 'scripts', label: 'Scripts' },
];

type Props = {
  route: Route;
  hasKey: boolean;
};

export function TopBar({ route, hasKey }: Props) {
  return (
    <header className="topbar">
      <div className="column topbar-inner">
        <a className="wordmark" href="#prompteur">Vex Prompting</a>
        <nav className="topnav" aria-label="Outils">
          {LINKS.map((link) => (
            <a key={link.route} href={`#${link.route}`} aria-current={route === link.route ? 'page' : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        <a className="topbar-settings" href="#reglages" aria-current={route === 'reglages' ? 'page' : undefined}>
          {hasKey ? 'IA reliée' : 'Relier une IA'}
        </a>
      </div>
    </header>
  );
}
