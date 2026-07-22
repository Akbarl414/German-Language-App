export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Aktive Inhalte</h1>
      <p class="page-subtitle">Manage which vocab packs and grammar units feed your review queue, or add new content.</p>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/grammar">✏️&nbsp;&nbsp;Grammatik</a>
        <a class="list-item" style="padding:16px;" href="#/vocab">📚&nbsp;&nbsp;Vokabeln</a>
        <a class="list-item" style="padding:16px;" href="#/add">➕&nbsp;&nbsp;Inhalt hinzufügen</a>
      </div>
    </div>`;
}
