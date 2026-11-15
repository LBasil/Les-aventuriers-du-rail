// Règles avancées : gares, destinations, fin de partie, blocages, et parties complètes simulées.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(seed = 1) {
  const ctx = vm.createContext({ console, Math: Object.create(Math) });
  // Hasard reproductible pour que chaque partie simulée soit rejouable.
  let s = seed;
  ctx.Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (const file of ['board-data.js', 'decks.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), ctx, { filename: file });
  }
  const run = (code) => vm.runInContext(code, ctx);
  return { Game: run('Game'), run };
}

function start(ctx) {
  const { Game } = ctx;
  Game.newGame('Alice', 'Bob');
  const s = Game.getState();
  for (const p of s.players) Game.confirmSetupDestinations(p.pendingDestinationChoice.slice(0, 1).map((d) => d.id));
  return s;
}

function setHand(player, hand) {
  for (const k of Object.keys(player.hand)) player.hand[k] = 0;
  Object.assign(player.hand, hand);
}

test('piocher sur une pioche vide ne laisse pas de tour ouvert', () => {
  const ctx = load();
  const s = start(ctx);
  s.wagonDeck.length = 0;
  s.wagonDiscard.length = 0;
  assert.equal(ctx.Game.drawBlind().ok, false);
  assert.equal(s.turn, null);
  assert.equal(ctx.Game.actionDrawDestinations().ok, true); // une autre action reste possible
});

test('après une première carte, le tour se termine seul s\'il ne reste rien à piocher', () => {
  const ctx = load();
  const s = start(ctx);
  s.wagonDeck.length = 1;
  s.wagonDiscard.length = 0;
  s.faceUp.length = 0;
  assert.equal(ctx.Game.drawBlind().ok, true);
  assert.equal(s.currentPlayerIndex, 1);
});

test('une locomotive visible ne peut pas être prise en deuxième carte', () => {
  const ctx = load();
  const s = start(ctx);
  s.faceUp = ['blue', 'locomotive', 'red', 'green', 'yellow'];
  assert.equal(ctx.Game.drawFaceUp(0).ok, true);
  assert.equal(ctx.Game.drawFaceUp(0).ok, false); // la locomotive est maintenant en position 0
  assert.equal(s.currentPlayerIndex, 0);
});

test('prendre une locomotive visible compte pour deux cartes et termine le tour', () => {
  const ctx = load();
  const s = start(ctx);
  s.faceUp = ['locomotive', 'red', 'green', 'yellow', 'blue'];
  assert.equal(ctx.Game.drawFaceUp(0).ok, true);
  assert.equal(s.currentPlayerIndex, 1);
});

test('passer son tour est interdit tant qu\'une action est possible', () => {
  const ctx = load();
  start(ctx);
  const res = ctx.Game.passTurn();
  assert.equal(res.ok, false);
});

test('passer son tour est permis quand rien n\'est possible, et deux passages terminent la partie', () => {
  const ctx = load();
  const s = start(ctx);
  s.wagonDeck.length = 0;
  s.wagonDiscard.length = 0;
  s.faceUp.length = 0;
  s.destinationDeck.length = 0;
  for (const p of s.players) { setHand(p, {}); p.stations = 0; }
  assert.equal(ctx.Game.canAct(), false);
  assert.equal(ctx.Game.passTurn().ok, true);
  assert.equal(s.currentPlayerIndex, 1);
  const last = ctx.Game.passTurn();
  assert.equal(last.gameOver, true);
  assert.equal(s.phase, 'gameover');
});

test('le tirage de destinations ne peut pas être annulé (sinon on pourrait parcourir tout le paquet)', () => {
  const ctx = load();
  start(ctx);
  assert.equal(ctx.Game.cancelDrawnDestinations, undefined);
  const { drawn } = ctx.Game.actionDrawDestinations();
  assert.equal(ctx.Game.confirmDrawnDestinations([]).ok, false); // au moins une à garder
  assert.equal(ctx.Game.confirmDrawnDestinations([drawn[0].id]).ok, true);
});

test('gares : coût 1, 2 puis 3 cartes ; une seule gare par ville pour tous les joueurs', () => {
  const ctx = load();
  const s = start(ctx);
  const [a, b] = s.players;
  assert.equal(ctx.Game.stationCost(a), 1);
  setHand(a, { blue: 5 });
  assert.equal(ctx.Game.buildStation('lyon', 'blue', 0).ok, true);
  assert.equal(ctx.Game.stationCost(a), 2);
  setHand(b, { red: 5 });
  const res = ctx.Game.buildStation('lyon', 'red', 0); // ville déjà occupée par Alice
  assert.equal(res.ok, false);
  assert.match(res.error, /déjà une gare/);
  assert.equal(ctx.Game.buildStation('dijon', 'red', 0).ok, true);
});

test('fin de partie : chaque gare non posée rapporte 4 points', () => {
  const ctx = load();
  const s = start(ctx);
  s.players[0].destinations = [];
  s.players[1].destinations = [];
  s.players[1].stations = 1; // Bob en a posé deux
  s.wagonDeck.length = 0; s.wagonDiscard.length = 0; s.faceUp.length = 0; s.destinationDeck.length = 0;
  for (const p of s.players) setHand(p, {});
  ctx.Game.passTurn();
  ctx.Game.passTurn();
  assert.equal(s.finalResults[0].stationBonus, 12);
  assert.equal(s.finalResults[1].stationBonus, 4);
});

test('gare : une seule route adverse par gare compte pour une destination', () => {
  const ctx = load();
  const s = start(ctx);
  const route = (id) => s.routes.find((r) => r.id === id);
  // Alice : destination Lille -> Orléans. Bob possède Lille-Paris (r1) et Paris-Orléans (r11).
  // Alice n'a posé qu'une gare, à Paris : elle peut emprunter UNE route adverse partant de Paris.
  route('r1').claimedBy = 1;
  route('r11').claimedBy = 1;
  const alice = s.players[0];
  alice.destinations = [{ id: 'x', from: 'lille', to: 'orleans', points: 10 }];
  s.players[1].destinations = [];
  alice.placedStations = ['paris'];
  alice.stations = 2;
  s.wagonDeck.length = 0; s.wagonDiscard.length = 0; s.faceUp.length = 0; s.destinationDeck.length = 0;
  for (const p of s.players) setHand(p, {});
  ctx.Game.passTurn();
  ctx.Game.passTurn();
  // Lille-Paris est empruntée à Bob, mais Paris-Orléans est la 2e route de la même gare : refusé.
  assert.equal(s.finalResults[0].destinationDetails[0].success, false);
});

test('gare : avec une route à soi et une gare, la destination est réussie', () => {
  const ctx = load();
  const s = start(ctx);
  const route = (id) => s.routes.find((r) => r.id === id);
  route('r1').claimedBy = 1; // Lille-Paris à Bob
  route('r11').claimedBy = 0; // Paris-Orléans à Alice
  const alice = s.players[0];
  alice.destinations = [{ id: 'x', from: 'lille', to: 'orleans', points: 10 }];
  s.players[1].destinations = [];
  alice.placedStations = ['paris'];
  alice.stations = 2;
  s.wagonDeck.length = 0; s.wagonDiscard.length = 0; s.faceUp.length = 0; s.destinationDeck.length = 0;
  for (const p of s.players) setHand(p, {});
  ctx.Game.passTurn();
  ctx.Game.passTurn();
  assert.equal(s.finalResults[0].destinationDetails[0].success, true);
});

test('fin de partie : le dernier tour se déclenche aussi quand plus aucune route libre n\'est abordable', () => {
  const ctx = load();
  const s = start(ctx);
  // Seule reste libre r17 (4 wagons) ; les deux joueurs n'ont plus que 3 wagons.
  s.routes.forEach((r) => { if (r.id !== 'r17') r.claimedBy = 1; });
  assert.equal(s.routes.find((r) => r.id === 'r17').length, 4);
  s.players.forEach((p) => (p.trainsLeft = 3));
  assert.equal(ctx.Game.drawBlind().ok, true);
  assert.equal(ctx.Game.drawBlind().ok, true);
  assert.equal(s.finalRound.active, true);
});

test('route la plus longue : +10 points, partagés en cas d\'égalité', () => {
  const ctx = load();
  const s = start(ctx);
  const route = (id) => s.routes.find((r) => r.id === id);
  route('r7').claimedBy = 0; // Rouen-Rennes, 3
  route('r9').claimedBy = 1; // Rennes-Nantes, 2
  route('r12').claimedBy = 1; // Orléans-Nantes, 3 (Bob : 3 + 2 = 5 en continu)
  for (const p of s.players) p.destinations = [];
  s.wagonDeck.length = 0; s.wagonDiscard.length = 0; s.faceUp.length = 0; s.destinationDeck.length = 0;
  for (const p of s.players) { setHand(p, {}); p.stations = 0; }
  ctx.Game.passTurn();
  ctx.Game.passTurn();
  assert.equal(s.finalResults[0].bonus, 0);
  assert.equal(s.finalResults[1].bonus, 10);
  assert.equal(s.finalResults[1].longest, 5);
});

test('tunnel : cartes supplémentaires exigées, ou renoncer sans perdre de cartes', () => {
  const ctx = load(3);
  const s = start(ctx);
  const p = ctx.Game.currentPlayer();
  setHand(p, { green: 8 });
  const res = ctx.Game.claimRoute('r4', 'green', 0); // Nancy-Strasbourg, tunnel de 2
  assert.equal(res.tunnel, true);
  assert.equal(res.revealed.length, 3);
  const extra = res.extraNeeded;
  assert.equal(extra, res.revealed.filter((c) => c === 'green' || c === 'locomotive').length);
  assert.equal(ctx.Game.resolveTunnelPay(extra + 1, 0).ok, false); // total exact exigé
  assert.equal(ctx.Game.resolveTunnelRenounce().ok, true);
  assert.equal(p.hand.green, 8); // renoncer ne coûte aucune carte
  assert.equal(ctx.Game.getRoute('r4').claimedBy, null);
});

// --- Parties complètes ---------------------------------------------------------------------

// Joueur automatique : joue uniquement par l'API publique, avec des choix pseudo-aléatoires.
function playFullGame(seed) {
  const ctx = load(seed);
  const { Game, run } = ctx;
  const COLORS = run('WAGON_COLORS');
  const LOCO = run('LOCOMOTIVE');
  const TOTAL = 8 * 14 + 14;
  let r = seed * 2654435761 % 4294967296;
  const rnd = () => (r = (r * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const s = start(ctx);
  const cardCount = () => {
    let c = s.wagonDeck.length + s.wagonDiscard.length + s.faceUp.length;
    s.players.forEach((p) => Object.values(p.hand).forEach((v) => (c += v)));
    if (s.turn && s.turn.revealed) c += s.turn.revealed.length;
    return c;
  };
  const tryClaim = (p) => {
    const routes = s.routes.filter((x) => x.claimedBy == null && x.length <= p.trainsLeft).sort(() => rnd() - 0.5);
    for (const route of routes) {
      for (const color of route.color === 'gray' ? COLORS : [route.color]) {
        for (let loco = route.ferry || 0; loco <= route.length; loco++) {
          if (!Game.validatePayment(route, color, loco, p.hand).ok) continue;
          const res = Game.claimRoute(route.id, color, loco);
          assert.equal(res.ok, true, res.error);
          if (res.tunnel) {
            const need = res.extraNeeded;
            const haveColor = p.hand[color] - (route.length - loco);
            const haveLoco = p.hand[LOCO] - loco;
            let paid = false;
            for (let c = 0; c <= need && !paid; c++) {
              if (haveColor >= c && haveLoco >= need - c) paid = Game.resolveTunnelPay(c, need - c).ok;
            }
            if (!paid) Game.resolveTunnelRenounce();
          }
          return true;
        }
      }
    }
    return false;
  };
  let turns = 0;
  while (s.phase === 'playing') {
    assert.ok(++turns < 1500, `la partie ${seed} ne se termine pas`);
    const p = Game.currentPlayer();
    let done = rnd() < 0.7 && tryClaim(p);
    if (!done && rnd() < 0.1 && s.destinationDeck.length >= 3) {
      const d = Game.actionDrawDestinations();
      done = d.ok && Game.confirmDrawnDestinations([d.drawn[0].id]).ok;
    }
    if (!done) {
      let ok = false;
      for (let k = 0; k < 2; k++) {
        let res = rnd() < 0.5 ? Game.drawBlind() : Game.drawFaceUp(Math.floor(rnd() * 5));
        for (let i = 0; i < 5 && !res.ok; i++) res = Game.drawFaceUp(i);
        if (res.ok) { ok = true; if (!s.turn) break; }
      }
      if (!ok && !tryClaim(p)) {
        const d = Game.actionDrawDestinations();
        if (d.ok) Game.confirmDrawnDestinations([d.drawn[0].id]);
        else Game.passTurn();
      }
    }
    assert.equal(cardCount(), TOTAL, `cartes perdues ou créées (partie ${seed}, tour ${turns})`);
    for (const pl of s.players) {
      assert.ok(pl.trainsLeft >= 0 && pl.trainsLeft <= 45);
      for (const v of Object.values(pl.hand)) assert.ok(v >= 0);
    }
  }
  return s;
}

test('40 parties complètes simulées : toutes se terminent, sans carte perdue ni état incohérent', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = playFullGame(seed);
    assert.equal(s.phase, 'gameover');
    assert.equal(s.finalResults.length, 2);
    // Le score final de chacun est cohérent avec le détail affiché sur l'écran de fin.
    s.finalResults.forEach((res, i) => {
      assert.equal(s.players[i].score, res.baseScore + res.destinationPoints + res.bonus + res.stationBonus);
    });
    // Chaque route revendiquée correspond aux wagons consommés.
    s.players.forEach((p, i) => {
      const used = s.routes.filter((r) => r.claimedBy === i).reduce((sum, r) => sum + r.length, 0);
      assert.equal(p.trainsLeft, 45 - used);
    });
  }
});
