// Logique de jeu de Trans-France Express : état central (gameState) et actions.
// Convention : chaque action publique renvoie { ok: true, ... } ou { ok: false, error }.

const Game = (() => {
  let state = null;

  function cityById(id) {
    return CITIES.find(c => c.id === id);
  }

  function getRoute(routeId) {
    return state.routes.find(r => r.id === routeId);
  }

  function currentPlayer() {
    return state.players[state.currentPlayerIndex];
  }

  function emptyHandCounts() {
    const h = {};
    WAGON_COLORS.forEach(c => (h[c] = 0));
    h[LOCOMOTIVE] = 0;
    return h;
  }

  function makePlayer(name, color) {
    return {
      name,
      color,
      trainsLeft: 45,
      score: 0,
      hand: emptyHandCounts(),
      destinations: [],
      completedDestinations: [],
      failedDestinations: [],
      stations: 3,
      placedStations: [],
      pendingDestinationChoice: [],
    };
  }

  function drawWagonFromDeck() {
    if (state.wagonDeck.length === 0) {
      if (state.wagonDiscard.length === 0) return null;
      state.wagonDeck = shuffle(state.wagonDiscard);
      state.wagonDiscard = [];
    }
    return state.wagonDeck.pop();
  }

  function drawInto(handCounts) {
    const c = drawWagonFromDeck();
    if (c) handCounts[c] = (handCounts[c] || 0) + 1;
    return c;
  }

  function fillFaceUpOnce() {
    while (state.faceUp.length < 5) {
      const c = drawWagonFromDeck();
      if (c == null) break;
      state.faceUp.push(c);
    }
  }

  function ensureFaceUpValid() {
    fillFaceUpOnce();
    let guard = 0;
    while (
      state.faceUp.filter(c => c === LOCOMOTIVE).length >= 3 &&
      state.wagonDeck.length + state.wagonDiscard.length + state.faceUp.length >= 5 &&
      guard < 10
    ) {
      state.wagonDiscard.push(...state.faceUp);
      state.faceUp = [];
      fillFaceUpOnce();
      guard++;
    }
  }

  function drawDestinationCards(n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (state.destinationDeck.length === 0) break;
      drawn.push(state.destinationDeck.pop());
    }
    return drawn;
  }

  function newGame(name1, name2) {
    state = {
      phase: 'setup',
      players: [makePlayer(name1 || 'Joueur 1', 'p1'), makePlayer(name2 || 'Joueur 2', 'p2')],
      currentPlayerIndex: 0,
      wagonDeck: buildWagonDeck(),
      wagonDiscard: [],
      faceUp: [],
      destinationDeck: buildDestinationDeck(),
      routes: ROUTES.map(r => ({ ...r, claimedBy: null })),
      turn: null,
      finalRound: { active: false, turnsRemaining: 0 },
      setupIndex: 0,
      finalResults: null,
      message: '',
    };
    for (const p of state.players) {
      for (let i = 0; i < 4; i++) drawInto(p.hand);
    }
    ensureFaceUpValid();
    for (const p of state.players) {
      const [base] = drawDestinationCards(1);
      if (base) p.destinations.push({ ...base, isBase: true });
      p.pendingDestinationChoice = drawDestinationCards(3);
    }
    return state;
  }

  function confirmSetupDestinations(keptIds) {
    const player = state.players[state.setupIndex];
    const pending = player.pendingDestinationChoice;
    if (keptIds.length < 1) return { ok: false, error: 'Garder au moins 1 destination bonus.' };
    const kept = pending.filter(d => keptIds.includes(d.id));
    const discarded = pending.filter(d => !keptIds.includes(d.id));
    player.destinations.push(...kept);
    state.destinationDeck.unshift(...discarded);
    player.pendingDestinationChoice = [];
    state.setupIndex += 1;
    if (state.setupIndex >= state.players.length) {
      state.phase = 'playing';
    }
    return { ok: true };
  }

  function endTurn() {
    const player = currentPlayer();
    if (!state.finalRound.active && player.trainsLeft <= 2) {
      state.finalRound = { active: true, turnsRemaining: state.players.length - 1 };
    } else if (state.finalRound.active) {
      state.finalRound.turnsRemaining -= 1;
    }
    state.turn = null;
    if (state.finalRound.active && state.finalRound.turnsRemaining <= 0) {
      finishGame();
    } else {
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    }
  }

  function drawFaceUp(index) {
    if (state.phase !== 'playing') return { ok: false, error: 'Partie non active.' };
    if (state.turn && state.turn.type !== 'draw') {
      return { ok: false, error: 'Une autre action est en cours.' };
    }
    const card = state.faceUp[index];
    if (card == null) return { ok: false, error: 'Aucune carte ici.' };
    const isLoco = card === LOCOMOTIVE;
    if (!state.turn) state.turn = { type: 'draw', drawsLeft: 2 };
    if (isLoco && state.turn.drawsLeft !== 2) {
      return { ok: false, error: 'Une locomotive visible ne peut être prise qu\'en premier tirage.' };
    }
    const player = currentPlayer();
    player.hand[card] += 1;
    state.faceUp.splice(index, 1);
    fillFaceUpOnce();
    ensureFaceUpValid();
    state.turn.drawsLeft = isLoco ? 0 : state.turn.drawsLeft - 1;
    if (state.turn.drawsLeft <= 0) endTurn();
    return { ok: true };
  }

  function drawBlind() {
    if (state.phase !== 'playing') return { ok: false, error: 'Partie non active.' };
    if (state.turn && state.turn.type !== 'draw') {
      return { ok: false, error: 'Une autre action est en cours.' };
    }
    if (!state.turn) state.turn = { type: 'draw', drawsLeft: 2 };
    const card = drawWagonFromDeck();
    if (card == null) return { ok: false, error: 'Pioche épuisée.' };
    const player = currentPlayer();
    player.hand[card] += 1;
    state.turn.drawsLeft -= 1;
    if (state.turn.drawsLeft <= 0) endTurn();
    return { ok: true };
  }

  function validatePayment(route, colorToUse, locoCount, hand) {
    const length = route.length;
    if (locoCount < 0 || locoCount > length) return { ok: false, error: 'Nombre de locomotives invalide.' };
    const colorCount = length - locoCount;
    if (colorCount > 0) {
      if (!colorToUse) return { ok: false, error: 'Choisissez une couleur.' };
      if (route.color !== 'gray' && colorToUse !== route.color) {
        return { ok: false, error: 'Couleur invalide pour cette route.' };
      }
      if ((hand[colorToUse] || 0) < colorCount) return { ok: false, error: 'Pas assez de cartes de cette couleur.' };
    }
    if ((hand[LOCOMOTIVE] || 0) < locoCount) return { ok: false, error: 'Pas assez de locomotives.' };
    if (route.ferry && locoCount < route.ferry) {
      return { ok: false, error: `Ce ferry requiert au moins ${route.ferry} locomotive(s).` };
    }
    return { ok: true, colorCount };
  }

  function claimRoute(routeId, colorToUse, locoCount) {
    if (state.phase !== 'playing') return { ok: false, error: 'Partie non active.' };
    if (state.turn) return { ok: false, error: 'Une autre action est en cours.' };
    const route = getRoute(routeId);
    if (!route) return { ok: false, error: 'Route introuvable.' };
    if (route.claimedBy != null) return { ok: false, error: 'Route déjà prise.' };
    const player = currentPlayer();
    if (player.trainsLeft < route.length) return { ok: false, error: 'Pas assez de wagons.' };

    const check = validatePayment(route, colorToUse, locoCount, player.hand);
    if (!check.ok) return check;

    if (route.tunnel) {
      const revealed = [];
      for (let i = 0; i < 3; i++) {
        const c = drawWagonFromDeck();
        if (c) revealed.push(c);
      }
      const extraNeeded = revealed.filter(c => c === colorToUse || c === LOCOMOTIVE).length;
      state.turn = {
        type: 'tunnel-pending',
        routeId,
        colorToUse,
        baseLoco: locoCount,
        baseColor: check.colorCount,
        revealed,
        extraNeeded,
      };
      return { ok: true, tunnel: true, revealed, extraNeeded };
    }

    finalizeRouteClaim(route, colorToUse, locoCount, check.colorCount, []);
    endTurn();
    return { ok: true };
  }

  function finalizeRouteClaim(route, colorToUse, locoCount, colorCount, extraDiscards) {
    const player = currentPlayer();
    if (colorCount > 0) {
      player.hand[colorToUse] -= colorCount;
      for (let i = 0; i < colorCount; i++) state.wagonDiscard.push(colorToUse);
    }
    if (locoCount > 0) {
      player.hand[LOCOMOTIVE] -= locoCount;
      for (let i = 0; i < locoCount; i++) state.wagonDiscard.push(LOCOMOTIVE);
    }
    extraDiscards.forEach(c => {
      player.hand[c] -= 1;
      state.wagonDiscard.push(c);
    });
    route.claimedBy = state.currentPlayerIndex;
    route.paidColor = colorToUse;
    player.trainsLeft -= route.length;
    player.score += POINTS_BY_LENGTH[route.length];
  }

  function resolveTunnelPay(extraColorCount, extraLocoCount) {
    if (!state.turn || state.turn.type !== 'tunnel-pending') return { ok: false, error: 'Aucun tunnel en attente.' };
    const { routeId, colorToUse, baseLoco, baseColor, revealed, extraNeeded } = state.turn;
    if (extraColorCount + extraLocoCount !== extraNeeded) {
      return { ok: false, error: 'Le total des cartes supplémentaires doit être exact.' };
    }
    const player = currentPlayer();
    const totalColor = baseColor + extraColorCount;
    const totalLoco = baseLoco + extraLocoCount;
    if (colorToUse && (player.hand[colorToUse] || 0) < totalColor) {
      return { ok: false, error: 'Pas assez de cartes de cette couleur.' };
    }
    if (!colorToUse && extraColorCount > 0) {
      return { ok: false, error: 'Aucune couleur choisie.' };
    }
    if ((player.hand[LOCOMOTIVE] || 0) < totalLoco) {
      return { ok: false, error: 'Pas assez de locomotives.' };
    }
    const route = getRoute(routeId);
    state.wagonDiscard.push(...revealed);
    finalizeRouteClaim(route, colorToUse, totalLoco, totalColor, []);
    state.turn = null;
    endTurn();
    return { ok: true };
  }

  function resolveTunnelRenounce() {
    if (!state.turn || state.turn.type !== 'tunnel-pending') return { ok: false, error: 'Aucun tunnel en attente.' };
    state.wagonDiscard.push(...state.turn.revealed);
    state.turn = null;
    endTurn();
    return { ok: true };
  }

  function actionDrawDestinations() {
    if (state.phase !== 'playing') return { ok: false, error: 'Partie non active.' };
    if (state.turn) return { ok: false, error: 'Une autre action est en cours.' };
    const drawn = drawDestinationCards(3);
    if (drawn.length === 0) return { ok: false, error: 'Pioche destination vide.' };
    state.turn = { type: 'choose-destinations', drawn };
    return { ok: true, drawn };
  }

  function cancelDrawnDestinations() {
    if (!state.turn || state.turn.type !== 'choose-destinations') {
      return { ok: false, error: 'Aucun tirage de destinations en attente.' };
    }
    state.destinationDeck.unshift(...state.turn.drawn);
    state.turn = null;
    return { ok: true };
  }

  function confirmDrawnDestinations(keptIds) {
    if (!state.turn || state.turn.type !== 'choose-destinations') {
      return { ok: false, error: 'Aucun tirage de destinations en attente.' };
    }
    if (keptIds.length < 1) return { ok: false, error: 'Garder au moins 1 destination.' };
    const player = currentPlayer();
    const drawn = state.turn.drawn;
    const kept = drawn.filter(d => keptIds.includes(d.id));
    const discarded = drawn.filter(d => !keptIds.includes(d.id));
    player.destinations.push(...kept);
    state.destinationDeck.unshift(...discarded);
    state.turn = null;
    endTurn();
    return { ok: true };
  }

  function stationCost(player) {
    if (player.stations <= 0) return null;
    return 4 - player.stations; // 3 restantes -> 1ère gare = 1 carte, 2 restantes -> 2, 1 restante -> 3.
  }

  function validateStationPayment(colorToUse, locoCount, hand, cost) {
    if (locoCount < 0 || locoCount > cost) return { ok: false, error: 'Nombre de locomotives invalide.' };
    const colorCount = cost - locoCount;
    if (colorCount > 0) {
      if (!colorToUse) return { ok: false, error: 'Choisissez une couleur.' };
      if ((hand[colorToUse] || 0) < colorCount) return { ok: false, error: 'Pas assez de cartes de cette couleur.' };
    }
    if ((hand[LOCOMOTIVE] || 0) < locoCount) return { ok: false, error: 'Pas assez de locomotives.' };
    return { ok: true, colorCount };
  }

  function buildStation(cityId, colorToUse, locoCount) {
    if (state.phase !== 'playing') return { ok: false, error: 'Partie non active.' };
    if (state.turn) return { ok: false, error: 'Une autre action est en cours.' };
    if (!cityById(cityId)) return { ok: false, error: 'Ville introuvable.' };
    const player = currentPlayer();
    const cost = stationCost(player);
    if (cost == null) return { ok: false, error: 'Plus de gare disponible.' };
    if (player.placedStations.includes(cityId)) return { ok: false, error: 'Vous avez déjà une gare dans cette ville.' };

    const check = validateStationPayment(colorToUse, locoCount, player.hand, cost);
    if (!check.ok) return check;

    if (check.colorCount > 0) {
      player.hand[colorToUse] -= check.colorCount;
      for (let i = 0; i < check.colorCount; i++) state.wagonDiscard.push(colorToUse);
    }
    if (locoCount > 0) {
      player.hand[LOCOMOTIVE] -= locoCount;
      for (let i = 0; i < locoCount; i++) state.wagonDiscard.push(LOCOMOTIVE);
    }
    player.placedStations.push(cityId);
    player.stations -= 1;
    endTurn();
    return { ok: true };
  }

  function buildPlayerEdges(playerIndex) {
    return state.routes.filter(r => r.claimedBy === playerIndex);
  }

  // Une gare posée dans une ville permet, pour le décompte des destinations
  // uniquement (pas pour le bonus de route continue), d'emprunter les routes
  // adverses partant de cette ville — simplification du "bonifier une
  // destination via une route adverse" de la section 4.C de la spec.
  function isConnected(playerIndex, cityA, cityB) {
    const player = state.players[playerIndex];
    const edges = buildPlayerEdges(playerIndex).slice();
    player.placedStations.forEach(cityId => {
      state.routes.forEach(r => {
        if (r.claimedBy != null && r.claimedBy !== playerIndex && (r.from === cityId || r.to === cityId)) {
          edges.push(r);
        }
      });
    });
    const adj = {};
    edges.forEach(e => {
      (adj[e.from] = adj[e.from] || []).push(e.to);
      (adj[e.to] = adj[e.to] || []).push(e.from);
    });
    const visited = new Set([cityA]);
    const queue = [cityA];
    while (queue.length) {
      const node = queue.shift();
      if (node === cityB) return true;
      for (const next of adj[node] || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return cityA === cityB;
  }

  function longestTrail(edges) {
    if (edges.length === 0) return 0;
    let best = 0;
    const nodes = new Set();
    edges.forEach(e => {
      nodes.add(e.from);
      nodes.add(e.to);
    });

    function dfs(node, used, sum) {
      best = Math.max(best, sum);
      for (const e of edges) {
        if (used.has(e.id)) continue;
        if (e.from === node || e.to === node) {
          const next = e.from === node ? e.to : e.from;
          used.add(e.id);
          dfs(next, used, sum + e.length);
          used.delete(e.id);
        }
      }
    }

    for (const n of nodes) dfs(n, new Set(), 0);
    return best;
  }

  function finishGame() {
    state.phase = 'gameover';
    const results = state.players.map((player, idx) => {
      const destinationDetails = player.destinations.map(d => {
        const success = isConnected(idx, d.from, d.to);
        return { ...d, success };
      });
      const destinationPoints = destinationDetails.reduce(
        (sum, d) => sum + (d.success ? d.points : -d.points),
        0
      );
      const edges = buildPlayerEdges(idx);
      const longest = longestTrail(edges);
      return { destinationDetails, destinationPoints, longest, baseScore: player.score };
    });

    const maxLongest = Math.max(...results.map(r => r.longest));
    results.forEach((r, idx) => {
      const player = state.players[idx];
      let bonus = 0;
      if (r.longest === maxLongest && maxLongest > 0) bonus = LONGEST_ROUTE_BONUS;
      player.completedDestinations = r.destinationDetails.filter(d => d.success);
      player.failedDestinations = r.destinationDetails.filter(d => !d.success);
      player.score = r.baseScore + r.destinationPoints + bonus;
      r.bonus = bonus;
      r.finalScore = player.score;
    });

    state.finalResults = results;
  }

  function getState() {
    return state;
  }

  return {
    newGame,
    confirmSetupDestinations,
    drawFaceUp,
    drawBlind,
    validatePayment,
    claimRoute,
    resolveTunnelPay,
    resolveTunnelRenounce,
    actionDrawDestinations,
    cancelDrawnDestinations,
    confirmDrawnDestinations,
    stationCost,
    validateStationPayment,
    buildStation,
    getState,
    getRoute,
    currentPlayer,
    cityById,
  };
})();
