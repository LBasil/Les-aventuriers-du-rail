const COLOR_HEX = {
  blue: '#2e7eed', red: '#e5484d', green: '#30a46c', yellow: '#e8c400',
  violet: '#8e4ec6', white: '#f0f0f0', black: '#3a3a3a', orange: '#f76b15',
  gray: '#8b96a8', locomotive: '#c9a227',
};

const PLAYER_HEX = { p1: '#e0428b', p2: '#16a3a3' };

const UI = (() => {
  let els = {};
  let pendingHandoffCallback = null;

  function q(id) { return document.getElementById(id); }

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function cacheEls() {
    els = {
      screenStart: q('screen-start'),
      screenHandoff: q('screen-handoff'),
      screenSetupDestinations: q('screen-setup-destinations'),
      screenGame: q('screen-game'),
      screenEnd: q('screen-end'),
      inputP1: q('input-p1'),
      inputP2: q('input-p2'),
      btnStart: q('btn-start'),
      handoffName: q('handoff-name'),
      btnReveal: q('btn-reveal'),
      setupBaseDestination: q('setup-base-destination'),
      setupDestinationsList: q('setup-destinations-list'),
      btnConfirmSetupDestinations: q('btn-confirm-setup-destinations'),
      boardWrap: q('board-wrap'),
      setupBoardWrap: q('setup-board-wrap'),
      faceUpCards: q('face-up-cards'),
      deckPile: q('deck-pile'),
      deckCount: q('deck-count'),
      turnIndicator: q('turn-indicator'),
      turnHint: q('turn-hint'),
      btnActionDestinations: q('btn-action-destinations'),
      btnActionStation: q('btn-action-station'),
      handCards: q('hand-cards'),
      myDestinations: q('my-destinations'),
      playersInfo: q('players-info'),
      topbarScores: q('topbar-scores'),
      endResults: q('end-results'),
      btnNewGame: q('btn-new-game'),
      modalPayment: q('modal-payment'),
      paymentTitle: q('payment-title'),
      paymentBody: q('payment-body'),
      btnPaymentCancel: q('btn-payment-cancel'),
      btnPaymentClose: q('btn-payment-close'),
      btnPaymentConfirm: q('btn-payment-confirm'),
      modalTunnel: q('modal-tunnel'),
      tunnelBody: q('tunnel-body'),
      btnTunnelRenounce: q('btn-tunnel-renounce'),
      btnTunnelClose: q('btn-tunnel-close'),
      btnTunnelPay: q('btn-tunnel-pay'),
      modalDestinations: q('modal-destinations'),
      destinationsDrawList: q('destinations-draw-list'),
      btnDestinationsConfirm: q('btn-destinations-confirm'),
      btnDestinationsCancel: q('btn-destinations-cancel'),
      btnDestinationsClose: q('btn-destinations-close'),
      modalStation: q('modal-station'),
      stationBody: q('station-body'),
      btnStationConfirm: q('btn-station-confirm'),
      btnStationCancel: q('btn-station-cancel'),
      btnStationClose: q('btn-station-close'),
      toast: q('toast'),
    };
  }

  function showScreen(name) {
    ['screenStart', 'screenHandoff', 'screenSetupDestinations', 'screenGame', 'screenEnd'].forEach(k => {
      els[k].classList.add('hidden');
    });
    els[name].classList.remove('hidden');
    dismissToast();
  }

  function dismissToast() {
    clearTimeout(toast._t);
    els.toast.classList.add('hidden');
  }

  function toast(msg, isError) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    els.toast.classList.toggle('error', !!isError);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add('hidden'), 2600);
  }

  function goToPlayerScreen(playerIndex, targetFn) {
    const state = Game.getState();
    els.handoffName.textContent = state.players[playerIndex].name;
    pendingHandoffCallback = targetFn;
    showScreen('screenHandoff');
  }

  function onReveal() {
    if (pendingHandoffCallback) {
      const fn = pendingHandoffCallback;
      pendingHandoffCallback = null;
      fn();
    }
  }

  function afterAction(prevPlayerIndex) {
    const state = Game.getState();
    renderTopbarScores();
    if (state.phase === 'gameover') {
      showEndScreen();
      return;
    }
    if (state.currentPlayerIndex !== prevPlayerIndex) {
      goToPlayerScreen(state.currentPlayerIndex, showGameScreen);
    } else {
      renderAll();
    }
  }

  // ---------- Start / setup ----------

  function onStart() {
    const name1 = els.inputP1.value.trim() || 'Joueur 1';
    const name2 = els.inputP2.value.trim() || 'Joueur 2';
    Game.newGame(name1, name2);
    goToPlayerScreen(0, showSetupDestinationsScreen);
  }

  function showSetupDestinationsScreen() {
    const state = Game.getState();
    const player = state.players[state.setupIndex];
    const base = player.destinations.find(d => d.isBase);
    if (base) {
      const cityA = Game.cityById(base.from).name;
      const cityB = Game.cityById(base.to).name;
      els.setupBaseDestination.innerHTML = `<span><span class="destination-base-tag">Base</span><br>${cityA} — ${cityB}</span><span class="destination-points">${base.points} pts</span>`;
    }
    els.setupDestinationsList.innerHTML = '';
    player.pendingDestinationChoice.forEach(d => {
      els.setupDestinationsList.appendChild(destinationChoiceRow(d));
    });
    renderBoard(els.setupBoardWrap);
    showScreen('screenSetupDestinations');
  }

  function destinationChoiceRow(d) {
    const row = document.createElement('div');
    row.className = 'destination-choice-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.value = d.id;
    const label = document.createElement('label');
    const cityA = Game.cityById(d.from).name;
    const cityB = Game.cityById(d.to).name;
    label.textContent = `${cityA} — ${cityB}`;
    const pts = document.createElement('span');
    pts.className = 'destination-points';
    pts.textContent = `${d.points} pts`;
    row.appendChild(cb);
    row.appendChild(label);
    row.appendChild(pts);
    return row;
  }

  function onConfirmSetupDestinations() {
    const checked = Array.from(els.setupDestinationsList.querySelectorAll('input:checked')).map(i => i.value);
    const res = Game.confirmSetupDestinations(checked);
    if (!res.ok) {
      toast(res.error, true);
      return;
    }
    const state = Game.getState();
    if (state.phase === 'setup') {
      goToPlayerScreen(state.setupIndex, showSetupDestinationsScreen);
    } else {
      goToPlayerScreen(state.currentPlayerIndex, showGameScreen);
    }
  }

  // ---------- Main game screen ----------

  function showGameScreen() {
    showScreen('screenGame');
    renderAll();
  }

  function renderAll() {
    const state = Game.getState();
    if (!state || state.phase !== 'playing') return;
    renderTopbarScores();
    renderBoard();
    renderFaceUp();
    renderHand();
    renderMyDestinations();
    renderPlayersInfo();
    renderTurnPanel();
  }

  function renderTopbarScores() {
    const state = Game.getState();
    els.topbarScores.innerHTML = '';
    state.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'score-chip';
      chip.innerHTML = `<span class="dot" style="background:${PLAYER_HEX[p.color]}"></span>${p.name}: <strong>${p.score}</strong> pts · ${p.trainsLeft} wagons`;
      els.topbarScores.appendChild(chip);
    });
  }

  function isDrawAllowed() {
    const state = Game.getState();
    return !state.turn || state.turn.type === 'draw';
  }

  function currentDrawsLeft() {
    const state = Game.getState();
    return state.turn && state.turn.type === 'draw' ? state.turn.drawsLeft : 2;
  }

  function renderFaceUp() {
    const state = Game.getState();
    els.faceUpCards.innerHTML = '';
    const drawsLeft = currentDrawsLeft();
    state.faceUp.forEach((card, idx) => {
      const div = document.createElement('div');
      const isLoco = card === LOCOMOTIVE;
      div.className = `wagon-card color-${card}`;
      div.style.background = COLOR_HEX[card];
      div.textContent = CARD_LABELS[card];
      const disabled = !isDrawAllowed() || (isLoco && drawsLeft !== 2);
      if (disabled) div.classList.add('disabled');
      div.onclick = () => {
        const prev = Game.getState().currentPlayerIndex;
        const res = Game.drawFaceUp(idx);
        if (!res.ok) { toast(res.error, true); return; }
        afterAction(prev);
      };
      els.faceUpCards.appendChild(div);
    });
    els.deckCount.textContent = state.wagonDeck.length;
    els.deckPile.classList.toggle('disabled', !isDrawAllowed());
    els.deckPile.onclick = () => {
      if (!isDrawAllowed()) { toast('Terminez votre action en cours.', true); return; }
      const prev = Game.getState().currentPlayerIndex;
      const res = Game.drawBlind();
      if (!res.ok) { toast(res.error, true); return; }
      afterAction(prev);
    };
  }

  function renderHand() {
    const state = Game.getState();
    const player = Game.currentPlayer();
    els.handCards.innerHTML = '';
    const order = WAGON_COLORS.concat([LOCOMOTIVE]);
    let any = false;
    order.forEach(color => {
      const count = player.hand[color] || 0;
      if (count === 0) return;
      any = true;
      const stack = document.createElement('div');
      stack.className = 'hand-card-stack';
      const swatch = document.createElement('div');
      swatch.className = 'hand-card-mini';
      swatch.style.background = COLOR_HEX[color];
      const label = document.createElement('div');
      label.className = 'hand-card-count';
      label.textContent = `${CARD_LABELS[color]} x${count}`;
      stack.appendChild(swatch);
      stack.appendChild(label);
      els.handCards.appendChild(stack);
    });
    if (!any) els.handCards.innerHTML = '<span class="hint">Aucune carte</span>';
  }

  function renderMyDestinations() {
    const player = Game.currentPlayer();
    els.myDestinations.innerHTML = '';
    if (player.destinations.length === 0) {
      els.myDestinations.innerHTML = '<span class="hint">Aucune destination</span>';
      return;
    }
    player.destinations.forEach(d => {
      const row = document.createElement('div');
      row.className = 'destination-card' + (d.isBase ? ' destination-base' : '');
      const cityA = Game.cityById(d.from).name;
      const cityB = Game.cityById(d.to).name;
      const tag = d.isBase ? '<span class="destination-base-tag">Base</span><br>' : '';
      row.innerHTML = `<span>${tag}${cityA} — ${cityB}</span><span class="destination-points">${d.points} pts</span>`;
      els.myDestinations.appendChild(row);
    });
  }

  function renderPlayersInfo() {
    const state = Game.getState();
    els.playersInfo.innerHTML = '';
    state.players.forEach((p, idx) => {
      const row = document.createElement('div');
      const isCurrent = idx === state.currentPlayerIndex;
      row.className = 'player-row' + (isCurrent ? ' current' : '');
      if (isCurrent) {
        row.style.borderLeft = `3px solid ${PLAYER_HEX[p.color]}`;
        row.style.background = hexToRgba(PLAYER_HEX[p.color], 0.1);
      }
      row.innerHTML = `
        <span class="name"><span class="dot" style="width:10px;height:10px;border-radius:50%;display:inline-block;background:${PLAYER_HEX[p.color]}"></span>${p.name}${isCurrent ? ' (en cours)' : ''}</span>
        <span>${p.score} pts · ${p.trainsLeft} wagons · ${p.destinations.length} destinations · ${p.stations} gare(s)</span>
      `;
      els.playersInfo.appendChild(row);
    });
  }

  function renderTurnPanel() {
    const state = Game.getState();
    const player = Game.currentPlayer();
    els.turnIndicator.innerHTML = `<span class="dot" style="width:10px;height:10px;border-radius:50%;display:inline-block;background:${PLAYER_HEX[player.color]};margin-right:8px"></span>Tour de ${player.name}`;
    let hint = '';
    if (state.finalRound.active) hint = 'Dernier tour de la partie ! ';
    if (state.turn && state.turn.type === 'draw') {
      if (state.turn.drawsLeft === 2) {
        hint += 'Piochez 2 cartes : une locomotive visible compte double et termine le tirage.';
      } else {
        hint += 'Piochez une 2e carte (visible ou pioche) — la locomotive visible n\'est plus disponible.';
      }
    } else {
      hint += 'Choisissez une action : piocher des cartes wagon, revendiquer une route, ou piocher des destinations.';
    }
    els.turnHint.textContent = hint;
    els.btnActionDestinations.disabled = !!state.turn;
    els.btnActionStation.disabled = !!state.turn || player.stations <= 0;
    els.btnActionStation.textContent = player.stations > 0
      ? `Construire une gare (${player.stations} restante(s))`
      : 'Plus de gare disponible';
  }

  function onActionDestinations() {
    const prev = Game.getState().currentPlayerIndex;
    const res = Game.actionDrawDestinations();
    if (!res.ok) { toast(res.error, true); return; }
    openDestinationsModal(res.drawn);
  }

  function onActionStation() {
    openStationModal();
  }

  // ---------- Board rendering ----------

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function renderBoard(container) {
    const target = container || els.boardWrap;
    const state = Game.getState();
    target.innerHTML = '';
    const svg = svgEl('svg', { viewBox: '0 0 930 700', xmlns: SVG_NS });

    ROUTES.forEach(baseRoute => {
      const route = Game.getRoute(baseRoute.id);
      const a = Game.cityById(route.from);
      const b = Game.cityById(route.to);
      const claimed = route.claimedBy != null;
      const claimHex = claimed ? PLAYER_HEX[state.players[route.claimedBy].color] : COLOR_HEX[route.color];

      const hit = svgEl('path', {
        d: `M${a.x},${a.y} L${b.x},${b.y}`,
        stroke: 'transparent',
        'stroke-width': 18,
        fill: 'none',
        'data-route-id': route.id,
      });
      hit.style.cursor = claimed ? 'default' : 'pointer';

      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const segLen = dist / route.length;

      if (claimed) {
        const halo = svgEl('path', {
          d: `M${a.x},${a.y} L${b.x},${b.y}`,
          stroke: claimHex,
          'stroke-width': 19,
          'stroke-linecap': 'round',
          class: 'route-halo',
        });
        svg.appendChild(halo);
      }

      const line = svgEl('path', {
        d: `M${a.x},${a.y} L${b.x},${b.y}`,
        stroke: claimHex,
        'stroke-width': claimed ? 12 : 9,
        'stroke-dasharray': claimed
          ? `${segLen * 0.92} ${segLen * 0.08}`
          : `${segLen * 0.78} ${segLen * 0.22}`,
        class: 'route-path' + (claimed ? ' claimed' : ''),
      });
      if (route.color === 'white' && !claimed) line.setAttribute('stroke', '#e6e6e6');

      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;

      if (claimed) {
        const ownerMarker = svgEl('circle', {
          cx: mx, cy: my, r: 9,
          fill: claimHex,
          class: 'route-owner-marker',
        });
        svg.appendChild(ownerMarker);
      }

      const badge = svgEl('text', { x: mx, y: my - 14, class: 'route-badge', 'text-anchor': 'middle' });
      let badgeText = String(route.length);
      if (route.tunnel) badgeText += ' \u{1F573}';
      if (route.ferry) badgeText += ' ⚓';
      badge.textContent = badgeText;

      const canClaim = state.phase === 'playing' && !state.turn && !claimed;
      if (canClaim) {
        hit.onclick = () => openPaymentModal(route.id);
      } else if (!claimed) {
        hit.style.cursor = 'not-allowed';
      }

      svg.appendChild(line);
      svg.appendChild(hit);
      svg.appendChild(badge);
    });

    CITIES.forEach(city => {
      const dot = svgEl('circle', { cx: city.x, cy: city.y, r: 7, class: 'city-dot' });
      const pos = city.labelPos || 'right';
      const labelAttrs = { class: 'city-label' };
      if (city.labelDx != null) {
        labelAttrs.x = city.x + city.labelDx;
        labelAttrs.y = city.y + city.labelDy;
        labelAttrs['text-anchor'] = city.labelAnchor || 'start';
      } else if (pos === 'left') {
        labelAttrs.x = city.x - 12;
        labelAttrs.y = city.y - 10;
        labelAttrs['text-anchor'] = 'end';
      } else if (pos === 'below') {
        labelAttrs.x = city.x;
        labelAttrs.y = city.y + 24;
        labelAttrs['text-anchor'] = 'middle';
      } else if (pos === 'above') {
        labelAttrs.x = city.x;
        labelAttrs.y = city.y - 14;
        labelAttrs['text-anchor'] = 'middle';
      } else {
        labelAttrs.x = city.x + 10;
        labelAttrs.y = city.y - 10;
      }
      labelAttrs['pointer-events'] = 'none';
      const label = svgEl('text', labelAttrs);
      label.textContent = city.name;
      svg.appendChild(dot);
      svg.appendChild(label);

      const stationOwners = state.players
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p.placedStations.includes(city.id));
      stationOwners.forEach(({ p }, i) => {
        const marker = svgEl('rect', {
          x: city.x - 13 + i * 11,
          y: city.y + 9,
          width: 9,
          height: 9,
          rx: 2,
          fill: PLAYER_HEX[p.color],
          class: 'city-station',
        });
        svg.appendChild(marker);
      });
    });

    target.appendChild(svg);
  }

  // ---------- Payment modal ----------

  let paymentState = null;

  function openPaymentModal(routeId) {
    dismissToast();
    const route = Game.getRoute(routeId);
    const player = Game.currentPlayer();
    const availableColors = route.color === 'gray'
      ? WAGON_COLORS.filter(c => (player.hand[c] || 0) > 0)
      : [route.color];

    paymentState = {
      routeId,
      colorToUse: availableColors[0] || null,
      locoCount: route.ferry ? route.ferry : 0,
    };
    renderPaymentModal();
    els.modalPayment.classList.remove('hidden');
  }

  function renderPaymentModal() {
    const route = Game.getRoute(paymentState.routeId);
    const player = Game.currentPlayer();
    const cityA = Game.cityById(route.from).name;
    const cityB = Game.cityById(route.to).name;

    els.paymentTitle.textContent = `Revendiquer : ${cityA} — ${cityB}`;

    const availableColors = route.color === 'gray'
      ? WAGON_COLORS.filter(c => (player.hand[c] || 0) > 0)
      : [route.color];

    const colorCount = route.length - paymentState.locoCount;
    const check = Game.validatePayment(route, paymentState.colorToUse, paymentState.locoCount, player.hand);

    let html = `<div class="route-summary">
      Longueur : <strong>${route.length}</strong> ·
      Couleur : <strong>${CARD_LABELS[route.color]}</strong>
      ${route.tunnel ? ' · <strong>Tunnel</strong>' : ''}
      ${route.ferry ? ` · <strong>Ferry</strong> (min ${route.ferry} locomotive(s))` : ''}
    </div>`;

    html += '<div class="payment-option"><span>Couleur utilisée</span>';
    if (availableColors.length > 0 && colorCount > 0) {
      html += `<select id="pay-color-select">${availableColors.map(c =>
        `<option value="${c}" ${c === paymentState.colorToUse ? 'selected' : ''}>${CARD_LABELS[c]} (${player.hand[c] || 0} en main)</option>`
      ).join('')}</select>`;
    } else {
      html += '<span class="hint">—</span>';
    }
    html += '</div>';

    html += `<div class="payment-option"><span>Locomotives utilisées (${player.hand[LOCOMOTIVE] || 0} en main)</span>
      <div class="stepper">
        <button id="pay-loco-minus">−</button>
        <span id="pay-loco-value">${paymentState.locoCount}</span>
        <button id="pay-loco-plus">+</button>
      </div>
    </div>`;

    html += `<div class="payment-option"><span>Cartes couleur nécessaires</span><strong>${Math.max(colorCount, 0)}</strong></div>`;

    if (!check.ok) {
      html += `<p class="hint" style="color:var(--danger)">${check.error}</p>`;
    }

    els.paymentBody.innerHTML = html;
    els.btnPaymentConfirm.disabled = !check.ok;

    const colorSelect = q('pay-color-select');
    if (colorSelect) {
      colorSelect.onchange = () => {
        paymentState.colorToUse = colorSelect.value;
        renderPaymentModal();
      };
    }
    q('pay-loco-minus').onclick = () => {
      paymentState.locoCount = Math.max(0, paymentState.locoCount - 1);
      renderPaymentModal();
    };
    q('pay-loco-plus').onclick = () => {
      paymentState.locoCount = Math.min(route.length, paymentState.locoCount + 1);
      renderPaymentModal();
    };
  }

  function closePaymentModal() {
    els.modalPayment.classList.add('hidden');
    paymentState = null;
  }

  function onPaymentConfirm() {
    if (!paymentState) return;
    const route = Game.getRoute(paymentState.routeId);
    const colorCount = route.length - paymentState.locoCount;
    const colorToUse = colorCount > 0 ? paymentState.colorToUse : null;
    const prev = Game.getState().currentPlayerIndex;
    const res = Game.claimRoute(paymentState.routeId, colorToUse, paymentState.locoCount);
    if (!res.ok) { toast(res.error, true); return; }
    closePaymentModal();
    if (res.tunnel) {
      openTunnelModal();
    } else {
      afterAction(prev);
    }
  }

  // ---------- Tunnel modal ----------

  let tunnelExtraLoco = 0;

  function openTunnelModal() {
    const state = Game.getState();
    const turn = state.turn;
    if (turn.extraNeeded === 0) {
      const prev = state.currentPlayerIndex;
      const res = Game.resolveTunnelPay(0, 0);
      if (!res.ok) toast(res.error, true);
      afterAction(prev);
      return;
    }
    dismissToast();
    tunnelExtraLoco = 0;
    renderTunnelModal();
    els.modalTunnel.classList.remove('hidden');
  }

  function renderTunnelModal() {
    const state = Game.getState();
    const turn = state.turn;
    const player = Game.currentPlayer();
    const revealedHtml = turn.revealed.map(c =>
      `<span class="hand-card-mini" style="display:inline-block;width:28px;height:40px;background:${COLOR_HEX[c]};margin-right:4px;border-radius:4px;border:1px solid rgba(0,0,0,0.4)"></span>`
    ).join('');

    const colorLabel = turn.colorToUse ? CARD_LABELS[turn.colorToUse] : 'Locomotive';
    const maxExtraLoco = turn.colorToUse ? Math.min(turn.extraNeeded, player.hand[LOCOMOTIVE] || 0) : turn.extraNeeded;
    const extraColor = turn.extraNeeded - tunnelExtraLoco;
    const colorAvail = turn.colorToUse ? (player.hand[turn.colorToUse] || 0) : 0;
    const valid = turn.colorToUse
      ? extraColor <= colorAvail && tunnelExtraLoco <= (player.hand[LOCOMOTIVE] || 0)
      : tunnelExtraLoco === turn.extraNeeded && tunnelExtraLoco <= (player.hand[LOCOMOTIVE] || 0);

    let html = `<p>Cartes retournées : ${revealedHtml}</p>
      <p>Vous devez payer <strong>${turn.extraNeeded}</strong> carte(s) supplémentaire(s) de type <strong>${colorLabel}</strong> (ou locomotive).</p>`;

    if (turn.colorToUse) {
      html += `<div class="payment-option"><span>Locomotives supplémentaires</span>
        <div class="stepper">
          <button id="tunnel-loco-minus">−</button>
          <span>${tunnelExtraLoco}</span>
          <button id="tunnel-loco-plus">+</button>
        </div>
      </div>
      <div class="payment-option"><span>${CARD_LABELS[turn.colorToUse]} supplémentaires</span><strong>${extraColor}</strong> (${colorAvail} en main)</div>`;
    } else {
      html += `<p class="hint">${tunnelExtraLoco} / ${turn.extraNeeded} locomotives disponibles : ${player.hand[LOCOMOTIVE] || 0}</p>`;
    }

    if (!valid) html += `<p class="hint" style="color:var(--danger)">Cartes insuffisantes pour payer le supplément.</p>`;

    els.tunnelBody.innerHTML = html;
    els.btnTunnelPay.disabled = !valid;

    const minus = q('tunnel-loco-minus');
    const plus = q('tunnel-loco-plus');
    if (minus) minus.onclick = () => { tunnelExtraLoco = Math.max(0, tunnelExtraLoco - 1); renderTunnelModal(); };
    if (plus) plus.onclick = () => { tunnelExtraLoco = Math.min(maxExtraLoco, tunnelExtraLoco + 1); renderTunnelModal(); };
  }

  function onTunnelPay() {
    const state = Game.getState();
    const turn = state.turn;
    const extraColor = turn.extraNeeded - tunnelExtraLoco;
    const prev = state.currentPlayerIndex;
    const res = Game.resolveTunnelPay(extraColor, tunnelExtraLoco);
    if (!res.ok) { toast(res.error, true); return; }
    els.modalTunnel.classList.add('hidden');
    afterAction(prev);
  }

  function onTunnelRenounce() {
    const prev = Game.getState().currentPlayerIndex;
    const res = Game.resolveTunnelRenounce();
    els.modalTunnel.classList.add('hidden');
    if (!res.ok) { toast(res.error, true); return; }
    toast('Vous renoncez à cette route pour ce tour.');
    afterAction(prev);
  }

  // ---------- Destinations draw modal ----------

  function openDestinationsModal(drawn) {
    dismissToast();
    els.destinationsDrawList.innerHTML = '';
    drawn.forEach(d => els.destinationsDrawList.appendChild(destinationChoiceRow(d)));
    els.modalDestinations.classList.remove('hidden');
  }

  function onConfirmDrawnDestinations() {
    const checked = Array.from(els.destinationsDrawList.querySelectorAll('input:checked')).map(i => i.value);
    const prev = Game.getState().currentPlayerIndex;
    const res = Game.confirmDrawnDestinations(checked);
    if (!res.ok) { toast(res.error, true); return; }
    els.modalDestinations.classList.add('hidden');
    afterAction(prev);
  }

  function onCancelDrawnDestinations() {
    const res = Game.cancelDrawnDestinations();
    els.modalDestinations.classList.add('hidden');
    if (!res.ok) { toast(res.error, true); return; }
    renderAll();
  }

  // ---------- Station modal (action C) ----------

  let stationState = null;

  function eligibleStationCities(player) {
    return CITIES.filter(c => !player.placedStations.includes(c.id));
  }

  function openStationModal() {
    dismissToast();
    const player = Game.currentPlayer();
    const cities = eligibleStationCities(player);
    if (cities.length === 0) { toast('Vous avez déjà une gare dans toutes les villes.', true); return; }
    const availableColors = WAGON_COLORS.filter(c => (player.hand[c] || 0) > 0);
    stationState = {
      cityId: cities[0].id,
      colorToUse: availableColors[0] || null,
      locoCount: 0,
    };
    renderStationModal();
    els.modalStation.classList.remove('hidden');
  }

  function renderStationModal() {
    const player = Game.currentPlayer();
    const cost = Game.stationCost(player);
    const cities = eligibleStationCities(player);
    const availableColors = WAGON_COLORS.filter(c => (player.hand[c] || 0) > 0);
    const colorCount = cost - stationState.locoCount;
    const check = Game.validateStationPayment(stationState.colorToUse, stationState.locoCount, player.hand, cost);

    let html = `<div class="route-summary">
      Coût de cette gare (n° ${cost}) : <strong>${cost}</strong> carte(s) d'une seule couleur
      (locomotives substituables) · Il vous reste <strong>${player.stations}</strong> gare(s).
    </div>`;

    html += `<div class="payment-option"><span>Ville</span>
      <select id="station-city-select">${cities.map(c =>
        `<option value="${c.id}" ${c.id === stationState.cityId ? 'selected' : ''}>${c.name}</option>`
      ).join('')}</select>
    </div>`;

    html += '<div class="payment-option"><span>Couleur utilisée</span>';
    if (availableColors.length > 0 && colorCount > 0) {
      html += `<select id="station-color-select">${availableColors.map(c =>
        `<option value="${c}" ${c === stationState.colorToUse ? 'selected' : ''}>${CARD_LABELS[c]} (${player.hand[c] || 0} en main)</option>`
      ).join('')}</select>`;
    } else {
      html += '<span class="hint">—</span>';
    }
    html += '</div>';

    html += `<div class="payment-option"><span>Locomotives utilisées (${player.hand[LOCOMOTIVE] || 0} en main)</span>
      <div class="stepper">
        <button id="station-loco-minus">−</button>
        <span id="station-loco-value">${stationState.locoCount}</span>
        <button id="station-loco-plus">+</button>
      </div>
    </div>`;

    html += `<div class="payment-option"><span>Cartes couleur nécessaires</span><strong>${Math.max(colorCount, 0)}</strong></div>`;

    if (!check.ok) {
      html += `<p class="hint" style="color:var(--danger)">${check.error}</p>`;
    }

    els.stationBody.innerHTML = html;
    els.btnStationConfirm.disabled = !check.ok;

    q('station-city-select').onchange = (e) => {
      stationState.cityId = e.target.value;
      renderStationModal();
    };
    const colorSelect = q('station-color-select');
    if (colorSelect) {
      colorSelect.onchange = () => {
        stationState.colorToUse = colorSelect.value;
        renderStationModal();
      };
    }
    q('station-loco-minus').onclick = () => {
      stationState.locoCount = Math.max(0, stationState.locoCount - 1);
      renderStationModal();
    };
    q('station-loco-plus').onclick = () => {
      stationState.locoCount = Math.min(cost, stationState.locoCount + 1);
      renderStationModal();
    };
  }

  function closeStationModal() {
    els.modalStation.classList.add('hidden');
    stationState = null;
  }

  function onStationConfirm() {
    if (!stationState) return;
    const player = Game.currentPlayer();
    const cost = Game.stationCost(player);
    const colorCount = cost - stationState.locoCount;
    const colorToUse = colorCount > 0 ? stationState.colorToUse : null;
    const prev = Game.getState().currentPlayerIndex;
    const res = Game.buildStation(stationState.cityId, colorToUse, stationState.locoCount);
    if (!res.ok) { toast(res.error, true); return; }
    closeStationModal();
    afterAction(prev);
  }

  // ---------- End screen ----------

  function showEndScreen() {
    showScreen('screenEnd');
    const state = Game.getState();
    const winnerScore = Math.max(...state.players.map(p => p.score));
    const contenders = state.players.filter(p => p.score === winnerScore);
    let winner = contenders[0];
    if (contenders.length > 1) {
      winner = contenders.reduce((best, p) =>
        p.completedDestinations.length > best.completedDestinations.length ? p : best
      );
    }

    els.endResults.innerHTML = '';
    state.players.forEach((p, idx) => {
      const r = state.finalResults[idx];
      const block = document.createElement('div');
      block.className = 'end-player-block';
      const isWinner = p === winner;
      let html = `<h4><span>${p.name}${isWinner ? ' 🏆' : ''}</span><span>${p.score} pts</span></h4>`;
      html += `<div class="end-line"><span>Points de routes</span><span>${r.baseScore}</span></div>`;
      p.completedDestinations.forEach(d => {
        html += `<div class="end-line"><span>✔ ${Game.cityById(d.from).name} — ${Game.cityById(d.to).name}</span><span>+${d.points}</span></div>`;
      });
      p.failedDestinations.forEach(d => {
        html += `<div class="end-line"><span>✘ ${Game.cityById(d.from).name} — ${Game.cityById(d.to).name}</span><span>−${d.points}</span></div>`;
      });
      if (r.bonus > 0) {
        html += `<div class="end-line"><span>Route continue la plus longue (${r.longest})</span><span>+${r.bonus}</span></div>`;
      }
      html += `<div class="end-line total"><span>Total</span><span>${p.score}</span></div>`;
      block.innerHTML = html;
      els.endResults.appendChild(block);
    });
  }

  function onNewGame() {
    showScreen('screenStart');
  }

  function bindEvents() {
    els.btnStart.onclick = onStart;
    els.btnReveal.onclick = onReveal;
    els.btnConfirmSetupDestinations.onclick = onConfirmSetupDestinations;
    els.btnActionDestinations.onclick = onActionDestinations;
    els.btnActionStation.onclick = onActionStation;
    els.btnStationConfirm.onclick = onStationConfirm;
    els.btnStationCancel.onclick = closeStationModal;
    els.btnStationClose.onclick = closeStationModal;
    els.btnPaymentCancel.onclick = closePaymentModal;
    els.btnPaymentClose.onclick = closePaymentModal;
    els.btnPaymentConfirm.onclick = onPaymentConfirm;
    els.btnTunnelPay.onclick = onTunnelPay;
    els.btnTunnelRenounce.onclick = onTunnelRenounce;
    els.btnTunnelClose.onclick = onTunnelRenounce;
    els.btnDestinationsConfirm.onclick = onConfirmDrawnDestinations;
    els.btnDestinationsCancel.onclick = onCancelDrawnDestinations;
    els.btnDestinationsClose.onclick = onCancelDrawnDestinations;
    els.btnNewGame.onclick = onNewGame;
  }

  function init() {
    cacheEls();
    bindEvents();
    showScreen('screenStart');
  }

  return { init };
})();
