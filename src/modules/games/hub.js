export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Games</h1>
      <p class="page-subtitle">Quick, motivating drills. Results feed back into your review queue.</p>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/games/matching">🧩&nbsp;&nbsp;Matching — flip pairs</a>
        <a class="list-item" style="padding:16px;" href="#/games/sorting">🗂️&nbsp;&nbsp;der/die/das sorting</a>
        <a class="list-item" style="padding:16px;" href="#/games/timed">⏱️&nbsp;&nbsp;Timed challenge</a>
        <a class="list-item" style="padding:16px;" href="#/games/stories">📖&nbsp;&nbsp;Fill-in-the-blank story</a>
      </div>
    </div>`;
}
