/* Melimo — lecture directe du montage (accessible via QR code, sans les jeux) */

const board = loadBoard();
const root = document.getElementById('content');

if (!board || !board.montage || !board.montage.items || !board.montage.items.length) {
  root.innerHTML = `<div class="empty-state">
    <h2>Aucun montage disponible</h2>
    <p>Ce tableau n'a pas de montage vidéo/photo/son. <a href="index.html">Retour à l'accueil</a></p>
  </div>`;
} else {
  applyBoardColors(board);
  root.innerHTML = `
    <h2 style="text-align:center;"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5l1.3-3.8a1.5 1.5 0 0 1 1.9-.9l12.6 4.2a1.5 1.5 0 0 1 .95 1.9L19.2 12H3V9.5z"/><path d="M6.5 5.3L8 9.5M11.5 6.9L13 11.1"/><rect x="3" y="12" width="18" height="8" rx="2"/></svg> Le montage souvenir</h2>
    <div id="montagePlayer" class="montage-player"></div>
  `;
  renderMontagePlayer(document.getElementById('montagePlayer'), board.montage, { uid: 'montagepage' });
}
