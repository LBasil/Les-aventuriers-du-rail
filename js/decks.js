const WAGON_COLORS = ['blue', 'red', 'green', 'yellow', 'violet', 'white', 'black', 'orange'];
const LOCOMOTIVE = 'locomotive';

const CARD_LABELS = {
  blue: 'Bleu', red: 'Rouge', green: 'Vert', yellow: 'Jaune',
  violet: 'Violet', white: 'Blanc', black: 'Noir', orange: 'Orange',
  locomotive: 'Locomotive', gray: 'Gris',
};

const POINTS_BY_LENGTH = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };

const LONGEST_ROUTE_BONUS = 10;

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildWagonDeck() {
  const deck = [];
  for (const color of WAGON_COLORS) {
    for (let i = 0; i < 14; i++) deck.push(color);
  }
  for (let i = 0; i < 14; i++) deck.push(LOCOMOTIVE);
  return shuffle(deck);
}

const DESTINATIONS = [
  { id: 'd1', from: 'paris', to: 'marseille', points: 14 },
  { id: 'd2', from: 'brest', to: 'nice', points: 20 },
  { id: 'd3', from: 'lille', to: 'toulouse', points: 16 },
  { id: 'd4', from: 'nantes', to: 'strasbourg', points: 16 },
  { id: 'd5', from: 'bordeaux', to: 'lyon', points: 12 },
  { id: 'd6', from: 'rennes', to: 'dijon', points: 12 },
  { id: 'd7', from: 'paris', to: 'bordeaux', points: 12 },
  { id: 'd8', from: 'strasbourg', to: 'toulouse', points: 20 },
  { id: 'd9', from: 'lille', to: 'marseille', points: 18 },
  { id: 'd10', from: 'rouen', to: 'toulouse', points: 15 },
  { id: 'd11', from: 'nice', to: 'bordeaux', points: 16 },
  { id: 'd12', from: 'nancy', to: 'bordeaux', points: 18 },
  { id: 'd13', from: 'clermont', to: 'strasbourg', points: 13 },
  { id: 'd14', from: 'grenoble', to: 'paris', points: 10 },
  { id: 'd15', from: 'toulouse', to: 'nantes', points: 10 },
  { id: 'd16', from: 'montpellier', to: 'paris', points: 18 },
  { id: 'd17', from: 'brest', to: 'paris', points: 9 },
  { id: 'd18', from: 'nice', to: 'strasbourg', points: 20 },

  // Destinations vers la Belgique et l'Allemagne.
  { id: 'd19', from: 'paris', to: 'bruxelles', points: 8 },
  { id: 'd20', from: 'bordeaux', to: 'bruxelles', points: 22 },
  { id: 'd21', from: 'marseille', to: 'francfort', points: 24 },
  { id: 'd22', from: 'toulouse', to: 'francfort', points: 26 },
  { id: 'd23', from: 'brest', to: 'francfort', points: 28 },
  { id: 'd24', from: 'nice', to: 'bruxelles', points: 24 },
];

function buildDestinationDeck() {
  return shuffle(DESTINATIONS);
}
