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

  const qrTarget = new URL('view.html' + window.location.search, window.location.href).toString();
  root.innerHTML = '<div id="posterContainer"></div>';
  renderPosterInto(document.getElementById('posterContainer'), board, { qrTarget });
}
