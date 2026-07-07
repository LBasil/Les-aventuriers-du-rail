# Trans-France Express — Spécification de jeu

> Jeu de plateau web (HTML/CSS/JS) inspiré des jeux de collecte de cartes et de
> revendication de routes ferroviaires, avec un plateau et un thème originaux
> (villes de France). Ce document n'est PAS une copie des règles ou du visuel
> d'un jeu du commerce : les mécaniques ci-dessous (piocher des cartes,
> revendiquer une route, compléter des destinations secrètes) sont des
> mécaniques de jeu génériques, largement répandues dans les jeux de société.
> Le nom, le plateau et les visuels sont à créer de zéro.

## 1. Concept général

- **Type** : jeu de plateau / cartes, 2 joueurs, en local (même écran ou
  tour par tour sur le même appareil).
- **Objectif** : marquer le plus de points en revendiquant des routes entre
  villes françaises, en complétant des objectifs secrets ("destinations"),
  et en réalisant la route continue la plus longue.
- **Durée d'une partie** : ~20-30 minutes.
- **Plateforme V1** : navigateur, HTML/CSS/JS pur (pas de framework
  obligatoire, à discuter — voir section 8).

## 2. Composants du jeu

| Élément | Détail |
|---|---|
| Plateau | Carte de France stylisée avec ~25-30 villes reliées par des routes colorées |
| Cartes Wagon | 8 couleurs (bleu, rouge, vert, jaune, violet, blanc, noir, orange) + cartes "Joker" (locomotives) |
| Cartes Destination | Objectifs secrets indiquant 2 villes à relier + points associés |
| Wagons | Chaque joueur dispose d'un stock de wagons (ex: 40) à poser sur les routes |
| Gares | Chaque joueur dispose de 3 gares (permettent d'utiliser une route adverse en cas de blocage) |
| Score | Piste de score autour du plateau ou affichage digital |

## 3. Mise en place

1. Chaque joueur choisit une couleur et reçoit son stock de wagons + 3 gares.
2. Mélanger les cartes Wagon, distribuer 4 cartes à chaque joueur.
3. Révéler 5 cartes Wagon face visible à côté de la pioche.
4. Mélanger les cartes Destination, distribuer 3 à chaque joueur.
   Chaque joueur en garde **au moins 2**, il peut défausser les autres
   (face cachée, sous la pioche Destination).
5. Le joueur qui a le plus voyagé en train commence (ou tirage au sort).

## 4. Déroulement d'un tour

À son tour, un joueur choisit **une seule** des actions suivantes :

### A. Piocher des cartes Wagon
- Prendre 2 cartes parmi les 5 visibles et/ou la pioche (en pioche
  aveugle), OU
- Prendre 1 locomotive visible (compte double, termine le tour).
- Si une locomotive est piochée en aveugle, elle compte comme une carte
  normale (ne termine pas forcément le tour).
- Après avoir pris une carte visible, la remplacer immédiatement par la
  suivante de la pioche.

### B. Revendiquer une route
- Choisir une route libre sur le plateau.
- Défausser autant de cartes Wagon de la couleur de la route (ou des
  locomotives en complément) que sa longueur.
- **Routes grises** : peuvent être revendiquées avec n'importe quelle
  couleur uniforme.
- **Tunnels** : après avoir annoncé les cartes utilisées, retourner les
  3 premières cartes de la pioche. Pour chaque carte de la même couleur
  qui apparaît, le joueur doit défausser une carte supplémentaire de
  cette couleur (ou renoncer et perdre son tour d'action sur cette route).
- **Ferries** : certaines routes exigent qu'au moins 1 (ou plusieurs)
  des cartes défaussées soient des locomotives.
- Poser les wagons du joueur sur la route, avancer son score du nombre
  de points correspondant à la longueur (voir barème section 6).
- Une route revendiquée devient la propriété exclusive du joueur (à 2
  joueurs, personne d'autre ne peut prendre une route parallèle à une
  route déjà prise, si le plateau en propose).

### C. Construire une gare
- Défausser des cartes Wagon d'une seule couleur (1 carte pour la 1ère
  gare posée, 2 pour la 2e, 3 pour la 3e).
- Permet en fin de partie de bonifier une destination via une route
  adverse partant d'une ville où le joueur a une gare (règle à
  simplifier/valider ensemble si besoin — variante optionnelle pour la
  V1).

### D. Piocher de nouvelles destinations
- Piocher 3 cartes Destination, en garder au moins 1.

## 5. Fin de partie

- Dès qu'un joueur a **2 wagons ou moins** en réserve à la fin de son
  tour, chaque autre joueur joue encore un dernier tour, puis la partie
  s'arrête.

## 6. Décompte des points

**Barème de longueur de route :**

| Longueur | Points |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 4 |
| 4 | 7 |
| 5 | 10 |
| 6 | 15 |

- **Destinations réussies** : + points indiqués sur la carte.
- **Destinations ratées** : − points indiqués sur la carte.
- **Route continue la plus longue** : bonus de +10 points au joueur
  ayant la plus longue chaîne ininterrompue de wagons.
- Le joueur avec le plus de points gagne. En cas d'égalité, celui avec
  le plus de destinations complétées l'emporte.

## 7. Plateau : villes et routes (à concevoir)

- Choisir ~25-30 villes françaises (ex : Paris, Lyon, Marseille,
  Bordeaux, Lille, Strasbourg, Nantes, Toulouse, Rennes, Nice...).
- Dessiner un réseau original de routes entre elles (longueurs 1 à 6,
  couleurs variées, quelques routes grises, 2-3 tunnels, 1-2 ferries)
  **inventé pour ce projet**, pas recopié d'un plateau existant.
- Pour la V1 avec 2 joueurs, prévoir un plateau plus resserré (moins de
  villes) pour des parties dynamiques.

## 8. Spec technique (V1 web)

- **Stack** : HTML/CSS/JS vanilla (ou léger framework si Claude Code le
  juge plus simple à maintenir — à valider ensemble).
- **Rendu du plateau** : SVG (villes = points cliquables, routes =
  chemins colorés cliquables/sélectionnables).
- **État du jeu** : un objet JS central (`gameState`) contenant : joueurs,
  main de cartes, pioche, destinations, routes prises, score, tour
  courant.
- **Pas de sauvegarde serveur en V1** : tout en mémoire (état perdu au
  rechargement, à améliorer plus tard si besoin avec localStorage).
- **UI minimale V1** :
  - Plateau central avec villes/routes
  - Main de cartes Wagon du joueur actif
  - 5 cartes visibles + pioche
  - Cartes Destination du joueur actif (cachées à l'autre joueur, à gérer
    via un écran "passe l'appareil" entre les tours)
  - Score et wagons restants affichés
  - Bouton "fin de tour"

## 9. Périmètre V1 (MVP)

**Inclus :**
- 2 joueurs, plateau villes de France (version resserrée)
- Actions A, B (piocher cartes / revendiquer route), y compris tunnels
  et ferries
- Pioche et défausse de destinations (action D)
- Fin de partie + décompte des points + route la plus longue

**Reporté à une V2 (si envie) :**
- Gares (action C) et leur bonus de fin de partie
- Mode 3+ joueurs
- Sauvegarde de partie / plusieurs parties
- Plateau complet (30 villes) et variantes de règles

## 10. Prochaines étapes pour Claude Code

1. Générer la structure du projet (index.html, style.css, game.js ou
   équivalent).
2. Modéliser les données du plateau (villes, coordonnées, routes,
   longueurs, couleurs) dans un fichier JS/JSON séparé.
3. Implémenter le `gameState` et la boucle de tour.
4. Implémenter chaque action (piocher, revendiquer route avec tunnels/
   ferries, piocher destinations).
5. Implémenter le décompte de fin de partie.
6. Itérer sur l'UI/UX une fois la logique fonctionnelle.
