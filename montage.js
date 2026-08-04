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
    <h2 style="text-align:center;">🎬 Le montage souvenir</h2>
    <div id="montagePlayer" class="montage-player"></div>
  `;
  renderMontagePlayer(document.getElementById('montagePlayer'), board.montage, { uid: 'montagepage' });
}
