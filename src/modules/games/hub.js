export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Spiele</h1>
      <p class="page-subtitle">Quick, motivating drills. Results feed back into your review queue.</p>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/games/sorting">🗂️&nbsp;&nbsp;der/die/das sorting</a>
        <a class="list-item" style="padding:16px;" href="#/games/timed">⏱️&nbsp;&nbsp;Timed challenge</a>
        <a class="list-item" style="padding:16px;" href="#/games/stories">📖&nbsp;&nbsp;Fill-in-the-blank story</a>
      </div>

      <div class="section-heading">Beta</div>
      <p class="page-subtitle" style="margin-top:-14px;">New games still being tuned — play them and tell me what to keep.</p>
      <div class="card" style="padding:0;">
        <a class="list-item" style="padding:16px;" href="#/games/beta/wordfall">🌧️&nbsp;&nbsp;Wordfall <span class="tag">beta</span></a>
        <a class="list-item" style="padding:16px;" href="#/games/beta/typeit">⌨️&nbsp;&nbsp;Type it <span class="tag">beta</span></a>
        <a class="list-item" style="padding:16px;" href="#/games/beta/case-detective">🕵️&nbsp;&nbsp;Case detective <span class="tag">beta</span></a>
        <a class="list-item" style="padding:16px;" href="#/games/beta/verb-sprint">🏃&nbsp;&nbsp;Verb forms sprint <span class="tag">beta</span></a>
      </div>
    </div>`;
}
