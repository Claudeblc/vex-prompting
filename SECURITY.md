# Sécurité

Vex Prompting est un site statique : il n'a ni serveur, ni base de données, ni compte.

## Ce qui compte

- La clé d'API que vous saisissez reste dans le stockage de votre navigateur, une par fournisseur, et n'est envoyée qu'à l'adresse officielle de ce fournisseur.
- Les réponses d'IA, les scripts et le contexte du live sont toujours affichés comme du texte.
- Le site est servi avec une politique de sécurité du contenu stricte (`public/_headers`) : aucun script externe ni en ligne, appels réseau limités aux trois fournisseurs.

Conseil : créez une clé dédiée à Vex Prompting, avec un plafond de dépense chez le fournisseur, et effacez-la depuis les réglages sur un ordinateur partagé.

## Signaler une faille

Merci de ne pas ouvrir de ticket public. Utilisez le signalement privé de GitHub : onglet « Security », puis « Report a vulnerability ».
