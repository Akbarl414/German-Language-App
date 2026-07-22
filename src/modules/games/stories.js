import { getStories } from '../../db/contentLoader.js';
import { escapeHtml } from '../../components/gender.js';
import { resultsListHTML } from '../shared/resultsSummary.js';
import { t } from '../../i18n.js';

/** Short context snippet around a blank, for the results list ("...steht ___ Uhr auf..."). */
function blankContext(segments, segIndex) {
  const before = (segments[segIndex - 1]?.value || '').trim().split(/\s+/).slice(-6).join(' ');
  const after = (segments[segIndex + 1]?.value || '').trim().split(/\s+/).slice(0, 6).join(' ');
  return `${before} ___ ${after}`.trim();
}

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
    // blanks[i] = { segIndex, answer } — segIndex locates the blank within story.segments for context lookups.
    const blanks = [];
    let blankCounter = 0;
    const segmentHTML = story.segments
      .map((seg, segIndex) => {
        if (seg.type === 'text') return escapeHtml(seg.value);
        const myIndex = blankCounter++;
        blanks.push({ segIndex, answer: seg.answer });
        return `<select data-blank="${myIndex}" style="display:inline-block; width:auto; margin:0 2px;">
          <option value="">___</option>
          ${seg.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
        </select><button type="button" class="btn btn-sm" data-hint-for="${myIndex}" title="${t('hintWord')}" style="padding:4px 8px;">💡</button>`;
      })
      .join('');

    container.innerHTML = `
      <div class="view">
        <a href="#" id="back" class="page-subtitle">${t('backToStories')}</a>
        <h1 class="page-title">${escapeHtml(story.title)}</h1>
        <div class="card" style="line-height:2.2;">${segmentHTML}</div>
        <button class="btn btn-primary btn-block" id="check">${t('checkStory')}</button>
        <div id="result"></div>
      </div>`;

    container.querySelector('#back').addEventListener('click', (e) => {
      e.preventDefault();
      renderList();
    });

    // Hint: eliminate one wrong option from that blank's dropdown.
    container.querySelectorAll('[data-hint-for]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const i = Number(btn.dataset.hintFor);
          const select = container.querySelector(`[data-blank="${i}"]`);
          const wrongOptions = [...select.options].filter((o) => o.value && o.value !== blanks[i].answer);
          if (wrongOptions.length > 0) {
            wrongOptions[Math.floor(Math.random() * wrongOptions.length)].remove();
          }
          btn.disabled = true;
        },
        { once: true }
      );
    });

    function runCheck() {
      let correctCount = 0;
      const missedIndices = [];
      container.querySelectorAll('[data-blank]').forEach((sel) => {
        const i = Number(sel.dataset.blank);
        const isCorrect = sel.value === blanks[i].answer;
        sel.style.borderColor = sel.value ? (isCorrect ? 'var(--good)' : 'var(--bad)') : 'var(--border)';
        if (isCorrect) correctCount++;
        else missedIndices.push(i);
      });

      const rows = blanks.map((b, i) => ({
        label: escapeHtml(blankContext(story.segments, b.segIndex)),
        ok: !missedIndices.includes(i),
        correctLabel: missedIndices.includes(i) ? escapeHtml(b.answer) : '',
      }));

      container.querySelector('#result').innerHTML = `
        <p style="text-align:center; margin-top:14px; color:${correctCount === blanks.length ? 'var(--good)' : 'var(--text)'};">
          ${correctCount} / ${blanks.length} correct
        </p>
        ${resultsListHTML(rows)}
        ${missedIndices.length > 0 ? `<button class="btn btn-primary btn-block" id="practice-misses" style="margin-top:16px;">${t('practiceMyMisses', missedIndices.length)}</button>` : ''}
      `;

      const missBtn = container.querySelector('#practice-misses');
      if (missBtn) {
        missBtn.addEventListener('click', () => {
          missedIndices.forEach((i) => {
            const sel = container.querySelector(`[data-blank="${i}"]`);
            sel.disabled = false;
            sel.value = '';
            sel.style.borderColor = 'var(--border)';
          });
          container.querySelector('#result').innerHTML = '';
          container.querySelector('#check').scrollIntoView({ block: 'center' });
        });
      }

      // Lock in correct answers so a "practice misses" retry can't accidentally change them.
      container.querySelectorAll('[data-blank]').forEach((sel) => {
        const i = Number(sel.dataset.blank);
        if (!missedIndices.includes(i)) sel.disabled = true;
      });
    }

    container.querySelector('#check').addEventListener('click', runCheck);
  }

  if (stories.length === 0) {
    container.innerHTML = `<div class="view empty-state">No stories yet.</div>`;
    return;
  }
  renderList();
}
