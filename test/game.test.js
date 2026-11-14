// Charge les scripts du navigateur tels quels (sans les modifier) dans un contexte isolé.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({ console, Math });
for (const file of ['board-data.js', 'decks.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), ctx, { filename: file });
}
const run = (code) => vm.runInContext(code, ctx);
const Game = run('Game');

function startGame() {
  Game.newGame('Alice', 'Bob');
  const s = Game.getState();
  const ids = (p) => p.pendingDestinationChoice.map((d) => d.id);
  Game.confirmSetupDestinations(ids(s.players[0]).slice(0, 1));
  Game.confirmSetupDestinations(ids(s.players[1]).slice(0, 1));
  return Game.getState();
}

// Donne une main précise au joueur courant pour rendre les tests déterministes.
function giveHand(state, hand) {
  const p = Game.currentPlayer();
  for (const k of Object.keys(p.hand)) p.hand[k] = 0;
  Object.assign(p.hand, hand);
  return p;
}

test('le réseau est cohérent : routes entre villes existantes, identifiants uniques', () => {
  const cities = new Set(run('CITIES').map((c) => c.id));
  const routes = run('ROUTES');
  assert.equal(new Set(routes.map((r) => r.id)).size, routes.length);
  for (const r of routes) {
    assert.ok(cities.has(r.from), `${r.id} : ville inconnue ${r.from}`);
    assert.ok(cities.has(r.to), `${r.id} : ville inconnue ${r.to}`);
    assert.notEqual(r.from, r.to);
    assert.ok(r.length >= 1 && r.length <= 6, `${r.id} : longueur ${r.length}`);
  }
});

test('le paquet de wagons contient 8 couleurs x 14 + 14 locomotives', () => {
  const deck = run('buildWagonDeck()');
  assert.equal(deck.length, 8 * 14 + 14);
  assert.equal(deck.filter((c) => c === 'locomotive').length, 14);
});

test('mélange : conserve les cartes sans modifier le tableau d\'origine', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = run('shuffle')(input);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
});

test('nouvelle partie : 2 joueurs, 45 wagons, 4 cartes en main, 5 cartes visibles', () => {
  const s = Game.newGame('Alice', 'Bob');
  assert.equal(s.players.length, 2);
  for (const p of s.players) {
    assert.equal(p.trainsLeft, 45);
    assert.equal(Object.values(p.hand).reduce((a, b) => a + b, 0), 4);
    assert.equal(p.pendingDestinationChoice.length, 3);
  }
  assert.equal(s.faceUp.length, 5);
  assert.ok(s.faceUp.filter((c) => c === 'locomotive').length < 3);
  assert.equal(s.phase, 'setup');
});

test('mise en place : garder au moins une destination, puis la partie démarre', () => {
  Game.newGame();
  assert.equal(Game.confirmSetupDestinations([]).ok, false);
  const state = startGame();
  assert.equal(state.phase, 'playing');
});

test('piocher deux cartes à l\'aveugle termine le tour', () => {
  const state = startGame();
  assert.equal(state.currentPlayerIndex, 0);
  assert.equal(Game.drawBlind().ok, true);
  assert.equal(state.currentPlayerIndex, 0);
  assert.equal(Game.drawBlind().ok, true);
  assert.equal(state.currentPlayerIndex, 1);
});

test('prendre une route : défausse les cartes, retire les wagons, marque les points', () => {
  const state = startGame();
  const p = giveHand(state, { blue: 3 });
  const res = Game.claimRoute('r1', 'blue', 0); // Lille-Paris, 2 bleus
  assert.equal(res.ok, true);
  assert.equal(p.hand.blue, 1);
  assert.equal(p.trainsLeft, 43);
  assert.equal(p.score, 2);
  assert.equal(Game.getRoute('r1').claimedBy, 0);
  assert.equal(state.currentPlayerIndex, 1);
});

test('refus : route déjà prise, mauvaise couleur, cartes insuffisantes', () => {
  const state = startGame();
  giveHand(state, { blue: 2, red: 5 });
  assert.equal(Game.claimRoute('r1', 'red', 0).ok, false); // mauvaise couleur
  assert.equal(Game.claimRoute('inconnue', 'blue', 0).ok, false);
  giveHand(state, { blue: 1 });
  assert.equal(Game.claimRoute('r1', 'blue', 0).ok, false); // pas assez de cartes
  giveHand(state, { blue: 2 });
  assert.equal(Game.claimRoute('r1', 'blue', 0).ok, true);
  giveHand(state, { blue: 2 });
  assert.equal(Game.claimRoute('r1', 'blue', 0).ok, false); // déjà prise
});

test('route grise : n\'importe quelle couleur ; locomotive possible en complément', () => {
  const state = startGame();
  const p = giveHand(state, { green: 1, locomotive: 1 });
  const res = Game.claimRoute('r5', 'green', 1); // Paris-Reims, 2 grises
  assert.equal(res.ok, true);
  assert.equal(p.hand.green, 0);
  assert.equal(p.hand.locomotive, 0);
});

test('ferry : exige au moins le nombre de locomotives indiqué', () => {
  const route = run('ROUTES').find((r) => r.id === 'r8'); // Rennes-Brest, ferry 1
  assert.equal(Game.validatePayment(route, 'black', 0, { black: 2, locomotive: 0 }).ok, false);
  assert.equal(Game.validatePayment(route, 'black', 1, { black: 1, locomotive: 1 }).ok, true);
});

test('le barème de points suit la longueur de la route', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(run('POINTS_BY_LENGTH'))), { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 });
});

test('fin de partie : un joueur à 2 wagons ou moins déclenche le dernier tour', () => {
  const state = startGame();
  const p = giveHand(state, { blue: 2 });
  p.trainsLeft = 2;
  Game.claimRoute('r1', 'blue', 0);
  assert.equal(state.finalRound.active, true);
  Game.drawBlind();
  Game.drawBlind(); // l'autre joueur joue son dernier tour
  assert.equal(state.phase, 'gameover');
  assert.ok(state.finalResults);
});
