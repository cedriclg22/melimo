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

/* ---------- Mise en page "mots fléchés" (définition + flèche dans la grille) ----------
   Place la définition de chaque mot dans la case juste avant sa première lettre,
   avec une flèche indiquant la direction — comme sur une vraie grille de mots fléchés.
   Si la case est déjà prise (rare, grille dense), le mot bascule dans `overflowClues`. */
function layoutFlechees(cw) {
  const letterCells = {};
  cw.placed.forEach(p => {
    const dx = p.dir === 'H' ? 1 : 0, dy = p.dir === 'V' ? 1 : 0;
    for (let i = 0; i < p.word.length; i++) {
      const key = `${p.x + dx * i},${p.y + dy * i}`;
      letterCells[key] = letterCells[key] || { letter: p.word[i], key: false };
      if (p.key) letterCells[key].key = true;
    }
  });

  const clueCells = {};
  const overflowClues = [];
  cw.placed.forEach(p => {
    const isH = p.dir === 'H';
    const cx = isH ? p.x - 1 : p.x;
    const cy = isH ? p.y : p.y - 1;
    const key = `${cx},${cy}`;
    if (letterCells[key] || clueCells[key]) {
      overflowClues.push(p);
      return;
    }
    clueCells[key] = { text: p.clue, arrow: isH ? '→' : '↓', key: !!p.key };
  });

  const xs = [], ys = [];
  Object.keys(letterCells).forEach(k => { const [x, y] = k.split(',').map(Number); xs.push(x); ys.push(y); });
  Object.keys(clueCells).forEach(k => { const [x, y] = k.split(',').map(Number); xs.push(x); ys.push(y); });
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...xs), maxY = Math.max(...ys);

  function shift(map) {
    const out = {};
    Object.entries(map).forEach(([k, v]) => {
      const [x, y] = k.split(',').map(Number);
      out[`${x - minX},${y - minY}`] = v;
    });
    return out;
  }

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    letterCells: shift(letterCells),
    clueCells: shift(clueCells),
    overflowClues
  };
}

/* ---------- Chargement d'un tableau (partagé entre view.html et poster.html) ---------- */
function svgPlaceholder(bg, emoji) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><text x="50%" y="50%" font-size="110" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`
  );
}

function buildDemoBoard() {
  const words = [
    { word: 'PLAGE', clue: 'On y fait des châteaux de sable', key: true },
    { word: 'FAMILLE', clue: "Ceux qu'on aime", key: false },
    { word: 'ETE', clue: 'Saison des vacances', key: false },
    { word: 'FORET', clue: "Pleine d'arbres", key: false }
  ];
  return {
    photos: [
      svgPlaceholder('#f1ddd0', '⚽'),
      svgPlaceholder('#cfe8f0', '🏖️'),
      svgPlaceholder('#f0d9e4', '👨‍👩‍👧‍👦'),
      svgPlaceholder('#dcead0', '🌳'),
      svgPlaceholder('#f6e2b8', '🐚')
    ],
    hiddenObject: 'Un baby-foot',
    words,
    crossword: generateCrossword(words),
    rebusEmojis: ['⛵', '🍞'],
    rebusAnswer: 'Bateau',
    diffPhoto: svgPlaceholder('#dcead0', '🌳'),
    diffPoint: { x: 62, y: 38 },
    coverPhoto: svgPlaceholder('#f6e2b8', '🎬'),
    video: null,
    colorPrimary: '#d9527a',
    colorSecondary: '#fbead9',
    finalWord: 'Vacances'
  };
}

function loadBoard() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo')) return buildDemoBoard();
  const id = params.get('id');
  if (id) return Store.load(id);
  return null;
}

function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (percent / 100) * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + (percent / 100) * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + (percent / 100) * 255)));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function applyBoardColors(board) {
  document.documentElement.style.setProperty('--primary', board.colorPrimary || '#d9527a');
  document.documentElement.style.setProperty('--secondary', board.colorSecondary || '#fbead9');
  document.documentElement.style.setProperty('--primary-dark', shade(board.colorPrimary || '#d9527a', -18));
}

/* ---------- Rendu de l'affiche (partagé entre poster.html et l'aperçu en direct de create.html) ---------- */
function posterMosaicHTML(board) {
  const photos = (board.photos && board.photos.length ? board.photos : new Array(6).fill(null)).slice(0, 6);
  const spans = ['span-1', 'span-2', 'span-1', 'span-2', 'span-1', 'span-1'];
  return photos.map((src, i) =>
    src ? `<img class="${spans[i] || ''}" src="${src}">` : `<div class="ph ${spans[i] || ''}">📷</div>`
  ).join('');
}

function posterFlecheesHTML(board) {
  const cw = board.crossword;
  if (!cw || !cw.placed || !cw.placed.length) {
    return '<p class="phint">Ajoute au moins 2 mots avec leur définition, puis génère la grille pour la voir ici.</p>';
  }
  const layout = layoutFlechees(cw);
  let html = `<div class="flech-grid-wrap"><div class="flech-grid" style="grid-template-columns:repeat(${layout.width},var(--fcell)); grid-template-rows:repeat(${layout.height},var(--fcell));">`;
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const key = `${x},${y}`;
      const letter = layout.letterCells[key];
      const clue = layout.clueCells[key];
      if (clue) {
        html += `<div class="fcell fclue">${clue.text}<span class="farrow">${clue.arrow}</span></div>`;
      } else if (letter) {
        html += `<div class="fcell fletter${letter.key ? ' fkey' : ''}"></div>`;
      } else {
        html += `<div class="fcell fblock"></div>`;
      }
    }
  }
  html += `</div></div>`;
  if (layout.overflowClues.length) {
    html += `<ul class="clue-list" style="margin-top:10px;">` +
      layout.overflowClues.map(p => `<li><b>${p.dir === 'H' ? '→' : '↓'}</b> ${p.clue}</li>`).join('') +
      `</ul>`;
  }
  return html;
}

function posterRebusHTML(board) {
  return (board.rebusEmojis || []).map(e => `<span>${e}</span>`).join('');
}

function posterDiffHTML(board) {
  const src = board.diffPhoto || '';
  const frame = `<div class="diff-frame-print">${src ? `<img src="${src}">` : '<div class="ph">📷</div>'}<div class="grid-lines"></div></div>`;
  return frame + frame;
}

function renderPosterInto(container, board, opts = {}) {
  const qrTarget = opts.qrTarget;
  const qrHTML = qrTarget
    ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&color=b83d63&data=${encodeURIComponent(qrTarget)}" alt="QR code vers le tableau interactif" width="140" height="140"><p>Découvre ta<br>vidéo cachée</p>`
    : `<div class="qr-fake">QR</div><p>Généré à la publication</p>`;

  container.innerHTML = `
    <div class="print-poster">
      <div class="mosaic">${posterMosaicHTML(board)}</div>

      <div class="plabel"><div class="pnum">1</div><div class="ptext">Objet caché :<span class="pline"></span></div></div>
      <p class="phint">Retrouve l'objet caché parmi les photos ci-dessus, et écris sa réponse.</p>

      <div class="deco-arrow a1">↷</div>

      <div class="plabel"><div class="pnum">2</div><div class="ptext">Mot trouvé :<span class="pline"></span></div></div>
      ${posterFlecheesHTML(board)}

      <div class="rebus-print-row">
        <div class="rebus-box2">${posterRebusHTML(board)}</div>
        <div class="deco-arrow a2">↶</div>
        <div class="plabel" style="flex:1;"><div class="pnum">3</div><div class="ptext">Mot trouvé :<span class="pline"></span></div></div>
      </div>

      <div class="plabel"><div class="pnum">4</div><div class="ptext">Case différente :<span class="pline"></span></div></div>
      <p class="phint">Observe les deux photos : une case est différente. Entoure-la.</p>
      <div class="diff-pair">${posterDiffHTML(board)}</div>

      <div class="final-row">
        <div>
          <div class="plabel"><div class="pnum">✓</div><div class="ptext">Mot final :<span class="pline"></span></div></div>
          <p class="phint">Assemble les indices trouvés ci-dessus${qrTarget ? ', puis scanne le code pour vérifier ta réponse.' : '.'}</p>
        </div>
        <div class="qr-block">${qrHTML}</div>
      </div>
    </div>
  `;
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
