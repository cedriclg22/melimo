/* Melimo — logique partagée (stockage local, générateur de mots fléchés, banques de distracteurs) */

const STORAGE_PREFIX = 'melimo_board_';

const Store = {
  save(id, data) {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data));
  },
  load(id) {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  },
  newId() {
    return Math.random().toString(36).slice(2, 8);
  }
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Générateur de grille de mots fléchés ----------
   Place les mots (avec définitions) sur une grille en cherchant
   des intersections de lettres, comme un mots-croisés simplifié. */
function generateCrossword(words) {
  // words: [{word, clue, key}]
  const entries = words
    .map(w => ({ ...w, word: w.word.toUpperCase().replace(/[^A-ZÀ-Ÿ]/g, '') }))
    .filter(w => w.word.length > 1);
  if (!entries.length) return { grid: [], placed: [], size: 0 };

  entries.sort((a, b) => b.word.length - a.word.length);

  const SIZE = 18;
  const OFFSET = Math.floor(SIZE / 2);
  const grid = {}; // "x,y" -> letter
  const placed = [];

  function canPlace(word, x, y, dir) {
    const dx = dir === 'H' ? 1 : 0;
    const dy = dir === 'V' ? 1 : 0;
    let intersects = false;
    for (let i = 0; i < word.length; i++) {
      const cx = x + dx * i, cy = y + dy * i;
      const key = `${cx},${cy}`;
      if (grid[key]) {
        if (grid[key] !== word[i]) return false;
        intersects = true;
      }
      // block adjacent-word collisions (basic check on perpendicular neighbors when not intersecting)
      if (!grid[key]) {
        const nb1 = `${cx + dy},${cy + dx}`;
        const nb2 = `${cx - dy},${cy - dx}`;
        if (grid[nb1] || grid[nb2]) return false;
      }
    }
    return { intersects };
  }

  // place first word in the middle, horizontal
  const first = entries[0];
  const startX = -Math.floor(first.word.length / 2);
  const startY = 0;
  for (let i = 0; i < first.word.length; i++) grid[`${startX + i},${startY}`] = first.word[i];
  placed.push({ ...first, x: startX, y: startY, dir: 'H' });

  for (let idx = 1; idx < entries.length; idx++) {
    const entry = entries[idx];
    let bestSpot = null;
    for (const p of placed) {
      for (let i = 0; i < entry.word.length; i++) {
        for (let j = 0; j < p.word.length; j++) {
          if (entry.word[i] !== p.word[j]) continue;
          // try placing entry perpendicular to p, crossing at this letter
          const dir = p.dir === 'H' ? 'V' : 'H';
          const cx = dir === 'V' ? p.x + j : p.x - i;
          const cy = dir === 'V' ? p.y - i : p.y + j;
          const res = canPlace(entry.word, cx, cy, dir);
          if (res) { bestSpot = { x: cx, y: cy, dir }; break; }
        }
        if (bestSpot) break;
      }
      if (bestSpot) break;
    }
    if (!bestSpot) {
      // fallback: place below everything, horizontal, own row (no intersection)
      const maxY = Math.max(...placed.map(p => p.y + (p.dir === 'V' ? p.word.length : 1))) + 1;
      bestSpot = { x: startX, y: maxY, dir: 'H' };
    }
    const dx = bestSpot.dir === 'H' ? 1 : 0;
    const dy = bestSpot.dir === 'V' ? 1 : 0;
    for (let i = 0; i < entry.word.length; i++) {
      grid[`${bestSpot.x + dx * i},${bestSpot.y + dy * i}`] = entry.word[i];
    }
    placed.push({ ...entry, x: bestSpot.x, y: bestSpot.y, dir: bestSpot.dir });
  }

  // normalize coordinates to positive grid
  const xs = [], ys = [];
  placed.forEach(p => {
    const len = p.word.length;
    const dx = p.dir === 'H' ? len - 1 : 0;
    const dy = p.dir === 'V' ? len - 1 : 0;
    xs.push(p.x, p.x + dx);
    ys.push(p.y, p.y + dy);
  });
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...xs), maxY = Math.max(...ys);
  const width = maxX - minX + 1, height = maxY - minY + 1;

  const normalized = placed.map(p => ({ ...p, x: p.x - minX, y: p.y - minY }));
  return { width, height, placed: normalized };
}

/* ---------- Banques de distracteurs pour les choix à gros boutons ---------- */
const DISTRACTOR_POOL = [
  'Un vélo', 'Un chapeau', 'Un ballon', 'Une glace', 'Un cerf-volant',
  'Un panier', 'Un parasol', 'Une valise', 'Un chien', 'Un bateau',
  'Une trottinette', 'Un cahier', 'Un appareil photo', 'Un ours en peluche',
  'Un coquillage', 'Un seau', 'Une pelle', 'Un livre', 'Une guitare', 'Un cerf'
];

function buildChoices(correct, count = 6) {
  const pool = DISTRACTOR_POOL.filter(w => w.toLowerCase() !== correct.toLowerCase());
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count - 1);
  const all = [...shuffled, correct].sort(() => Math.random() - 0.5);
  return all;
}

const EMOJI_LIBRARY = [
  '⛵','🍞','🐝','🎩','🍇','🌊','🚗','🐍','🦁','🌙','🔔','🎈','🐟','🌹','🍎',
  '🐱','🐶','🏠','⭐','🔥','💧','🍀','🎵','🧦','🦶','🐄','🐐','🌳','☀️','❄️',
  '🍷','🧊','🥁','🎯','🐢','🦋','🍯','🧀','🪁','🕰️','🚪','🔑','📚','✏️','🎨'
];
