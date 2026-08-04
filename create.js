/* Melimo — logique de l'assistant de création (côté famille) */

const state = {
  photos: [], // data URLs
  hiddenObject: '',
  words: [ // {word, clue, key}
    { word: '', clue: '', key: false }
  ],
  rebusEmojis: [],
  rebusAnswer: '',
  diffPhoto: null,
  diffPoint: null, // {x%, y%}
  coverPhoto: null,
  video: null, // {name, dataUrl}
  colorPrimary: '#d9527a',
  colorSecondary: '#fbead9',
  finalWord: ''
};

const TOTAL_STEPS = 6;

/* Toutes les étapes sont visibles en même temps : le stepper n'est qu'une
   navigation rapide (clic = scroll vers la section), avec un repère visuel
   de la section actuellement à l'écran (scrollspy). */
function renderStepper() {
  const el = document.getElementById('stepper');
  el.innerHTML = '';
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.createElement('a');
    dot.className = 'step-dot';
    dot.href = `#step${i}`;
    dot.textContent = i;
    el.appendChild(dot);
  }
}

function initScrollspy() {
  const dots = Array.from(document.querySelectorAll('.step-dot'));
  const sections = Array.from(document.querySelectorAll('.step'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const i = sections.indexOf(entry.target);
      if (i === -1) return;
      dots[i].classList.toggle('active', entry.isIntersecting);
    });
  }, { rootMargin: '-40% 0px -50% 0px' });
  sections.forEach(s => observer.observe(s));
}

/* ---------- Aperçu en direct de l'affiche ---------- */
function updatePreview() {
  const panel = document.getElementById('livePoster');
  if (!panel) return;
  const preview = { ...state };
  if (!preview.crossword) {
    const valid = state.words.filter(w => w.word.trim() && w.clue.trim());
    if (valid.length >= 2) preview.crossword = generateCrossword(valid);
  }
  panel.style.setProperty('--primary', state.colorPrimary);
  panel.style.setProperty('--secondary', state.colorSecondary);
  panel.style.setProperty('--primary-dark', shade(state.colorPrimary, -18));
  renderPosterInto(panel, preview);
}

/* ---------- Step 1: photos ---------- */
function renderPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  state.photos.forEach((src, i) => {
    const tile = document.createElement('div');
    tile.className = 'photo-tile';
    tile.innerHTML = `<img src="${src}"><button data-i="${i}">✕</button>`;
    grid.appendChild(tile);
  });
  grid.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.photos.splice(Number(btn.dataset.i), 1);
      renderPhotoGrid();
    });
  });
  updatePreview();
}
document.getElementById('photoInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files).slice(0, 10 - state.photos.length);
  for (const f of files) {
    state.photos.push(await fileToDataUrl(f));
  }
  renderPhotoGrid();
  e.target.value = '';
});
document.getElementById('hiddenObject').addEventListener('input', (e) => {
  state.hiddenObject = e.target.value;
  updatePreview();
});

/* ---------- Step 2: mots fléchés ---------- */
function renderWordRows() {
  const wrap = document.getElementById('wordRows');
  wrap.innerHTML = '';
  state.words.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.innerHTML = `
      <input type="text" placeholder="Mot" value="${w.word}" data-field="word" data-i="${i}">
      <input type="text" placeholder="Définition" value="${w.clue}" data-field="clue" data-i="${i}">
      <label class="key-toggle"><input type="checkbox" data-field="key" data-i="${i}" ${w.key ? 'checked' : ''}> clé</label>
      <button class="del" type="button" data-del="${i}">✕</button>
    `;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.i);
      const field = e.target.dataset.field;
      state.words[i][field] = field === 'key' ? e.target.checked : e.target.value;
      state.crossword = null;
      updatePreview();
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.words.splice(Number(btn.dataset.del), 1);
      state.crossword = null;
      renderWordRows();
    });
  });
  updatePreview();
}
document.getElementById('addWordBtn').addEventListener('click', () => {
  if (state.words.length >= 10) return;
  state.words.push({ word: '', clue: '', key: false });
  renderWordRows();
});
document.getElementById('genGridBtn').addEventListener('click', () => {
  const valid = state.words.filter(w => w.word.trim() && w.clue.trim());
  if (valid.length < 2) {
    document.getElementById('gridPreview').innerHTML = '<p class="hint">Ajoute au moins 2 mots avec leur définition.</p>';
    return;
  }
  const cw = generateCrossword(valid);
  state.crossword = cw;
  document.getElementById('gridPreview').innerHTML = renderCrosswordPreview(cw);
  updatePreview();
});
function renderCrosswordPreview(cw) {
  if (!cw.placed.length) return '';
  let html = `<div class="xword" style="grid-template-columns:repeat(${cw.width},22px); grid-template-rows:repeat(${cw.height},22px);">`;
  const cells = {};
  cw.placed.forEach(p => {
    const dx = p.dir === 'H' ? 1 : 0, dy = p.dir === 'V' ? 1 : 0;
    for (let i = 0; i < p.word.length; i++) {
      cells[`${p.x + dx * i},${p.y + dy * i}`] = p.word[i];
    }
  });
  for (let y = 0; y < cw.height; y++) {
    for (let x = 0; x < cw.width; x++) {
      const l = cells[`${x},${y}`];
      html += `<div style="width:22px;height:22px;background:${l ? '#fff' : 'transparent'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#d9527a;">${l || ''}</div>`;
    }
  }
  html += `</div><p class="hint">${cw.placed.length} mots placés sur une grille ${cw.width}×${cw.height}.</p>`;
  return html;
}

/* ---------- Step 3: rébus ---------- */
function renderEmojiPicker() {
  const el = document.getElementById('emojiPicker');
  el.innerHTML = EMOJI_LIBRARY.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.rebusEmojis.length >= 4) return;
      state.rebusEmojis.push(btn.dataset.emoji);
      renderRebusSequence();
    });
  });
}
function renderRebusSequence() {
  const el = document.getElementById('rebusSequence');
  if (!state.rebusEmojis.length) {
    el.innerHTML = '<span class="placeholder">Clique des emojis ci-dessous</span>';
    return;
  }
  el.innerHTML = state.rebusEmojis.map((e, i) => `<span class="chip" data-i="${i}" title="cliquer pour retirer">${e}</span>`).join('');
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.rebusEmojis.splice(Number(chip.dataset.i), 1);
      renderRebusSequence();
    });
  });
  updatePreview();
}
document.getElementById('clearRebusBtn').addEventListener('click', () => {
  state.rebusEmojis = [];
  renderRebusSequence();
});
document.getElementById('rebusAnswer').addEventListener('input', (e) => {
  state.rebusAnswer = e.target.value;
  updatePreview();
});

/* ---------- Step 4: jeu des différences ---------- */
document.getElementById('diffInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.diffPhoto = await fileToDataUrl(f);
  state.diffPoint = null;
  renderDiffEditor();
  e.target.value = '';
});
function renderDiffEditor() {
  const wrap = document.getElementById('diffEditorWrap');
  if (!state.diffPhoto) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="diff-editor" id="diffEditor"><img src="${state.diffPhoto}">${state.diffPoint ? `<div class="diff-marker" style="left:${state.diffPoint.x}%; top:${state.diffPoint.y}%;"></div>` : ''}</div><p class="hint">Clique sur la photo pour placer la case différente.</p>`;
  const editor = document.getElementById('diffEditor');
  editor.addEventListener('click', (e) => {
    const rect = editor.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    state.diffPoint = { x, y };
    renderDiffEditor();
  });
  updatePreview();
}

/* ---------- Step 5: cover + vidéo ---------- */
document.getElementById('coverInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.coverPhoto = await fileToDataUrl(f);
  document.getElementById('coverUploadTile').innerHTML = `<img src="${state.coverPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"><input type="file" id="coverInput2" accept="image/*" hidden>`;
});
document.getElementById('videoInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  state.video = { name: f.name, dataUrl: await fileToDataUrl(f) };
});

/* ---------- Step 6: couleurs + mot final ---------- */
document.getElementById('colorPrimary').addEventListener('input', (e) => { state.colorPrimary = e.target.value; updatePreview(); });
document.getElementById('colorSecondary').addEventListener('input', (e) => { state.colorSecondary = e.target.value; updatePreview(); });
document.getElementById('finalWord').addEventListener('input', (e) => { state.finalWord = e.target.value; updatePreview(); });

/* ---------- Générer le tableau ---------- */
document.getElementById('generateBtn').addEventListener('click', () => {
  if (!state.crossword) {
    const valid = state.words.filter(w => w.word.trim() && w.clue.trim());
    if (valid.length >= 2) state.crossword = generateCrossword(valid);
  }
  const id = Store.newId();
  Store.save(id, state);
  const url = new URL('view.html', window.location.href);
  url.searchParams.set('id', id);
  const posterUrl = new URL('poster.html', window.location.href);
  posterUrl.searchParams.set('id', id);
  document.getElementById('shareLink').value = url.toString();
  document.getElementById('openViewBtn').href = url.toString();
  document.getElementById('openPosterBtn').href = posterUrl.toString();
  document.getElementById('shareWrap').style.display = '';
  document.getElementById('shareWrap').scrollIntoView({ behavior: 'smooth' });
});

/* ---------- Démo pré-remplie ---------- */
document.getElementById('demoFillBtn').addEventListener('click', () => {
  fillDemoData();
  renderPhotoGrid();
  document.getElementById('hiddenObject').value = state.hiddenObject;
  renderWordRows();
  renderRebusSequence();
  document.getElementById('rebusAnswer').value = state.rebusAnswer;
  renderDiffEditor();
  document.getElementById('colorPrimary').value = state.colorPrimary;
  document.getElementById('colorSecondary').value = state.colorSecondary;
  document.getElementById('finalWord').value = state.finalWord;
});

function fillDemoData() {
  state.photos = [
    svgPlaceholder('#f1ddd0', '⚽'),
    svgPlaceholder('#cfe8f0', '🏖️'),
    svgPlaceholder('#f0d9e4', '👨‍👩‍👧‍👦'),
    svgPlaceholder('#dcead0', '🌳'),
    svgPlaceholder('#f6e2b8', '🐚')
  ];
  state.hiddenObject = 'Un baby-foot';
  state.words = [
    { word: 'PLAGE', clue: 'On y fait des châteaux de sable', key: true },
    { word: 'FAMILLE', clue: "Ceux qu'on aime", key: false },
    { word: 'ETE', clue: 'Saison des vacances', key: false },
    { word: 'FORET', clue: 'Pleine d\'arbres', key: false }
  ];
  state.crossword = generateCrossword(state.words);
  state.rebusEmojis = ['⛵', '🍞'];
  state.rebusAnswer = 'Bateau';
  state.diffPhoto = svgPlaceholder('#dcead0', '🌳');
  state.diffPoint = { x: 62, y: 38 };
  state.coverPhoto = svgPlaceholder('#f6e2b8', '🎬');
  state.colorPrimary = '#d9527a';
  state.colorSecondary = '#fbead9';
  state.finalWord = 'Vacances';
}

/* init */
renderStepper();
initScrollspy();
renderPhotoGrid();
renderWordRows();
renderEmojiPicker();
renderRebusSequence();
