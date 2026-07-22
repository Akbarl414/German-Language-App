export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="page-title">Teste mich</h1>
      <p class="page-subtitle">A mixed quiz biased toward your weak and recently-added material.</p>
      <div class="card">
        <label class="switch-row"><span>Vokabeln</span><input type="checkbox" id="m-vocab" checked /></label>
        <label class="switch-row"><span>Phrasen</span><input type="checkbox" id="m-phrase" checked /></label>
        <label class="switch-row"><span>Grammatik</span><input type="checkbox" id="m-grammar" checked /></label>

        <label for="length">Anzahl der Fragen</label>
        <select id="length">
          <option value="10">10</option>
          <option value="20" selected>20</option>
          <option value="30">30</option>
          <option value="50">50</option>
        </select>

        <button class="btn btn-primary btn-block" id="start" style="margin-top:16px;">Test starten</button>
      </div>
    </div>`;

  container.querySelector('#start').addEventListener('click', () => {
    const modules = [];
    if (container.querySelector('#m-vocab').checked) modules.push('vocab');
    if (container.querySelector('#m-phrase').checked) modules.push('phrase');
    if (container.querySelector('#m-grammar').checked) modules.push('grammar');
    const length = container.querySelector('#length').value;
    if (modules.length === 0) return;
    location.hash = `/testme/run?modules=${modules.join(',')}&length=${length}`;
  });
}
