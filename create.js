/* Melimo — créateur : le tableau lui-même est l'unique interface d'édition.
   Chaque zone se modifie au clic ; seule la zone concernée est re-rendue
   pour ne jamais faire perdre le focus d'un champ en cours de saisie. */

const state = {
  photos: [],
  hiddenObject: '',
  words: [{ word: '', clue: '', key: false }],
  crossword: null,
  rebusEmojis: [],
  rebusAnswer: '',
  diffPhoto: null,
  diffPoint: null,
  video: null, // {name, dataUrl}
  colorPrimary: '#d9527a',
  colorSecondary: '#fbead9',
  finalWord: ''
};

const MOSAIC_SPANS = ['span-1', 'span-2', 'span-1', 'span-2', 'span-1', 'span-1'];

/* ---------- Squelette (rendu une seule fois) ---------- */
function renderShell() {
  document.getElementById('editablePoster').innerHTML = `
    <div class="editable-poster-wrap">
      <div class="color-toolbar">
        <input type="color" id="colorPrimaryInput" value="${state.colorPrimary}" title="Couleur principale">
        <input type="color" id="colorSecondaryInput" value="${state.colorSecondary}" title="Couleur secondaire">
      </div>
      <div class="print-poster" id="posterRoot">
        <div class="mosaic" id="edMosaic"></div>

        <div class="plabel"><div class="pnum">1</div><div class="ptext">Objet caché :<input class="pinput" id="edHiddenObject" placeholder="ex : un baby-foot" value="${state.hiddenObject}"></div></div>

        <div class="deco-arrow a1">↷</div>

        <div class="plabel"><div class="pnum">2</div><div class="ptext">Mot trouvé :<span class="pline"></span></div></div>
        <button class="edit-affordance" id="wordsToggle" type="button">✏️ <span id="wordsToggleLabel">Ajouter des mots</span></button>
        <div id="edFlechWrap"></div>
        <div class="inline-editor" id="wordsEditor" hidden>
          <p class="hint">Ajoute jusqu'à 10 mots avec leur définition. Coche « clé » pour le(s) mot(s) qui doivent apparaître dans le message final.</p>
          <div id="wordRows"></div>
          <button class="btn ghost" type="button" id="addWordBtn">+ Ajouter un mot</button>
        </div>

        <div class="rebus-print-row">
          <div class="rebus-box2 clickable" id="edRebusBox"></div>
          <div class="deco-arrow a2">↶</div>
          <div class="plabel" style="flex:1;"><div class="pnum">3</div><div class="ptext">Mot trouvé :<span class="pline"></span></div></div>
        </div>
        <div class="inline-editor" id="rebusEditor" hidden>
          <p class="hint">Choisis 2 à 4 emojis, puis indique le mot qu'ils évoquent (pour vérification).</p>
          <div class="rebus-sequence" id="rebusSequence"></div>
          <div class="emoji-picker" id="emojiPicker"></div>
          <button class="btn ghost" type="button" id="clearRebusBtn">Effacer</button>
          <div class="field" style="margin-top:12px;">
            <label>Mot à deviner</label>
            <input type="text" id="rebusAnswer" placeholder="ex : Bateau" value="${state.rebusAnswer}">
          </div>
        </div>

        <div class="plabel"><div class="pnum">4</div><div class="ptext">Case différente :<span class="pline"></span></div></div>
        <p class="phint">Ajoute une photo, puis clique dessus pour placer la case à retrouver.</p>
        <div class="diff-edit-frame" id="edDiffFrame"></div>

        <div class="final-row">
          <div>
            <div class="plabel"><div class="pnum">✓</div><div class="ptext">Mot final :<input class="pinput" id="edFinalWord" placeholder="ex : Vacances" value="${state.finalWord}"></div></div>
            <p class="phint">Assemble les indices trouvés ci-dessus.</p>
          </div>
          <div class="qr-block clickable" id="edVideoBlock"></div>
        </div>
      </div>
    </div>
  `;
}

function applyPosterColors() {
  const root = document.getElementById('posterRoot');
  root.style.setProperty('--primary', state.colorPrimary);
  root.style.setProperty('--secondary', state.colorSecondary);
  root.style.setProperty('--primary-dark', shade(state.colorPrimary, -18));
}

/* ---------- Pêle-mêle ---------- */
function renderMosaicInto() {
  const el = document.getElementById('edMosaic');
  let html = state.photos.map((src, i) =>
    `<div class="tile-slot ${MOSAIC_SPANS[i] || ''}"><img src="${src}"><button class="rm" data-i="${i}" type="button">✕</button></div>`
  ).join('');
  if (state.photos.length < 6) {
    html += `<label class="tile-add ${MOSAIC_SPANS[state.photos.length] || ''}">+<input type="file" id="mosaicInput" accept="image/*" multiple hidden></label>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.rm').forEach(btn => {
    btn.addEventListener('click', () => {
      state.photos.splice(Number(btn.dataset.i), 1);
      renderMosaicInto();
    });
  });
  const input = document.getElementById('mosaicInput');
  if (input) {
    input.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files).slice(0, 6 - state.photos.length);
      for (const f of files) state.photos.push(await fileToDataUrl(f));
      renderMosaicInto();
      e.target.value = '';
    });
  }
}

/* ---------- Mots fléchés ---------- */
function currentCrossword() {
  const valid = state.words.filter(w => w.word.trim() && w.clue.trim());
  return valid.length >= 2 ? generateCrossword(valid) : null;
}
function renderFlechEditableInto() {
  state.crossword = currentCrossword();
  document.getElementById('edFlechWrap').innerHTML = posterFlecheesHTML({ crossword: state.crossword });
  const hasWords = state.words.some(w => w.word.trim());
  document.getElementById('wordsToggleLabel').textContent = hasWords ? 'Modifier les mots' : 'Ajouter des mots';
}
function renderWordRowsInto() {
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
  wrap.querySelectorAll('input[type=text]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.i);
      state.words[i][e.target.dataset.field] = e.target.value;
    });
    inp.addEventListener('blur', () => renderFlechEditableInto());
  });
  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      state.words[Number(e.target.dataset.i)].key = e.target.checked;
      renderFlechEditableInto();
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.words.splice(Number(btn.dataset.del), 1);
      renderWordRowsInto();
      renderFlechEditableInto();
    });
  });
}

/* ---------- Rébus ---------- */
function renderRebusBoxInto() {
  const el = document.getElementById('edRebusBox');
  el.innerHTML = state.rebusEmojis.length
    ? posterRebusHTML(state)
    : '<span style="font-size:1.6rem; opacity:.85;">+</span>';
}
function renderRebusEditorSequence() {
  const el = document.getElementById('rebusSequence');
  el.innerHTML = state.rebusEmojis.length
    ? state.rebusEmojis.map((e, i) => `<span class="chip" data-i="${i}" title="cliquer pour retirer">${e}</span>`).join('')
    : '<span class="placeholder">Clique des emojis ci-dessous</span>';
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.rebusEmojis.splice(Number(chip.dataset.i), 1);
      renderRebusEditorSequence();
      renderRebusBoxInto();
    });
  });
}
function renderEmojiPickerInto() {
  const el = document.getElementById('emojiPicker');
  el.innerHTML = EMOJI_LIBRARY.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.rebusEmojis.length >= 4) return;
      state.rebusEmojis.push(btn.dataset.emoji);
      renderRebusEditorSequence();
      renderRebusBoxInto();
    });
  });
}

/* ---------- Case différente ---------- */
function renderDiffFrameInto() {
  const wrap = document.getElementById('edDiffFrame');
  if (!state.diffPhoto) {
    wrap.innerHTML = `<label class="upload-tile" style="max-width:220px;">+<input type="file" id="diffInput" accept="image/*" hidden></label>`;
    document.getElementById('diffInput').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      state.diffPhoto = await fileToDataUrl(f);
      state.diffPoint = null;
      renderDiffFrameInto();
    });
    return;
  }
  wrap.innerHTML = `
    <div class="diff-editor" id="diffEditor">
      <img src="${state.diffPhoto}">
      ${state.diffPoint ? `<div class="diff-marker" style="left:${state.diffPoint.x}%; top:${state.diffPoint.y}%;"></div>` : ''}
    </div>
    <button class="btn ghost small" type="button" id="diffChangeBtn" style="margin-top:8px;">Changer la photo</button>
  `;
  document.getElementById('diffEditor').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    state.diffPoint = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
    renderDiffFrameInto();
  });
  document.getElementById('diffChangeBtn').addEventListener('click', () => {
    state.diffPhoto = null;
    state.diffPoint = null;
    renderDiffFrameInto();
  });
}

/* ---------- Vidéo surprise ---------- */
function renderVideoBlockInto() {
  const el = document.getElementById('edVideoBlock');
  const content = state.video
    ? `<div style="font-size:1.8rem;">🎬</div><p style="max-width:120px; margin:0 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700;">${state.video.name}</p><p style="font-size:.72rem; opacity:.65; margin:2px 0 0;">clique pour changer</p>`
    : `<div style="font-size:1.8rem;">+</div><p style="margin:2px 0 0;">Vidéo surprise</p>`;
  el.innerHTML = `<label style="cursor:pointer; display:block;">${content}<input type="file" id="videoInputEd" accept="video/*" hidden></label>`;
  document.getElementById('videoInputEd').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    state.video = { name: f.name, dataUrl: await fileToDataUrl(f) };
    renderVideoBlockInto();
  });
}

/* ---------- Listeners statiques (attachés une fois) ---------- */
function attachStaticListeners() {
  document.getElementById('edHiddenObject').addEventListener('input', (e) => state.hiddenObject = e.target.value);
  document.getElementById('edFinalWord').addEventListener('input', (e) => state.finalWord = e.target.value);
  document.getElementById('rebusAnswer').addEventListener('input', (e) => state.rebusAnswer = e.target.value);

  document.getElementById('colorPrimaryInput').addEventListener('input', (e) => { state.colorPrimary = e.target.value; applyPosterColors(); });
  document.getElementById('colorSecondaryInput').addEventListener('input', (e) => { state.colorSecondary = e.target.value; applyPosterColors(); });

  document.getElementById('wordsToggle').addEventListener('click', () => {
    const editor = document.getElementById('wordsEditor');
    editor.hidden = !editor.hidden;
  });
  document.getElementById('edRebusBox').addEventListener('click', () => {
    const editor = document.getElementById('rebusEditor');
    editor.hidden = !editor.hidden;
  });

  document.getElementById('addWordBtn').addEventListener('click', () => {
    if (state.words.length >= 10) return;
    state.words.push({ word: '', clue: '', key: false });
    renderWordRowsInto();
  });
  document.getElementById('clearRebusBtn').addEventListener('click', () => {
    state.rebusEmojis = [];
    renderRebusEditorSequence();
    renderRebusBoxInto();
  });
}

/* ---------- Générer le tableau ---------- */
document.getElementById('generateBtn').addEventListener('click', () => {
  if (!state.crossword) state.crossword = currentCrossword();
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
  document.getElementById('edHiddenObject').value = state.hiddenObject;
  document.getElementById('edFinalWord').value = state.finalWord;
  document.getElementById('rebusAnswer').value = state.rebusAnswer;
  document.getElementById('colorPrimaryInput').value = state.colorPrimary;
  document.getElementById('colorSecondaryInput').value = state.colorSecondary;
  applyPosterColors();
  renderMosaicInto();
  renderWordRowsInto();
  renderFlechEditableInto();
  renderRebusEditorSequence();
  renderRebusBoxInto();
  renderDiffFrameInto();
  renderVideoBlockInto();
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
    { word: 'FORET', clue: "Pleine d'arbres", key: false }
  ];
  state.rebusEmojis = ['⛵', '🍞'];
  state.rebusAnswer = 'Bateau';
  state.diffPhoto = svgPlaceholder('#dcead0', '🌳');
  state.diffPoint = { x: 62, y: 38 };
  state.colorPrimary = '#d9527a';
  state.colorSecondary = '#fbead9';
  state.finalWord = 'Vacances';
}

/* init */
renderShell();
attachStaticListeners();
applyPosterColors();
renderMosaicInto();
renderWordRowsInto();
renderFlechEditableInto();
renderEmojiPickerInto();
renderRebusEditorSequence();
renderRebusBoxInto();
renderDiffFrameInto();
renderVideoBlockInto();
