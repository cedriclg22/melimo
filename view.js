/* Melimo — logique du tableau interactif (côté destinataire) */

const board = loadBoard();
const root = document.getElementById('content');

if (!board) {
  root.innerHTML = `<div class="empty-state">
    <h2>Tableau introuvable</h2>
    <p>Le lien est peut-être incomplet. <a href="index.html">Retour à l'accueil</a></p>
  </div>`;
} else {
  applyBoardColors(board);
  render(board);
}

function render(board) {
  root.innerHTML = `
    <div class="poster-photos" id="photosGrid"></div>
    <p style="text-align:center;margin:-4px 0 10px;"><a class="btn ghost small" id="posterLink" href="#">🖨️ Voir l'affiche à imprimer</a></p>

    <div class="section-tag"><div class="num">1</div><div class="label">Objet caché : <span id="objAnswer" class="answer-fill"></span></div></div>
    <p class="hint">Retrouve l'objet caché parmi les photos ci-dessus.</p>
    <div class="choice-buttons" id="objChoices"></div>
    <div class="feedback" id="objFeedback"></div>

    <div class="section-tag"><div class="num">2</div><div class="label">Mots fléchés</div></div>
    <div id="crosswordWrap"></div>

    <div class="section-tag"><div class="num">3</div><div class="label">Rébus : <span id="rebusAnswerFill" class="answer-fill"></span></div></div>
    <div class="rebus-sequence" id="rebusDisplay"></div>
    <div class="choice-buttons" id="rebusChoices"></div>
    <div class="feedback" id="rebusFeedback"></div>

    <div class="section-tag"><div class="num">4</div><div class="label">Case différente</div></div>
    <p class="hint">Clique sur la case qui correspond à l'indice caché dans la photo (identique à droite et à gauche).</p>
    <div class="diff-game" id="diffGame"></div>
    <div class="feedback" id="diffFeedback"></div>

    <div class="section-tag"><div class="num">5</div><div class="label">Mot final</div></div>
    <p class="hint">Choisis le mot final parmi les propositions pour débloquer la vidéo surprise.</p>
    <div class="choice-buttons" id="finalChoices"></div>
    <div class="feedback" id="finalFeedback"></div>

    <div id="videoSection"></div>
  `;

  document.getElementById('posterLink').href = 'poster.html' + window.location.search;

  renderPhotos(board);
  renderObjectGuess(board);
  renderCrossword(board);
  renderRebus(board);
  renderDiffGame(board);
  renderFinal(board);
}

function renderPhotos(board) {
  const grid = document.getElementById('photosGrid');
  const photos = (board.photos && board.photos.length) ? board.photos : [null, null, null, null, null, null];
  grid.innerHTML = photos.map(src => src ? `<img src="${src}">` : `<div class="ph">📷</div>`).join('');
}

function renderObjectGuess(board) {
  const choices = buildChoices(board.hiddenObject || 'Un baby-foot');
  const wrap = document.getElementById('objChoices');
  wrap.innerHTML = choices.map(c => `<button type="button" data-val="${c}">${c}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const correct = btn.dataset.val.toLowerCase() === (board.hiddenObject || '').toLowerCase();
      wrap.querySelectorAll('button').forEach(b => b.disabled = true);
      btn.classList.add(correct ? 'correct' : 'wrong');
      const fb = document.getElementById('objFeedback');
      if (correct) {
        fb.textContent = 'Bravo, bien trouvé !';
        fb.className = 'feedback ok';
        document.getElementById('objAnswer').textContent = board.hiddenObject;
      } else {
        fb.textContent = 'Raté, essaie encore.';
        fb.className = 'feedback ko';
        setTimeout(() => wrap.querySelectorAll('button').forEach(b => { b.disabled = false; b.classList.remove('wrong'); }), 900);
      }
    });
  });
}

function renderCrossword(board) {
  const wrap = document.getElementById('crosswordWrap');
  const cw = board.crossword;
  if (!cw || !cw.placed || !cw.placed.length) {
    wrap.innerHTML = '<p class="hint">Pas de grille disponible.</p>';
    return;
  }
  const cellMap = {};
  const numbers = {};
  cw.placed.forEach((p, idx) => {
    const dx = p.dir === 'H' ? 1 : 0, dy = p.dir === 'V' ? 1 : 0;
    for (let i = 0; i < p.word.length; i++) {
      const key = `${p.x + dx * i},${p.y + dy * i}`;
      cellMap[key] = cellMap[key] || { letter: p.word[i], key: false };
      if (p.key) cellMap[key].key = true;
    }
    const startKey = `${p.x},${p.y}`;
    if (numbers[startKey] === undefined) numbers[startKey] = idx + 1;
  });

  let html = `<div class="xword" style="grid-template-columns:repeat(${cw.width},40px); grid-template-rows:repeat(${cw.height},40px);">`;
  for (let y = 0; y < cw.height; y++) {
    for (let x = 0; x < cw.width; x++) {
      const key = `${x},${y}`;
      const c = cellMap[key];
      if (!c) { html += `<div class="cell block"></div>`; continue; }
      const num = numbers[key];
      html += `<div class="cell${c.key ? ' key' : ''}">
        ${num ? `<span style="position:absolute;top:1px;left:2px;font-size:9px;font-weight:700;color:var(--primary-dark);">${num}</span>` : ''}
        <input maxlength="1" data-x="${x}" data-y="${y}" data-letter="${c.letter}">
      </div>`;
    }
  }
  html += `</div>`;

  html += `<ul class="clue-list">`;
  cw.placed.forEach((p, idx) => {
    html += `<li><b>${idx + 1}${p.dir === 'H' ? '→' : '↓'}</b> ${p.clue}${p.key ? ' 🔑' : ''}</li>`;
  });
  html += `</ul>`;

  html += `<button class="btn" id="checkGridBtn" type="button">Vérifier la grille</button>
    <div class="feedback" id="gridFeedback"></div>
    <p class="hint" id="keyWordsHint"></p>`;

  wrap.innerHTML = html;

  const inputs = Array.from(wrap.querySelectorAll('.xword input'));
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.toUpperCase().slice(-1);
      const next = inputs[i + 1];
      if (inp.value && next) next.focus();
    });
  });

  document.getElementById('checkGridBtn').addEventListener('click', () => {
    let allCorrect = true;
    inputs.forEach(inp => {
      const ok = inp.value === inp.dataset.letter;
      inp.parentElement.style.background = ok ? '#d7f3df' : (inp.value ? '#f9d9d9' : '#fff');
      if (!ok) allCorrect = false;
    });
    const fb = document.getElementById('gridFeedback');
    if (allCorrect) {
      fb.textContent = 'Grille complète, bravo !';
      fb.className = 'feedback ok';
      const keyWords = cw.placed.filter(p => p.key).map(p => p.word);
      if (keyWords.length) {
        document.getElementById('keyWordsHint').textContent = `Mot(s) clé pour la suite : ${keyWords.join(', ')}`;
      }
    } else {
      fb.textContent = 'Quelques lettres à revoir…';
      fb.className = 'feedback ko';
    }
  });
}

function renderRebus(board) {
  document.getElementById('rebusDisplay').innerHTML = (board.rebusEmojis || []).map(e => `<span>${e}</span>`).join('');
  const choices = buildChoices(board.rebusAnswer || 'Bateau');
  const wrap = document.getElementById('rebusChoices');
  wrap.innerHTML = choices.map(c => `<button type="button" data-val="${c}">${c}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const correct = btn.dataset.val.toLowerCase() === (board.rebusAnswer || '').toLowerCase();
      wrap.querySelectorAll('button').forEach(b => b.disabled = true);
      btn.classList.add(correct ? 'correct' : 'wrong');
      const fb = document.getElementById('rebusFeedback');
      if (correct) {
        fb.textContent = 'Exact !';
        fb.className = 'feedback ok';
        document.getElementById('rebusAnswerFill').textContent = board.rebusAnswer;
      } else {
        fb.textContent = 'Pas tout à fait, retente.';
        fb.className = 'feedback ko';
        setTimeout(() => wrap.querySelectorAll('button').forEach(b => { b.disabled = false; b.classList.remove('wrong'); }), 900);
      }
    });
  });
}

function renderDiffGame(board) {
  const wrap = document.getElementById('diffGame');
  const COLS = 8, ROWS = 6;
  const point = board.diffPoint || { x: 50, y: 50 };
  const targetCol = Math.min(COLS - 1, Math.floor((point.x / 100) * COLS));
  const targetRow = Math.min(ROWS - 1, Math.floor((point.y / 100) * ROWS));

  function frame(id) {
    let overlay = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        overlay += `<button type="button" data-frame="${id}" data-c="${c}" data-r="${r}"></button>`;
      }
    }
    return `<div class="diff-frame">
      <img src="${board.diffPhoto}">
      <div class="diff-grid-overlay" style="grid-template-columns:repeat(${COLS},1fr); grid-template-rows:repeat(${ROWS},1fr);">${overlay}</div>
    </div>`;
  }
  wrap.innerHTML = frame('left') + frame('right');

  let solved = false;
  wrap.querySelectorAll('button[data-frame]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (solved) return;
      const c = Number(btn.dataset.c), r = Number(btn.dataset.r);
      const fb = document.getElementById('diffFeedback');
      if (c === targetCol && r === targetRow) {
        btn.classList.add('found');
        solved = true;
        fb.textContent = 'Trouvé !';
        fb.className = 'feedback ok';
      } else {
        btn.classList.add('miss');
        fb.textContent = 'Pas là, cherche encore…';
        fb.className = 'feedback ko';
      }
    });
  });
}

function renderFinal(board) {
  const choices = buildChoices(board.finalWord || 'Vacances', 8);
  const wrap = document.getElementById('finalChoices');
  wrap.innerHTML = choices.map(c => `<button type="button" data-val="${c}">${c}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const correct = btn.dataset.val.toLowerCase() === (board.finalWord || '').toLowerCase();
      const fb = document.getElementById('finalFeedback');
      if (correct) {
        wrap.querySelectorAll('button').forEach(b => b.disabled = true);
        btn.classList.add('correct');
        fb.textContent = 'Bravo, tu as tout résolu !';
        fb.className = 'feedback ok';
        showVideo(board);
      } else {
        btn.classList.add('wrong');
        fb.textContent = 'Pas le bon mot, réessaie.';
        fb.className = 'feedback ko';
        setTimeout(() => btn.classList.remove('wrong'), 900);
      }
    });
  });
}

function showVideo(board) {
  const el = document.getElementById('videoSection');
  if (board.video && board.video.dataUrl) {
    el.innerHTML = `<div class="video-block"><h2>🎬 Vidéo surprise</h2><video controls autoplay src="${board.video.dataUrl}"></video></div>`;
  } else {
    el.innerHTML = `<div class="video-block">
      <button class="play-btn" type="button">▶</button>
      <h2>Vidéo surprise débloquée !</h2>
      <p class="locked-msg">(Aucune vidéo n'a été ajoutée dans cette démo, mais c'est ici qu'elle se lancerait.)</p>
    </div>`;
  }
  el.scrollIntoView({ behavior: 'smooth' });
}
