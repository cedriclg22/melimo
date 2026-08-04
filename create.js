/* Melimo — créateur : le tableau lui-même est l'unique interface d'édition.
   Chaque zone se modifie au clic ; seule la zone concernée est re-rendue
   pour ne jamais faire perdre le focus d'un champ en cours de saisie. */

const state = {
  photos: [],
  hiddenObject: '',
  hiddenObjectPhoto: null, // index into photos
  hiddenObjectPoint: null, // {x, y} percent within that photo
  hiddenObjectEmoji: '',
  words: WORD_SUGGESTIONS.map((w, i) => ({ word: w.word, clue: w.clue, key: i === 0 })),
  crossword: null,
  rebusEmojis: [],
  rebusAnswer: '',
  diffPhoto: null,
  diffPoint: null,
  montage: { items: [], audio: null }, // {items:[{type:'photo'|'video', src, duration, name}], audio:{name,dataUrl}}
  colorPrimary: '#d9527a',
  colorSecondary: '#fbead9',
  finalWord: ''
};

const MOSAIC_SPANS = ['span-1', 'span-2', 'span-1', 'span-2', 'span-1', 'span-1'];

/* ---------- Squelette (rendu une seule fois) ----------
   Le cadre (.print-poster) garde une taille fixe : les éditeurs de mots
   et de rébus, trop volumineux pour tenir dans leur petite carte,
   s'ouvrent juste en dessous du cadre plutôt que de le faire grandir. */
function renderShell() {
  document.getElementById('editablePoster').innerHTML = `
    <div class="editable-poster-wrap">
      <div class="color-toolbar">
        <input type="color" id="colorPrimaryInput" value="${state.colorPrimary}" title="Couleur principale">
        <input type="color" id="colorSecondaryInput" value="${state.colorSecondary}" title="Couleur secondaire">
      </div>
      <div class="print-poster" id="posterRoot">
        <div class="mosaic-wrap">
          <span class="corner-deco tl">🌿</span>
          <div class="mosaic" id="edMosaic"></div>
          <span class="corner-deco tr">🌿</span>
        </div>

        <div class="poster-cols">
          <div class="poster-left-col">
            <div class="pcard pcard-found clickable" id="edFoundCard" title="Clique pour cacher un objet dans une photo">
              ${ribbonLabel(1, 'Objet caché')}
              <div class="pcard-body"><p class="card-instruction">Écris ici l'objet caché dans les photos ci-dessus :</p></div>
              <input type="text" class="answer-blank-input" id="edHiddenObject" placeholder="ex : un baby-foot" value="${state.hiddenObject}">
            </div>
            <div class="pcard pcard-rebus clickable" id="edRebusCard" title="Clique pour choisir le rébus">
              ${ribbonLabel(3, 'Rébus')}
              <div class="pcard-body"><div class="rebus-box2" id="edRebusBox"></div></div>
              <input type="text" class="answer-blank-input" id="edRebusAnswer" placeholder="ex : Bateau" value="${state.rebusAnswer}">
            </div>
          </div>
          <div class="pcard pcard-flech clickable" id="edFlechCard" title="Clique pour ajouter des mots">
            ${ribbonLabel(2, 'Mots fléchés')}
            <div class="pcard-body"><div class="flech-scroll" id="edFlechWrap"></div></div>
            <div class="answer-blank"></div>
          </div>
        </div>

        <div class="pcard pcard-diff">
          ${ribbonLabel(4, 'Case différente')}
          <div class="pcard-body">
            <p class="card-instruction">Quelle est la case différente entre ces deux images ?</p>
            <div class="diff-card-body" id="edDiffFrame"></div>
          </div>
          <div class="answer-blank"></div>
        </div>

        <div class="pcard pcard-final clickable" id="edFinalCard" title="Clique pour composer la vidéo surprise (photos + vidéo + son)">
          ${ribbonLabel(null, 'Mot final', true)}
          <div class="pcard-body" id="edMontageSummaryBody">
            <div class="play-button-wrap"><div class="play-button"><span class="tri"></span></div></div>
            <p class="final-caption" id="edMontageCaption">Compose ta<br>vidéo surprise !</p>
          </div>
          <input type="text" class="answer-blank-input" id="edFinalWord" placeholder="Réponse attendue (ex : Vacances)" value="${state.finalWord}">
        </div>
      </div>
    </div>

    <div class="inline-editor" id="hiddenObjEditor" hidden>
      <p class="hint">Un objet est déjà caché par défaut : glisse-le directement sur une photo du pêle-mêle ci-dessus pour le repositionner. Tu peux aussi choisir une autre photo, un autre emplacement ou un autre objet ici :</p>
      <div class="hobj-photo-picker" id="hobjPhotoPicker"></div>
      <div class="hobj-placer" id="hobjPlacer"></div>
      <p class="hint" style="margin:4px 0 8px;">Objet à cacher :</p>
      <div class="emoji-picker" id="hobjEmojiPicker"></div>
      <button class="btn ghost" type="button" id="clearHobjBtn">Retirer l'objet caché</button>
    </div>

    <div class="inline-editor" id="wordsEditor" hidden>
      <p class="hint">10 mots avec leur définition, déjà pré-remplis : modifie-les comme tu veux, ou clique sur « Idées de mots » pour repartir d'exemples. Coche « clé » pour le(s) mot(s) qui doivent apparaître dans le message final.</p>
      <div id="wordRows"></div>
      <div class="words-editor-actions">
        <button class="btn ghost" type="button" id="addWordBtn">+ Ajouter un mot</button>
        <button class="btn ghost" type="button" id="suggestWordsBtn">💡 Idées de mots</button>
      </div>
    </div>

    <div class="inline-editor" id="rebusEditor" hidden>
      <p class="hint">Tape le mot à deviner et clique sur « Suggérer » pour générer un rébus automatiquement, ou compose-le toi-même avec les emojis ci-dessous (écris la réponse directement sur le tableau).</p>
      <div class="rebus-suggest-row">
        <input type="text" id="rebusWordInput" placeholder="Mot à représenter (ex : bateau)">
        <button class="btn ghost" type="button" id="suggestRebusBtn">✨ Suggérer</button>
      </div>
      <div class="rebus-sequence" id="rebusSequence"></div>
      <div class="emoji-picker" id="emojiPicker"></div>
      <button class="btn ghost" type="button" id="clearRebusBtn">Effacer</button>
    </div>

    <div class="inline-editor" id="montageEditor" hidden>
      <p class="hint">Ajoute des photos, une vidéo et une musique : ils s'enchaîneront automatiquement pour former la vidéo surprise finale.</p>
      <div class="montage-items" id="montageItemsList"></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin:12px 0;">
        <label class="btn ghost">+ Photos<input type="file" id="montagePhotoInput" accept="image/*" multiple hidden></label>
        <label class="btn ghost">+ Vidéo<input type="file" id="montageVideoInput" accept="video/*" hidden></label>
        <label class="btn ghost">+ Musique / son<input type="file" id="montageAudioInput" accept="audio/*" hidden></label>
      </div>
      <div id="montageAudioRow"></div>
      <button class="btn" type="button" id="montagePreviewBtn">▶ Aperçu du montage</button>
      <div id="montagePreviewStage" style="margin-top:14px;"></div>
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
function ensureDefaultHiddenObject() {
  if (state.hiddenObjectPhoto === null && state.photos.length) {
    state.hiddenObjectPhoto = 0;
    state.hiddenObjectPoint = { x: 68, y: 72 };
    state.hiddenObjectEmoji = state.hiddenObjectEmoji || EMOJI_LIBRARY[0];
  }
}
function renderMosaicInto() {
  const el = document.getElementById('edMosaic');
  let html = state.photos.map((src, i) => {
    const sticker = (state.hiddenObjectPhoto === i && state.hiddenObjectPoint && state.hiddenObjectEmoji)
      ? `<span class="hobj-sticker draggable" data-i="${i}" style="left:${state.hiddenObjectPoint.x}%; top:${state.hiddenObjectPoint.y}%;" title="Glisse pour repositionner">${state.hiddenObjectEmoji}</span>`
      : '';
    return `<div class="tile-slot ${MOSAIC_SPANS[i] || ''}"><img src="${src}">${sticker}<button class="rm" data-i="${i}" type="button">✕</button></div>`;
  }).join('');
  if (state.photos.length < 6) {
    html += `<label class="tile-add ${MOSAIC_SPANS[state.photos.length] || ''}">+<input type="file" id="mosaicInput" accept="image/*" multiple hidden></label>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.rm').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = Number(btn.dataset.i);
      state.photos.splice(i, 1);
      if (state.hiddenObjectPhoto === i) {
        state.hiddenObjectPhoto = null;
        state.hiddenObjectPoint = null;
      } else if (state.hiddenObjectPhoto > i) {
        state.hiddenObjectPhoto -= 1;
      }
      ensureDefaultHiddenObject();
      renderMosaicInto();
      renderHobjPhotoPicker();
      renderHobjPlacer();
    });
  });
  const stickerEl = el.querySelector('.hobj-sticker.draggable');
  if (stickerEl) attachStickerDrag(stickerEl);
  const input = document.getElementById('mosaicInput');
  if (input) {
    input.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files).slice(0, 6 - state.photos.length);
      for (const f of files) state.photos.push(await fileToDataUrl(f));
      ensureDefaultHiddenObject();
      renderMosaicInto();
      renderHobjPhotoPicker();
      renderHobjPlacer();
      e.target.value = '';
    });
  }
}
function attachStickerDrag(stickerEl) {
  const tile = stickerEl.closest('.tile-slot');
  let dragging = false;
  const move = (clientX, clientY) => {
    const rect = tile.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(96, ((clientY - rect.top) / rect.height) * 100));
    state.hiddenObjectPoint = { x, y };
    stickerEl.style.left = x + '%';
    stickerEl.style.top = y + '%';
  };
  stickerEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    stickerEl.classList.add('dragging');
    stickerEl.setPointerCapture(e.pointerId);
  });
  stickerEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    move(e.clientX, e.clientY);
  });
  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    stickerEl.classList.remove('dragging');
    try { stickerEl.releasePointerCapture(e.pointerId); } catch (err) {}
    renderHobjPlacer();
  };
  stickerEl.addEventListener('pointerup', finish);
  stickerEl.addEventListener('pointercancel', finish);
}

/* ---------- Objet caché ---------- */
function renderHobjPhotoPicker() {
  const el = document.getElementById('hobjPhotoPicker');
  if (!el) return;
  if (!state.photos.length) {
    el.innerHTML = '<p class="hint" style="margin:0 0 10px;">Ajoute d\'abord des photos dans le pêle-mêle.</p>';
    return;
  }
  el.innerHTML = state.photos.map((src, i) =>
    `<div class="hobj-thumb ${state.hiddenObjectPhoto === i ? 'active' : ''}" data-i="${i}"><img src="${src}"></div>`
  ).join('');
  el.querySelectorAll('.hobj-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      state.hiddenObjectPhoto = Number(thumb.dataset.i);
      state.hiddenObjectPoint = null;
      renderHobjPhotoPicker();
      renderHobjPlacer();
      renderMosaicInto();
    });
  });
}
function renderHobjPlacer() {
  const el = document.getElementById('hobjPlacer');
  if (!el) return;
  const idx = state.hiddenObjectPhoto;
  if (idx === null || idx === undefined || !state.photos[idx]) {
    el.innerHTML = '<p class="hint">Choisis une photo ci-dessus.</p>';
    return;
  }
  el.innerHTML = `
    <div class="diff-editor" id="hobjEditorImg">
      <img src="${state.photos[idx]}">
      ${state.hiddenObjectPoint && state.hiddenObjectEmoji ? `<span class="hobj-marker-edit" style="left:${state.hiddenObjectPoint.x}%; top:${state.hiddenObjectPoint.y}%;">${state.hiddenObjectEmoji}</span>` : ''}
    </div>
  `;
  document.getElementById('hobjEditorImg').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    state.hiddenObjectPoint = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
    if (!state.hiddenObjectEmoji) state.hiddenObjectEmoji = EMOJI_LIBRARY[0];
    renderHobjPlacer();
    renderMosaicInto();
  });
}
function renderHobjEmojiPickerInto() {
  const el = document.getElementById('hobjEmojiPicker');
  el.innerHTML = EMOJI_LIBRARY.map(e => `<button type="button" data-emoji="${e}" class="${state.hiddenObjectEmoji === e ? 'active' : ''}">${e}</button>`).join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hiddenObjectEmoji = btn.dataset.emoji;
      renderHobjEmojiPickerInto();
      renderHobjPlacer();
      renderMosaicInto();
    });
  });
}

/* ---------- Mots fléchés ---------- */
function currentCrossword() {
  const valid = state.words.filter(w => w.word.trim() && w.clue.trim());
  return valid.length >= 2 ? generateCrossword(valid) : null;
}
function renderFlechEditableInto() {
  state.crossword = currentCrossword();
  document.getElementById('edFlechWrap').innerHTML = posterFlecheesHTML({ crossword: state.crossword });
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
    : '<span class="placeholder">Clique des emojis ci-dessous, ou tape un mot et clique « Suggérer »</span>';
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
      if (state.rebusEmojis.length >= 6) return;
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
    wrap.innerHTML = `<label class="upload-tile" style="width:65%; aspect-ratio:1; max-width:120px;">+<input type="file" id="diffInput" accept="image/*" hidden></label>`;
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
    <div class="diff-editor" id="diffEditor" style="width:75%; max-width:130px;">
      <img src="${state.diffPhoto}">
      ${state.diffPoint ? `<div class="diff-marker" style="left:${state.diffPoint.x}%; top:${state.diffPoint.y}%;"></div>` : ''}
      <button class="diff-reset" type="button" id="diffChangeBtn" title="Changer la photo">↻</button>
    </div>
  `;
  document.getElementById('diffEditor').addEventListener('click', (e) => {
    if (e.target.closest('#diffChangeBtn')) return;
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

/* ---------- Montage (photos + vidéo + son), dans le bloc « Mot final » ---------- */
function renderMontageSummary() {
  const el = document.getElementById('edMontageCaption');
  if (!el) return;
  const items = state.montage.items;
  if (!items.length) {
    el.innerHTML = `Compose ta<br>vidéo surprise !`;
    return;
  }
  const photoCount = items.filter(i => i.type === 'photo').length;
  const videoCount = items.filter(i => i.type === 'video').length;
  const parts = [];
  if (photoCount) parts.push(`${photoCount} photo${photoCount > 1 ? 's' : ''}`);
  if (videoCount) parts.push(`${videoCount} vidéo${videoCount > 1 ? 's' : ''}`);
  if (state.montage.audio) parts.push('musique');
  el.innerHTML = `🎬 ${parts.join(' + ')}<br><span style="font-weight:500; opacity:.7;">(clique pour modifier)</span>`;
}
function renderMontageItemsInto() {
  const wrap = document.getElementById('montageItemsList');
  if (!wrap) return;
  if (!state.montage.items.length) {
    wrap.innerHTML = '<p class="hint" style="margin:0 0 10px;">Aucun élément pour l\'instant.</p>';
    return;
  }
  wrap.innerHTML = state.montage.items.map((it, i) => `
    <div class="montage-row">
      <div class="montage-thumb">${it.type === 'video' ? '🎬' : `<img src="${it.src}">`}</div>
      <div class="montage-meta">
        <span>${it.type === 'video' ? ('Vidéo' + (it.name ? ' — ' + it.name : '')) : 'Photo'}</span>
        ${it.type === 'photo' ? `<label>Durée <input type="number" min="0.5" step="0.5" value="${it.duration}" data-dur="${i}"> s</label>` : ''}
      </div>
      <div class="montage-actions">
        <button type="button" data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">↑</button>
        <button type="button" data-down="${i}" ${i === state.montage.items.length - 1 ? 'disabled' : ''} title="Descendre">↓</button>
        <button type="button" data-mdel="${i}" title="Retirer">✕</button>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-dur]').forEach(inp => inp.addEventListener('input', (e) => {
    state.montage.items[Number(e.target.dataset.dur)].duration = Number(e.target.value) || 2.5;
  }));
  wrap.querySelectorAll('[data-up]').forEach(btn => btn.addEventListener('click', () => {
    const i = Number(btn.dataset.up);
    const items = state.montage.items;
    [items[i - 1], items[i]] = [items[i], items[i - 1]];
    renderMontageItemsInto();
  }));
  wrap.querySelectorAll('[data-down]').forEach(btn => btn.addEventListener('click', () => {
    const i = Number(btn.dataset.down);
    const items = state.montage.items;
    [items[i + 1], items[i]] = [items[i], items[i + 1]];
    renderMontageItemsInto();
  }));
  wrap.querySelectorAll('[data-mdel]').forEach(btn => btn.addEventListener('click', () => {
    state.montage.items.splice(Number(btn.dataset.mdel), 1);
    renderMontageItemsInto();
    renderMontageSummary();
  }));
}
function renderMontageAudioRow() {
  const wrap = document.getElementById('montageAudioRow');
  if (!wrap) return;
  wrap.innerHTML = state.montage.audio
    ? `<p class="hint" style="margin:0 0 10px;">🎵 ${state.montage.audio.name} <button type="button" id="montageAudioDel" style="margin-left:6px; background:#f5dbe1; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer;">✕</button></p>`
    : '';
  const del = document.getElementById('montageAudioDel');
  if (del) del.addEventListener('click', () => { state.montage.audio = null; renderMontageAudioRow(); renderMontageSummary(); });
}

/* ---------- Listeners statiques (attachés une fois) ---------- */
function attachStaticListeners() {
  document.getElementById('edHiddenObject').addEventListener('input', (e) => state.hiddenObject = e.target.value);
  document.getElementById('edFinalWord').addEventListener('input', (e) => state.finalWord = e.target.value);
  document.getElementById('edRebusAnswer').addEventListener('input', (e) => state.rebusAnswer = e.target.value);

  document.getElementById('colorPrimaryInput').addEventListener('input', (e) => { state.colorPrimary = e.target.value; applyPosterColors(); });
  document.getElementById('colorSecondaryInput').addEventListener('input', (e) => { state.colorSecondary = e.target.value; applyPosterColors(); });

  document.getElementById('edFlechCard').addEventListener('click', () => {
    const editor = document.getElementById('wordsEditor');
    editor.hidden = !editor.hidden;
    if (!editor.hidden) editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.getElementById('edRebusCard').addEventListener('click', (e) => {
    if (e.target.closest('.answer-blank-input')) return;
    const editor = document.getElementById('rebusEditor');
    editor.hidden = !editor.hidden;
    if (!editor.hidden) editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.getElementById('edFoundCard').addEventListener('click', (e) => {
    if (e.target.closest('.answer-blank-input')) return;
    const editor = document.getElementById('hiddenObjEditor');
    editor.hidden = !editor.hidden;
    if (!editor.hidden) editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.getElementById('edFinalCard').addEventListener('click', (e) => {
    if (e.target.closest('.answer-blank-input')) return;
    const editor = document.getElementById('montageEditor');
    editor.hidden = !editor.hidden;
    if (!editor.hidden) editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  document.getElementById('clearHobjBtn').addEventListener('click', () => {
    state.hiddenObjectPhoto = null;
    state.hiddenObjectPoint = null;
    state.hiddenObjectEmoji = '';
    renderHobjPhotoPicker();
    renderHobjPlacer();
    renderHobjEmojiPickerInto();
    renderMosaicInto();
  });

  document.getElementById('addWordBtn').addEventListener('click', () => {
    if (state.words.length >= 10) return;
    state.words.push({ word: '', clue: '', key: false });
    renderWordRowsInto();
  });
  document.getElementById('suggestWordsBtn').addEventListener('click', () => {
    const used = new Set(state.words.map(w => w.word.trim().toUpperCase()).filter(Boolean));
    let sIdx = 0;
    state.words.forEach(w => {
      if (!w.word.trim() && !w.clue.trim()) {
        while (sIdx < WORD_SUGGESTIONS.length && used.has(WORD_SUGGESTIONS[sIdx].word)) sIdx++;
        if (sIdx < WORD_SUGGESTIONS.length) {
          w.word = WORD_SUGGESTIONS[sIdx].word;
          w.clue = WORD_SUGGESTIONS[sIdx].clue;
          used.add(w.word);
          sIdx++;
        }
      }
    });
    while (state.words.length < 10 && sIdx < WORD_SUGGESTIONS.length) {
      if (!used.has(WORD_SUGGESTIONS[sIdx].word)) {
        state.words.push({ word: WORD_SUGGESTIONS[sIdx].word, clue: WORD_SUGGESTIONS[sIdx].clue, key: false });
        used.add(WORD_SUGGESTIONS[sIdx].word);
      }
      sIdx++;
    }
    renderWordRowsInto();
    renderFlechEditableInto();
  });
  document.getElementById('clearRebusBtn').addEventListener('click', () => {
    state.rebusEmojis = [];
    renderRebusEditorSequence();
    renderRebusBoxInto();
  });
  document.getElementById('suggestRebusBtn').addEventListener('click', () => {
    const val = document.getElementById('rebusWordInput').value.trim();
    if (!val) return;
    state.rebusEmojis = suggestRebus(val);
    state.rebusAnswer = val.charAt(0).toUpperCase() + val.slice(1);
    document.getElementById('edRebusAnswer').value = state.rebusAnswer;
    renderRebusEditorSequence();
    renderRebusBoxInto();
  });

  document.getElementById('montagePhotoInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) state.montage.items.push({ type: 'photo', src: await fileToDataUrl(f), duration: 2.5 });
    renderMontageItemsInto();
    renderMontageSummary();
    e.target.value = '';
  });
  document.getElementById('montageVideoInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    state.montage.items.push({ type: 'video', src: await fileToDataUrl(f), name: f.name });
    renderMontageItemsInto();
    renderMontageSummary();
    e.target.value = '';
  });
  document.getElementById('montageAudioInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    state.montage.audio = { name: f.name, dataUrl: await fileToDataUrl(f) };
    renderMontageAudioRow();
    renderMontageSummary();
    e.target.value = '';
  });
  document.getElementById('montagePreviewBtn').addEventListener('click', () => {
    renderMontagePlayer(document.getElementById('montagePreviewStage'), state.montage, { uid: 'preview' });
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

  const montageBtn = document.getElementById('openMontageBtn2');
  const qrWrap = document.getElementById('montageQrWrap');
  if (state.montage && state.montage.items.length) {
    const montageUrl = new URL('montage.html', window.location.href);
    montageUrl.searchParams.set('id', id);
    montageBtn.href = montageUrl.toString();
    montageBtn.style.display = '';
    qrWrap.style.display = '';
    document.getElementById('montageQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=6&color=b83d63&data=${encodeURIComponent(montageUrl.toString())}`;
  } else {
    montageBtn.style.display = 'none';
    qrWrap.style.display = 'none';
  }

  document.getElementById('shareWrap').style.display = '';
  document.getElementById('shareWrap').scrollIntoView({ behavior: 'smooth' });
});

/* ---------- Démo pré-remplie ---------- */
document.getElementById('demoFillBtn').addEventListener('click', () => {
  fillDemoData();
  document.getElementById('edHiddenObject').value = state.hiddenObject;
  document.getElementById('edFinalWord').value = state.finalWord;
  document.getElementById('edRebusAnswer').value = state.rebusAnswer;
  document.getElementById('colorPrimaryInput').value = state.colorPrimary;
  document.getElementById('colorSecondaryInput').value = state.colorSecondary;
  applyPosterColors();
  renderMosaicInto();
  renderHobjPhotoPicker();
  renderHobjPlacer();
  renderHobjEmojiPickerInto();
  renderWordRowsInto();
  renderFlechEditableInto();
  renderRebusEditorSequence();
  renderRebusBoxInto();
  renderDiffFrameInto();
  renderMontageItemsInto();
  renderMontageAudioRow();
  renderMontageSummary();
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
  state.hiddenObjectPhoto = 0;
  state.hiddenObjectPoint = { x: 58, y: 65 };
  state.hiddenObjectEmoji = '⚽';
  state.words = [
    { word: 'PLAGE', clue: 'On y fait des châteaux de sable', key: true },
    { word: 'FAMILLE', clue: "Ceux qu'on aime", key: false },
    { word: 'ETE', clue: 'Saison des vacances', key: false },
    { word: 'FORET', clue: "Pleine d'arbres", key: false }
  ];
  state.rebusAnswer = 'Bateau';
  state.rebusEmojis = suggestRebus(state.rebusAnswer);
  state.diffPhoto = svgPlaceholder('#dcead0', '🌳');
  state.diffPoint = { x: 62, y: 38 };
  state.montage = {
    items: [
      { type: 'photo', src: svgPlaceholder('#f1ddd0', '⚽'), duration: 2.5 },
      { type: 'photo', src: svgPlaceholder('#cfe8f0', '🏖️'), duration: 2.5 },
      { type: 'photo', src: svgPlaceholder('#f0d9e4', '👨‍👩‍👧‍👦'), duration: 2.5 }
    ],
    audio: null
  };
  state.colorPrimary = '#d9527a';
  state.colorSecondary = '#fbead9';
  state.finalWord = 'Vacances';
}

/* init */
renderShell();
attachStaticListeners();
applyPosterColors();
renderMosaicInto();
renderHobjPhotoPicker();
renderHobjPlacer();
renderHobjEmojiPickerInto();
renderWordRowsInto();
renderFlechEditableInto();
renderEmojiPickerInto();
renderRebusEditorSequence();
renderRebusBoxInto();
renderDiffFrameInto();
renderMontageItemsInto();
renderMontageAudioRow();
renderMontageSummary();
