import { getStories } from '../../db/contentLoader.js';
import { escapeHtml } from '../../components/gender.js';

export async function render(container) {
  const stories = getStories();

  function renderList() {
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Fill-in-the-blank Stories</h1>
        <p class="page-subtitle">Reading practice using your current vocab and grammar.</p>
        <div class="card" style="padding:0;">
          ${stories
            .map(
              (s, i) => `<div class="list-item" style="padding:14px 16px; cursor:pointer;" data-story="${i}">
                <span>${escapeHtml(s.title)}</span><span class="tag">${s.level}</span>
              </div>`
            )
            .join('')}
        </div>
      </div>`;
    container.querySelectorAll('[data-story]').forEach((el) => el.addEventListener('click', () => playStory(stories[Number(el.dataset.story)])));
  }

  function playStory(story) {
    const answers = new Array(story.segments.filter((s) => s.type === 'blank').length).fill(null);
    let blankIndex = 0;
    const segmentHTML = story.segments
      .map((seg) => {
        if (seg.type === 'text') return escapeHtml(seg.value);
        const myIndex = blankIndex++;
        return `<select data-blank="${myIndex}" style="display:inline-block; width:auto; margin:0 2px;">
          <option value="">___</option>
          ${seg.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
        </select>`;
      })
      .join('');
    const blanks = story.segments.filter((s) => s.type === 'blank');

    container.innerHTML = `
      <div class="view">
        <a href="#" id="back" class="page-subtitle">&larr; Stories</a>
        <h1 class="page-title">${escapeHtml(story.title)}</h1>
        <div class="card" style="line-height:2;">${segmentHTML}</div>
        <button class="btn btn-primary btn-block" id="check">Check story</button>
        <div id="result"></div>
      </div>`;

    container.querySelector('#back').addEventListener('click', (e) => {
      e.preventDefault();
      renderList();
    });

    container.querySelector('#check').addEventListener('click', () => {
      let correct = 0;
      container.querySelectorAll('[data-blank]').forEach((sel) => {
        const i = Number(sel.dataset.blank);
        const isCorrect = sel.value === blanks[i].answer;
        sel.style.borderColor = sel.value ? (isCorrect ? 'var(--good)' : 'var(--bad)') : 'var(--border)';
        if (isCorrect) correct++;
      });
      container.querySelector('#result').innerHTML = `
        <p style="text-align:center; margin-top:14px; color:${correct === blanks.length ? 'var(--good)' : 'var(--text)'};">
          ${correct} / ${blanks.length} correct
        </p>`;
    });
  }

  if (stories.length === 0) {
    container.innerHTML = `<div class="view empty-state">No stories yet.</div>`;
    return;
  }
  renderList();
}
