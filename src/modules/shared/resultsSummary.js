// Shared "round results" list used by every game's end screen: one row per
// item attempted, right/wrong, and the correct answer for anything missed.

export function resultsListHTML(rows) {
  return `
    <div class="section-heading">Round results</div>
    <div class="card" style="padding:0;">
      ${rows
        .map(
          (r) => `
        <div class="list-item" style="align-items:flex-start; gap:14px;">
          <span>${r.label}</span>
          <span style="text-align:right; white-space:nowrap;">${r.ok ? '✅' : `❌${r.correctLabel ? ' ' + r.correctLabel : ''}`}</span>
        </div>`
        )
        .join('')}
    </div>`;
}
