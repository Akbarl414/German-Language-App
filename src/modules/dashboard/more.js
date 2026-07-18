export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">More</h1>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/phrases">🗣️&nbsp;&nbsp;Phrases &amp; Idioms</a>
        <a class="list-item" style="padding:16px;" href="#/games">🎮&nbsp;&nbsp;Games</a>
        <a class="list-item" style="padding:16px;" href="#/testme">🧪&nbsp;&nbsp;Test me</a>
        <a class="list-item" style="padding:16px;" href="#/add">➕&nbsp;&nbsp;Add content</a>
        <a class="list-item" style="padding:16px;" href="#/settings">⚙️&nbsp;&nbsp;Settings</a>
      </div>
    </div>`;
}
