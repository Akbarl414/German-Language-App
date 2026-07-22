export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Mehr</h1>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/phrases">🗣️&nbsp;&nbsp;Phrasen &amp; Redewendungen</a>
        <a class="list-item" style="padding:16px;" href="#/games">🎮&nbsp;&nbsp;Spiele</a>
        <a class="list-item" style="padding:16px;" href="#/testme">🧪&nbsp;&nbsp;Teste mich</a>
        <a class="list-item" style="padding:16px;" href="#/active">🗂️&nbsp;&nbsp;Aktive Inhalte</a>
        <a class="list-item" style="padding:16px;" href="#/settings">⚙️&nbsp;&nbsp;Einstellungen</a>
      </div>
    </div>`;
}
