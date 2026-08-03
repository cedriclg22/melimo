/* Melimo — affiche imprimable (PDF via impression navigateur), style pêle-mêle façon maquette papier */

const board = loadBoard();
const root = document.getElementById('content');

if (!board) {
  root.innerHTML = `<div class="empty-state">
    <h2>Tableau introuvable</h2>
    <p>Le lien est peut-être incomplet. <a href="index.html">Retour à l'accueil</a></p>
  </div>`;
} else {
  applyBoardColors(board);
  document.getElementById('backToViewBtn').href = 'view.html' + window.location.search;
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  render(board);
}

function render(board) {
  const qrTarget = new URL('view.html' + window.location.search, window.location.href).toString();
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&color=b83d63&data=${encodeURIComponent(qrTarget)}`;

  root.innerHTML = `
    <div class="print-poster">
      <div class="mosaic" id="mosaic"></div>

      <div class="plabel">
        <div class="pnum">1</div>
        <div class="ptext">Objet caché : <span class="pline"></span></div>
      </div>
      <p class="phint">Retrouve l'objet caché parmi les photos ci-dessus, et écris sa réponse.</p>

      <div class="deco-arrow a1">↷</div>

      <div class="plabel">
        <div class="pnum">2</div>
        <div class="ptext">Mot trouvé :<span class="pline"></span></div>
      </div>
      <div id="flechWrap"></div>

      <div class="rebus-print-row">
        <div class="rebus-box2" id="rebusBox2"></div>
        <div class="deco-arrow a2">↶</div>
        <div class="plabel" style="flex:1;">
          <div class="pnum">3</div>
          <div class="ptext">Mot trouvé :<span class="pline"></span></div>
        </div>
      </div>

      <div class="plabel">
        <div class="pnum">4</div>
        <div class="ptext">Case différente :<span class="pline"></span></div>
      </div>
      <p class="phint">Observe les deux photos : une case est différente. Entoure-la.</p>
      <div class="diff-pair" id="diffPair"></div>

      <div class="final-row">
        <div>
          <div class="plabel">
            <div class="pnum">✓</div>
            <div class="ptext">Mot final :<span class="pline"></span></div>
          </div>
          <p class="phint">Assemble les indices trouvés ci-dessus, puis scanne le code pour vérifier ta réponse.</p>
        </div>
        <div class="qr-block">
          <img src="${qrSrc}" alt="QR code vers le tableau interactif" width="140" height="140">
          <p>Découvre ta<br>vidéo cachée</p>
        </div>
      </div>
    </div>
  `;

  renderMosaic(board);
  renderFlechees(board);
  renderRebusBox(board);
  renderDiffPair(board);
}

function renderMosaic(board) {
  const el = document.getElementById('mosaic');
  const photos = (board.photos && board.photos.length ? board.photos : new Array(6).fill(null)).slice(0, 6);
  const spans = ['span-1', 'span-2', 'span-1', 'span-2', 'span-1', 'span-1'];
  el.innerHTML = photos.map((src, i) =>
    src ? `<img class="${spans[i] || ''}" src="${src}">` : `<div class="ph ${spans[i] || ''}">📷</div>`
  ).join('');
}

function renderFlechees(board) {
  const wrap = document.getElementById('flechWrap');
  const cw = board.crossword;
  if (!cw || !cw.placed || !cw.placed.length) {
    wrap.innerHTML = '<p class="phint">Pas de grille disponible.</p>';
    return;
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
  wrap.innerHTML = html;
}

function renderRebusBox(board) {
  document.getElementById('rebusBox2').innerHTML = (board.rebusEmojis || []).map(e => `<span>${e}</span>`).join('');
}

function renderDiffPair(board) {
  const el = document.getElementById('diffPair');
  const src = board.diffPhoto || '';
  el.innerHTML = `
    <div class="diff-frame-print">${src ? `<img src="${src}">` : '<div class="ph">📷</div>'}<div class="grid-lines"></div></div>
    <div class="diff-frame-print">${src ? `<img src="${src}">` : '<div class="ph">📷</div>'}<div class="grid-lines"></div></div>
  `;
}
