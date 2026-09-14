// Content-invariant tests — these check internal consistency of content.ts
// (numbering, structure, cross-references), which is necessary but NOT
// sufficient for doctrinal correctness. They cannot verify the matn itself
// is word-for-word accurate against a printed edition — that's the human
// review checkpoint described in the plan and in content.ts's own header
// comment, and remains required before this ships to real students.

import { HADITHS, HADITH_CATEGORIES, NARRATORS, getHadith, getNarrator } from './content';

describe('hadith numbering', () => {
  it('is exactly 1..42, contiguous, with no gaps or duplicates', () => {
    const numbers = HADITHS.map((h) => h.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
  });

  it('getHadith resolves every number 1..42 and nothing outside that range', () => {
    for (let n = 1; n <= 42; n++) expect(getHadith(n)).toBeDefined();
    expect(getHadith(0)).toBeUndefined();
    expect(getHadith(43)).toBeUndefined();
  });
});

describe('matn integrity', () => {
  it('no hadith has empty or placeholder text', () => {
    for (const h of HADITHS) {
      expect(h.text.trim().length).toBeGreaterThan(0);
      expect(h.text).not.toMatch(/TODO|TBD|placeholder|lorem ipsum/i);
    }
  });

  it('no hadith has an empty title', () => {
    for (const h of HADITHS) expect(h.title.trim().length).toBeGreaterThan(0);
  });

  it('every hadith text is predominantly Arabic script (catches accidental non-Arabic placeholder text)', () => {
    const arabicRe = /[؀-ۿ]/;
    for (const h of HADITHS) expect(arabicRe.test(h.text)).toBe(true);
  });
});

describe('source citations', () => {
  it('every hadith has a non-empty source citation', () => {
    for (const h of HADITHS) expect(h.source.trim().length).toBeGreaterThan(0);
  });

  it('every source citation names at least one recognizable collector', () => {
    // A loose, non-exhaustive check: the citation should reference at least
    // one of the classical collectors this collection actually draws from.
    const knownCollectors = ['البخاري', 'مسلم', 'الترمذي', 'أبو داود', 'النسائي', 'ابن ماجه', 'الدارقطني', 'البيهقي'];
    for (const h of HADITHS) {
      expect(knownCollectors.some((c) => h.source.includes(c))).toBe(true);
    }
  });
});

describe('narrator references', () => {
  it('every hadith references a narratorId that exists in NARRATORS', () => {
    for (const h of HADITHS) expect(getNarrator(h.narratorId)).toBeDefined();
  });

  it('every declared narrator is actually used by at least one hadith', () => {
    const usedIds = new Set(HADITHS.map((h) => h.narratorId));
    for (const id of Object.keys(NARRATORS)) expect(usedIds.has(id)).toBe(true);
  });

  it('every narrator has a non-empty name and bio', () => {
    for (const n of Object.values(NARRATORS)) {
      expect(n.name.trim().length).toBeGreaterThan(0);
      expect(n.bio.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('category references', () => {
  it('every hadith uses a declared category', () => {
    for (const h of HADITHS) expect(HADITH_CATEGORIES).toContain(h.category);
  });

  it('every declared category is used by at least one hadith', () => {
    const usedCategories = new Set(HADITHS.map((h) => h.category));
    for (const c of HADITH_CATEGORIES) expect(usedCategories.has(c)).toBe(true);
  });

  it('there are exactly 7 declared categories (the module\'s own editorial grouping)', () => {
    expect(HADITH_CATEGORIES).toHaveLength(7);
    expect(new Set(HADITH_CATEGORIES).size).toBe(7);
  });
});
