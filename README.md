# Trans-France Express

Jeu de plateau à deux joueurs dans le navigateur, sur une carte de la France : piocher des cartes wagon, relier des villes, remplir des destinations secrètes. HTML, CSS et JavaScript, sans dépendance ni build. Le plateau et le thème sont originaux.

Les règles et les choix de conception sont détaillés dans [GAME_SPEC.md](GAME_SPEC.md).

## Lancer

Ouvrir `index.html` dans un navigateur.

## Structure

- `js/board-data.js` : villes et routes
- `js/decks.js` : cartes wagon et destinations
- `js/game.js` : règles et état de la partie
- `js/ui.js`, `js/main.js` : affichage et événements

## Règles appliquées

Le détail est dans la fenêtre « Règles » du jeu et dans `GAME_SPEC.md`. Points qui précisent ou complètent la spécification :

- Mise en place : chaque joueur reçoit une destination de base et en choisit au moins une parmi trois autres.
- Une seule gare par ville, tous joueurs confondus. Chaque gare permet d'emprunter une seule route adverse partant de sa ville, pour les destinations uniquement. La meilleure combinaison est calculée automatiquement.
- Chaque gare non posée rapporte 4 points en fin de partie.
- Le tirage de destinations ne peut pas être annulé : sinon on pourrait regarder tout le paquet sans conséquence.
- Le dernier tour se déclenche à 2 wagons ou moins, ou quand plus aucune route libre n'est abordable avec les wagons restants. Sans cette seconde condition, la partie pouvait ne jamais se terminer.
- Si un joueur ne peut vraiment plus rien faire (pioches vides, aucune route ni gare abordable), son tour est passé ; si les deux passent, la partie se termine.

## Tests

```bash
npm test
```

Les tests chargent `board-data.js`, `decks.js` et `game.js` tels quels dans un contexte Node isolé, sans modifier le code du navigateur. Ils vérifient la cohérence du réseau, la mise en place, la pioche, la prise de route (couleur, locomotives, ferry, tunnel), les gares, le décompte des destinations, la route la plus longue et la fin de partie. Une simulation joue 40 parties complètes avec des choix pseudo-aléatoires et vérifie qu'elles se terminent toutes, qu'aucune carte n'est perdue ni créée à aucun tour, et que les scores correspondent au détail affiché.
