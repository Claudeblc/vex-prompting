// Modèles de scripts. Chaque ligne est une phrase à lire au prompteur ;
// le texte entre crochets est une indication de jeu, affichée mais jamais attendue à l'oral.
// Champs : {outil}, {resultat}, {demande}, {public}, {cta}.

export type Tone = 'detendu' | 'pro' | 'energique';
export type FormatId = 'live-flemme' | 'live-demo' | 'video-ia' | 'short' | 'tuto';

/** Une ligne : un texte, des variantes, ou des variantes selon le ton. */
export type Line = string | readonly string[] | Readonly<Record<Tone, string | readonly string[]>>;

export interface Section {
  title: string;
  /** Lignes toujours présentes. */
  core: readonly Line[];
  /** Lignes ajoutées quand la durée visée le permet. */
  extra?: readonly Line[];
  /** Plan à générer avec une IA vidéo (format « vidéo IA » seulement). */
  shot?: string;
}

export interface Format {
  id: FormatId;
  label: string;
  /** Une phrase qui dit à quoi sert le format. */
  summary: string;
  defaultMinutes: number;
  sections: readonly Section[];
}

const LIVE_FLEMME: Format = {
  id: 'live-flemme',
  label: 'Live « j’ai la flemme »',
  summary: 'Un outil fait le travail en direct pendant que vous lisez le prompteur.',
  defaultMinutes: 2,
  sections: [
    {
      title: 'Accroche',
      core: [
        {
          detendu: ['Ce soir, j’ai décidé de travailler le moins possible.', 'Je vous préviens tout de suite : aujourd’hui, ce n’est pas moi qui travaille.'],
          pro: 'Aujourd’hui, je vais vous montrer comment déléguer une tâche entière à un outil.',
          energique: ['Ce soir, je ne fais rien. Absolument rien.', 'Aujourd’hui, zéro effort de ma part, et pourtant on va sortir quelque chose de concret.'],
        },
        'C’est {outil} qui va faire le travail à ma place, en direct, devant vous.',
        'Moi, je me contente de lire ce qui défile devant mes yeux.',
      ],
      extra: ['Oui, même cette phrase, je la lis.'],
    },
    {
      title: 'L’outil',
      core: [
        '{outil} crée {resultat} à partir d’une simple demande.',
        ['Pas besoin de savoir coder, ni de passer la nuit dessus.', 'Aucune ligne de code à écrire de mon côté.'],
      ],
      extra: [
        'Je l’utilise parce que j’en avais assez de refaire les mêmes étapes à la main.',
        'Si vous êtes {public}, vous allez vite comprendre pourquoi ça m’intéresse.',
      ],
    },
    {
      title: 'Lancement',
      core: [
        '[Ouvrir {outil} et taper la demande]',
        'On va lui demander {demande}.',
        'Je valide la demande, et je ne touche plus à rien.',
        '[Lancer la génération]',
      ],
    },
    {
      title: 'Pendant que ça tourne',
      core: [
        'Pendant que ça tourne, je vous explique ce qui se passe.',
        'D’abord, il lit la demande et décide de la structure.',
        'Ensuite, il écrit les textes et place les images.',
      ],
      extra: [
        { detendu: 'Pendant ce temps-là, je bois mon café.', pro: 'Pendant ce temps, je peux m’occuper d’autre chose.', energique: 'Pendant ce temps, moi, je me repose. Littéralement.' },
        'Posez vos questions dans le chat, j’y réponds juste après.',
        'Si vous voulez que je teste une autre demande, écrivez-la, je prendrai la meilleure.',
      ],
    },
    {
      title: 'Le résultat',
      core: [
        '[Afficher le résultat en plein écran]',
        ['Et voilà le résultat.', 'C’est prêt. Regardez.'],
        'On a {resultat}, prêt à être montré.',
        'Ce que vous voyez, c’est le premier jet, sans retouche.',
      ],
      extra: ['Si un texte ne me plaît pas, je le corrige en une phrase, sans ouvrir aucun fichier.'],
    },
    {
      title: 'Fin',
      core: [
        'Si vous voulez l’essayer, {cta}',
        {
          detendu: 'Moi, j’ai fini ma journée. Merci d’avoir regardé quelqu’un ne rien faire.',
          pro: 'Merci de votre attention, et à très vite pour le prochain live.',
          energique: 'Journée terminée pour moi. Merci à tous, et à la prochaine !',
        },
      ],
    },
  ],
};

const LIVE_DEMO: Format = {
  id: 'live-demo',
  label: 'Démo d’outil en live',
  summary: 'Présenter un outil pas à pas, puis répondre aux questions du chat.',
  defaultMinutes: 3,
  sections: [
    {
      title: 'Ouverture',
      core: [
        { detendu: 'Salut tout le monde, merci d’être là.', pro: 'Bonjour à toutes et à tous, et bienvenue dans ce live.', energique: 'Salut tout le monde ! On est en direct, et ça va aller vite.' },
        'Aujourd’hui, je vous montre {outil} en conditions réelles.',
        'Le but est simple : partir de {demande} et arriver à {resultat}.',
      ],
      extra: ['Si vous êtes {public}, cette démo est pour vous.', 'Dites-moi dans le chat d’où vous nous regardez.'],
    },
    {
      title: 'Le problème',
      core: [
        'D’habitude, ce genre de travail demande plusieurs outils et beaucoup d’allers-retours.',
        '{outil} regroupe tout au même endroit.',
      ],
      extra: ['On gagne surtout en tranquillité : une seule demande, un seul endroit.'],
    },
    {
      title: 'La démo',
      core: [
        '[Partager l’écran]',
        'Je commence par décrire ce que je veux, en une phrase.',
        'Ici, je demande {demande}.',
        '[Valider la demande]',
        'L’outil prépare une première version.',
        'Je peux ensuite ajuster chaque partie sans tout recommencer.',
      ],
      extra: [
        'Je change un titre, là, juste en le demandant.',
        'Remarquez que je n’ai ouvert aucun autre logiciel.',
        'Et voilà, on a {resultat}.',
      ],
    },
    {
      title: 'Questions',
      core: ['On passe à vos questions.', '[Lire une question du chat]'],
      extra: ['N’hésitez pas, il n’y a pas de question bête.', '[Lire une deuxième question]'],
    },
    {
      title: 'Fin',
      core: ['Pour essayer {outil}, {cta}', { detendu: 'Merci d’avoir suivi, à bientôt.', pro: 'Merci pour votre attention, à très bientôt.', energique: 'Merci à tous, on se retrouve très vite !' }],
    },
  ],
};

const VIDEO_IA: Format = {
  id: 'video-ia',
  label: 'Vidéo tournée avec l’IA',
  summary: 'Une voix off à lire et, pour chaque partie, le plan à générer avec une IA vidéo.',
  defaultMinutes: 1,
  sections: [
    {
      title: 'Accroche',
      core: [{ detendu: 'Et si vous n’aviez plus à faire ça vous-même ?', pro: 'Voici une façon plus simple d’obtenir {resultat}.', energique: 'Arrêtez tout. Regardez ça.' }],
      shot: 'Gros plan sur un écran d’ordinateur la nuit, une seule phrase tapée dans un champ vide, lumière de lampe de bureau, faible profondeur de champ, 4 secondes.',
    },
    {
      title: 'Le problème',
      core: ['Créer {resultat}, d’habitude, ça prend du temps.'],
      extra: ['Il faut tout préparer, puis tout vérifier.'],
      shot: 'Plan moyen d’une personne fatiguée devant plusieurs fenêtres ouvertes, carnet couvert de notes, lumière froide, mouvement de caméra lent vers l’avant, 5 secondes.',
    },
    {
      title: 'La solution',
      core: ['Avec {outil}, une phrase suffit.', 'Vous demandez {demande}, et il s’occupe du reste.'],
      extra: ['Les textes et la mise en page arrivent ensemble.'],
      shot: 'Écran qui se remplit progressivement d’une mise en page propre, éléments qui apparaissent un à un, interface sombre, rendu net, 6 secondes.',
    },
    {
      title: 'Le résultat',
      core: ['Et voilà le résultat.'],
      extra: ['Il ne reste plus qu’à le montrer.'],
      shot: 'Plan large d’une personne détendue qui tourne son ordinateur portable vers la caméra pour montrer le résultat, sourire, lumière chaude, 5 secondes.',
    },
    {
      title: 'Appel à l’action',
      core: ['{cta}'],
      shot: 'Plan fixe sur fond noir, place libre au centre pour le nom de l’outil et le lien, 3 secondes.',
    },
  ],
};

const SHORT: Format = {
  id: 'short',
  label: 'Format court vertical',
  summary: 'Trente à soixante secondes pour TikTok, Reels ou Shorts.',
  defaultMinutes: 0.5,
  sections: [
    {
      title: 'Accroche',
      core: [{ detendu: 'J’ai trouvé comment ne plus faire ça à la main.', pro: 'Voici comment j’obtiens {resultat} en une seule demande.', energique: 'Ce que vous allez voir va vous faire gagner une soirée.' }],
    },
    {
      title: 'La preuve',
      core: ['Je demande à {outil} {demande}.', '[Montrer l’écran]', 'Et voilà {resultat}.'],
      extra: ['Pas de code, pas de logiciel compliqué.'],
    },
    { title: 'Fin', core: ['{cta}'] },
  ],
};

const TUTO: Format = {
  id: 'tuto',
  label: 'Tutoriel pas à pas',
  summary: 'Expliquer comment obtenir le résultat, étape par étape.',
  defaultMinutes: 2,
  sections: [
    {
      title: 'Introduction',
      core: ['Dans ce tutoriel, je vous montre comment obtenir {resultat} avec {outil}.', 'Je vous montre chaque étape, depuis le début.'],
      extra: ['Si vous êtes {public}, c’est fait pour vous, même sans connaissances techniques.'],
    },
    {
      title: 'Étapes',
      core: [
        'D’abord, ouvrez {outil}.',
        '[Montrer la page d’accueil]',
        'Ensuite, décrivez ce que vous voulez. Ici, je demande {demande}.',
        'Enfin, validez et laissez l’outil travailler.',
      ],
      extra: [
        'Soyez précis dans votre demande : le résultat sera plus proche de ce que vous imaginez.',
        'Vous pouvez corriger chaque partie après coup, en une phrase.',
      ],
    },
    {
      title: 'Récapitulatif',
      core: ['On récapitule : une seule demande suffit pour obtenir {resultat}.'],
      extra: ['Le plus long, finalement, c’est de choisir ce qu’on veut.'],
    },
    { title: 'Fin', core: ['{cta}', 'Merci d’avoir suivi ce tutoriel.'] },
  ],
};

export const FORMATS: readonly Format[] = [LIVE_FLEMME, LIVE_DEMO, VIDEO_IA, SHORT, TUTO];

export const TONES: readonly { id: Tone; label: string }[] = [
  { id: 'detendu', label: 'Détendu' },
  { id: 'pro', label: 'Professionnel' },
  { id: 'energique', label: 'Énergique' },
];

export function findFormat(id: FormatId): Format {
  return FORMATS.find((format) => format.id === id) ?? LIVE_FLEMME;
}
