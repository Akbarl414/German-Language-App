import { store } from '../../db/storage.js';
import { umlautFieldHTML, wireUmlautButtons } from '../../components/umlaut.js';

function slug(str) {
  return String(str)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
function uid(base) {
  return `${slug(base) || 'item'}-${Date.now().toString(36).slice(-5)}`;
}

export async function render(container) {
  let tab = 'vocab';

  function paint() {
    container.innerHTML = `
      <div class="view">
        <h1 class="page-title">Inhalt hinzufügen</h1>
        <p class="page-subtitle">Right after class: capture a word, phrase, or quick note. Saved on this device and included in your backup export.</p>
        <div class="btn-row" style="margin-bottom:16px;">
          <button class="btn ${tab === 'vocab' ? 'btn-primary' : ''}" data-tab="vocab">Wort</button>
          <button class="btn ${tab === 'phrase' ? 'btn-primary' : ''}" data-tab="phrase">Phrase</button>
          <button class="btn ${tab === 'note' ? 'btn-primary' : ''}" data-tab="note">Notiz</button>
        </div>
        <div id="form-slot"></div>
      </div>`;

    container.querySelectorAll('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab;
        paint();
      })
    );

    const slot = container.querySelector('#form-slot');
    if (tab === 'vocab') renderVocabForm(slot);
    if (tab === 'phrase') renderPhraseForm(slot);
    if (tab === 'note') renderNoteForm(slot);
  }

  paint();
}

function renderVocabForm(slot) {
  slot.innerHTML = `
    <div class="card">
      <label for="v-pos">Part of speech</label>
      <select id="v-pos">
        <option value="noun">Noun</option>
        <option value="verb">Verb</option>
        <option value="adjective">Adjective</option>
        <option value="adverb">Adverb</option>
        <option value="other">Other</option>
      </select>

      ${umlautFieldHTML('v-lemma', { label: 'Word (lemma)', placeholder: 'e.g. Löffel or fahren' })}

      <div id="v-noun-fields">
        <label for="v-gender">Gender</label>
        <select id="v-gender"><option value="der">der</option><option value="die">die</option><option value="das">das</option></select>
        ${umlautFieldHTML('v-plural', { label: 'Plural (without article)', placeholder: 'e.g. Löffel' })}
      </div>

      <div id="v-verb-fields" style="display:none;">
        ${umlautFieldHTML('v-present', { label: '3rd person present', placeholder: 'e.g. fährt' })}
        ${umlautFieldHTML('v-praeteritum', { label: 'Präteritum', placeholder: 'e.g. fuhr' })}
        ${umlautFieldHTML('v-perfekt', { label: 'Perfekt (full form)', placeholder: 'e.g. ist gefahren' })}
        <label for="v-aux">Auxiliary</label>
        <select id="v-aux"><option value="haben">haben</option><option value="sein">sein</option></select>
        <label class="switch-row"><span>Separable prefix</span><input type="checkbox" id="v-separable" /></label>
        ${umlautFieldHTML('v-government', { label: 'Case/preposition government (optional)', placeholder: 'e.g. warten auf + Akk' })}
      </div>

      <label for="v-meaning">English meaning</label>
      <input type="text" id="v-meaning" placeholder="e.g. spoon" />

      ${umlautFieldHTML('v-example-de', { label: 'Example sentence (German)' })}
      <label for="v-example-en">Example sentence (English)</label>
      <input type="text" id="v-example-en" />

      <button class="btn btn-primary btn-block" id="v-save" style="margin-top:16px;">Wort speichern</button>
      <div id="v-msg"></div>
    </div>`;

  wireUmlautButtons(slot);

  const posSelect = slot.querySelector('#v-pos');
  posSelect.addEventListener('change', () => {
    slot.querySelector('#v-noun-fields').style.display = posSelect.value === 'noun' ? 'block' : 'none';
    slot.querySelector('#v-verb-fields').style.display = posSelect.value === 'verb' ? 'block' : 'none';
  });

  slot.querySelector('#v-save').addEventListener('click', () => {
    const pos = posSelect.value;
    const lemma = slot.querySelector('#v-lemma').value.trim();
    const meaning_en = slot.querySelector('#v-meaning').value.trim();
    if (!lemma || !meaning_en) {
      slot.querySelector('#v-msg').innerHTML = `<p style="color:var(--bad);">Word and meaning are required.</p>`;
      return;
    }
    const word = {
      id: uid(lemma),
      pos,
      lemma,
      meaning_en,
      example_de: slot.querySelector('#v-example-de').value.trim() || `${lemma}.`,
      example_en: slot.querySelector('#v-example-en').value.trim() || meaning_en,
    };
    if (pos === 'noun') {
      word.gender = slot.querySelector('#v-gender').value;
      word.plural = slot.querySelector('#v-plural').value.trim() || lemma;
    }
    if (pos === 'verb') {
      word.present_3sg = slot.querySelector('#v-present').value.trim() || lemma;
      word.praeteritum = slot.querySelector('#v-praeteritum').value.trim() || lemma;
      word.perfekt = slot.querySelector('#v-perfekt').value.trim() || `hat ${lemma}`;
      word.auxiliary = slot.querySelector('#v-aux').value;
      word.separable = slot.querySelector('#v-separable').checked;
      const gov = slot.querySelector('#v-government').value.trim();
      if (gov) word.government = gov;
    }
    store.addUserVocab(word);
    slot.querySelector('#v-msg').innerHTML = `<p style="color:var(--good);">Saved "${lemma}" — it'll show up under My Added Words.</p>`;
    slot.querySelectorAll('input[type="text"]').forEach((el) => (el.value = ''));
  });
}

function renderPhraseForm(slot) {
  slot.innerHTML = `
    <div class="card">
      ${umlautFieldHTML('p-phrase', { label: 'Phrase', placeholder: 'e.g. Das ist mir Wurst.' })}
      ${umlautFieldHTML('p-literal', { label: 'Literal translation', placeholder: 'e.g. That is sausage to me.' })}
      <label for="p-meaning">Actual meaning</label>
      <input type="text" id="p-meaning" placeholder="e.g. I don't care." />
      <label for="p-register">Register</label>
      <select id="p-register"><option value="colloquial">colloquial</option><option value="neutral">neutral</option><option value="formal">formal</option></select>
      ${umlautFieldHTML('p-situation', { label: 'Example situation / dialogue', multiline: true })}
      <button class="btn btn-primary btn-block" id="p-save" style="margin-top:16px;">Phrase speichern</button>
      <div id="p-msg"></div>
    </div>`;

  wireUmlautButtons(slot);

  slot.querySelector('#p-save').addEventListener('click', () => {
    const phrase = slot.querySelector('#p-phrase').value.trim();
    const meaning = slot.querySelector('#p-meaning').value.trim();
    if (!phrase || !meaning) {
      slot.querySelector('#p-msg').innerHTML = `<p style="color:var(--bad);">Phrase and meaning are required.</p>`;
      return;
    }
    store.addUserPhrase({
      id: uid(phrase),
      phrase,
      literal: slot.querySelector('#p-literal').value.trim() || phrase,
      meaning,
      register: slot.querySelector('#p-register').value,
      situation: slot.querySelector('#p-situation').value.trim() || meaning,
    });
    slot.querySelector('#p-msg').innerHTML = `<p style="color:var(--good);">Saved — it'll show up under My Added Phrases.</p>`;
    slot.querySelectorAll('input[type="text"], textarea').forEach((el) => (el.value = ''));
  });
}

function renderNoteForm(slot) {
  const notes = store.getUserContent().notes;
  slot.innerHTML = `
    <div class="card">
      ${umlautFieldHTML('n-text', { label: 'Quick note', placeholder: 'Anything from class worth remembering...', multiline: true })}
      <button class="btn btn-primary btn-block" id="n-save" style="margin-top:16px;">Notiz speichern</button>
    </div>
    ${
      notes.length
        ? `<div class="section-heading">Recent notes</div><div class="card" style="padding:0;">${notes
            .slice()
            .reverse()
            .map((n) => `<div class="list-item" style="display:block;"><div>${escapeHtml(n.text)}</div><div class="page-subtitle" style="margin:2px 0 0;">${new Date(n.createdAt).toLocaleDateString()}</div></div>`)
            .join('')}</div>`
        : ''
    }`;

  wireUmlautButtons(slot);

  slot.querySelector('#n-save').addEventListener('click', () => {
    const text = slot.querySelector('#n-text').value.trim();
    if (!text) return;
    store.addUserNote({ id: `note-${Date.now()}`, text, createdAt: new Date().toISOString() });
    renderNoteForm(slot);
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
