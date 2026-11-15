# Core 1000: sources, licences, method

Core 1000 is the 1,000 most frequent German headwords that also appear on the Goethe-Zertifikat B1 word list. The Goethe list decides which words qualify and frequency decides their order. The ranked list is `core-1000-plan.json` in this folder; a word in `content/vocab/packs/` carrying `rank` is a Core word. The app does not load anything in `content/core/`.

## Sources

### 1. Goethe-Zertifikat B1 Wortliste (which headwords qualify)

- URL: https://www.goethe.de/pro/relaunch/prf/da/Goethe-Zertifikat_B1_Wortliste.pdf (downloaded 15 November 2026, 104 pages, SHA-256 `8860f7f0c916831b2365f66239a3ceba3be81ddba28e1224846ca8420807fe42`)
- © 2016 Goethe-Institut und ÖSD. All rights reserved: the work may not be copied, stored or put on a network without permission.
- **How it is used:** only to decide whether a headword qualifies. Nothing else is taken from it: no definitions, no example sentences, no plural or conjugation notation, and no layout. The PDF and the text extracted from it were kept outside the repo during authoring and are not committed. What reaches this repo is the bare headwords that are also among the 1,000 most frequent, and those are ordinary German words.
- Every meaning and example sentence in the `core-1000-NN` packs was written for this app.

### 2. FrequencyWords, German 50k list (the order)

- Repo: https://github.com/hermitdave/FrequencyWords, file `content/2018/de/de_50k.txt` (commit `525f9b560de45753a5ea01069454e72e9aa541c6`, SHA-256 of the file `d9e50546fd7e8b6fe6542a2b33c51d1331092b2a3916ec09f80d97856068705b`).
- © Hermit Dave. Content licence: **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/). The code is MIT, but none of it is used here.
- Built from the OpenSubtitles 2018 corpus (http://opus.nlpl.eu/OpenSubtitles2018.php). Because it comes from film and TV subtitles, it leans towards spoken, conversational German.
- **Attribution:** the Core 1000 rank order is adapted from "FrequencyWords" by Hermit Dave (https://github.com/hermitdave/FrequencyWords), licensed CC BY-SA 4.0. Changes: word forms were reduced to headwords, filtered to the Goethe B1 headword list, adjusted by the rules below and re-ranked.
- **ShareAlike:** the rank data is adapted material, so it is licensed **CC BY-SA 4.0**. That covers `core-1000-plan.json` and the `rank` field values in `content/vocab/packs/*.json`. The rest of each pack (meanings, examples, forms) is not derived from FrequencyWords.

### Not used: IDS Mannheim DeReWo

DeReWo forbids commercial use and forbids passing the lists on without their documentation. Publishing ranks derived from it in a public repo would risk breaching those terms, so it was not used.

### Tools (authoring time only, nothing shipped)

- simplemma 2.0.0 (MIT) reduced word forms to headwords.
- pypdf 7.1.0 (BSD-3-Clause) read the Goethe PDF.

## Method

1. **Goethe headwords.**
   - Read the headword column of the alphabetical list (pp. 16–102) and the word groups (pp. 8–15), keeping noun capitalisation and a rough part of speech.
   - Leave out entries marked only Austrian or Swiss, e.g. (A) or (CH) with no (D).
   - Leave out abbreviations (§1.1) and country, city and language names (§1.9), since those are abbreviations or proper names. The nationality adjective *deutsch* stays in.
   - Stem entries are written as full headwords: *all-*→alle, *dies-*→dieser, *ander-*→andere, *beid-*→beide, *einig-*→einige, *letzt-*→letzte, *nächst-*→nächste, *jed-*→jeder, *welch-*→welcher, *solch-*→solche, *manch-*→manche, *zweit-*/*dritt-*→zweite/dritte.
   - The plural form *Daten* is recorded under its headword *Datum*.
2. **Closed-class exception.** The Goethe list has no entries for the personal pronouns, the possessives or the definite article. By the owner's decision these qualify by frequency alone:
   - personal pronouns: ich, du, er, sie, Sie, wir, ihr
   - possessives: mein, dein, sein, ihr/Ihr, unser, euer
   - the reflexive sich
   - the definite article der (covering der/die/das)

   In the plan these rows carry `"closedClassException": true`.
3. **Word forms to headwords.** Every form in `de_50k.txt` is lemmatized with simplemma. If the lemma isn't a headword, the capitalised form is tried as well; this rescues noun plurals the tool reads as verbs, e.g. *tagen*→Tag. Counts are then summed per headword. Fixed rules:
   - Contractions count for their preposition: im/ins→in, zum/zur→zu, am/ans→an, vom→von, beim→bei, aufs→auf, übers→über, fürs→für, ums→um, durchs→durch.
   - *bitte* counts only for the particle bitte, and *danke* only for danke, not for the verbs bitten and danken.
   - All *möcht-* forms count for möchten, which Goethe lists as its own headword, not for mögen.
   - The forms seine/seinen/seinem/seiner/seines count for the possessive sein, and ihre/ihren/ihrem/ihrer/ihres for the possessive ihr.
   - The bare forms *sein* and *ihr* count for both readings. *sie* counts for both sie and Sie, because the corpus is lowercased and the two can't be told apart.
   - Spelling variants count for the headword: gerne→gern, alleine→allein, daß→dass, ok→okay, gefällt→gefallen.
4. **Homographs.** Because the corpus is lowercased, some readings can't be separated, so fixed shares are used:
   - **A form that is itself a different headword** is split 50/50 between its lemma and that headword. Example: *frage* goes half to fragen and half to Frage. Exceptions set by hand, as the share that goes to the other headword: weiß (colour) 0.05, Pass 0.1, Tat 0.2, Alter 0.4, Spiel 0.7, Land 0.7, Fall 0.8, Blut 0.9, Buch 0.9.
   - **Two headwords with the same spelling** (e.g. wissen/Wissen, weg/Weg): the primary reading gets the whole count and the other gets 0.25 of it. Nominalised infinitives (Wissen, Essen, Schreiben, Vertrauen, Fernsehen, Verhalten as verb, vergnügen) get 0.1, and Leben gets 0.35.
   - Primary readings: wissen, mal, leben, weg, Recht, essen, halt, schreiben, Arm, Schuld, vertrauen, fest, wert, Klasse, kosten, Bar, heim, Verhalten, Schaden, Vergnügen, fett, fernsehen, bitte, morgen, Junge.
   - Both readings of a pair can be in the Core 1000, since they are separate headwords.
5. **Ranking.** Sort by adjusted count, breaking ties alphabetically, and take the top 1,000.
6. **Matching existing words.** A row matches an existing pack word when the lemma is identical (case-sensitive) and the part of speech is compatible: noun↔noun, verb↔verb, anything else↔anything else. A match gets `rank` added to the existing word; otherwise the row is `"new"`. For existing words the plan uses the pack's own `pos`. For new words, `pos` was assigned by hand: function words (articles, pronouns, determiners, prepositions, conjunctions, numerals, answer words like ja/nein/danke/bitte/okay) are `other`.

## Words in two packs

Seven headwords exist in two packs. Only one copy is ranked:

| Headword | Ranked copy | Not ranked | In the top 1,000? |
|---|---|---|---|
| arbeiten | core-verbs-1 | work-and-office | yes |
| finden | core-verbs-1 | feelings-and-opinions | yes |
| Zimmer | everyday-nouns | travel | yes |
| Computer | everyday-nouns | work-and-office | yes |
| Bahnhof | everyday-nouns | travel | no (rank it here if it ever enters) |
| Rechnung | food-and-cooking | work-and-office | no (rank it here if it ever enters) |
| Urlaub | travel | work-and-office | no (rank it here if it ever enters) |

The rule: prefer the general pack (core-verbs-1, everyday-nouns). When both packs are topic packs, take the one first in alphabetical order.

## Known limits

- Subtitle frequency favours spoken and dramatic vocabulary, so words like Gott, tot, sterben and Polizei rank higher than they would in a written corpus.
- The homograph shares are judgement calls, not measurements. Ranks are good for ordering bands of 50, not for fine distinctions between neighbouring words.
