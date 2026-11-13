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
