/* ==========================================================================
   قاعدة الجهابذة — مولّدات الأسئلة
   وحدة خالصة: تُستدعى من الخادم (لتوليد الاختبارات) ومن العميل معاً.
   ========================================================================== */

import type { Letter, Station, WordFamily } from './content';

export type QuestionMode = 'learn' | 'choice' | 'read' | 'hunt' | 'order' | 'build';

export interface QuestionOption {
  id: string; text: string; sub?: string; big?: boolean;
}

export interface QuestionTile { id: string; text: string; ok?: boolean }

export interface Question {
  key: string;
  mode: QuestionMode;
  prompt: string;
  display?: string;
  mark?: string | null;
  speak?: string;
  small?: boolean;
  title?: string;
  audioOnly?: boolean;
  reveal?: string;
  facts?: { label: string; value: string }[];
  options?: QuestionOption[];
  answer?: string;
  answerText?: string;
  /** ترتيب معرّفات القطع الصحيح — لنمط 'order' */
  answerOrder?: string[];
  tiles?: QuestionTile[];
  note?: string;
}

import {
  LETTERS, byId, byChar, forms, SIMILAR_GROUPS, HARAKAT, WORDS, POSITION_WORDS,
  SENTENCES, LAM_WORDS, TAJWEED_RULES, TAJWEED_EXAMPLES, QALQALA_WORDS,
  MEEM_RULES, MEEM_EXAMPLES, HAMZA_WORDS, MADD_TYPES, MADD_EXAMPLES,
  RA_WORDS, RA_RULES, LAM_JALALA, TA_WORDS, ALIF_WORDS,
  HARAKAH_SPELL, COMPOSITES, MUQATTAAT, MUQATTAA_LETTERS,
  WORD_FAMILIES, CVC_WORDS, familyWords, allFamilyWords,
  DAGGER_WORDS, SILENT_WORDS, GHUNNA_WORDS, SHADDA_MADD_WORDS,
  WAQF_MARKS, MAKHARIJ_GROUPS, SURAHS,
  SOUND_GROUPS, DAD_ZA_PAIRS, WAQF_RULES, WAQF_WORDS,
  FATHA, SUKUN, SHADDA
} from './content';

/* -------------------------------------------------------------- أدوات */
export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const sample = <T,>(a: T[], n: number): T[] => shuffle(a).slice(0, n);

function distractors<T>(pool: T[], correct: T, n: number, keyFn?: (x: T) => unknown): T[] {
  const k = keyFn || ((x: T) => x as unknown);
  return sample(pool.filter(x => k(x) !== k(correct)), n);
}

export function stripTashkeel(s: string): string {
  return s.replace(/[\u064B-\u0652\u0670\u0653-\u0655\u0640]/g, '');
}

const POS_NAMES = { initial: 'أول الكلمة', medial: 'وسط الكلمة', final: 'آخر الكلمة' };

/* ================================================== ١. تعرّف على الحروف */
function learnLetters(args: { from: number; to: number }): Question[] {
  return LETTERS.slice(args.from, args.to).map(L => {
    const f = forms(L);
    return {
      key: 'letter:' + L.id,
      mode: 'learn' as const,
      prompt: 'استمع إلى اسم الحرف، ثم انطقه',
      display: L.c,
      speak: L.name,
      title: L.name,
      facts: [
        { label: 'المخرج', value: L.makhraj },
        { label: 'الصفة', value: L.tf ? 'مُفخَّم دائماً' : 'مُرقَّق' },
        { label: 'الأشكال', value: f.initial + '   ' + f.medial + '   ' + f.final }
      ]
    };
  });
}

/* ============================================ ٢. اسمع الاسم واختر الحرف */
function letterByAudio(n: number): Question[] {
  return sample(LETTERS, n).map(L => ({
    key: 'letter:' + L.id,
    mode: 'choice' as const,
    prompt: 'استمع إلى اسم الحرف ثم اختر رسمه',
    speak: L.name,
    audioOnly: true,
    options: shuffle([L, ...distractors(LETTERS, L, 3, x => x.id)])
      .map(o => ({ id: o.id, text: o.c, big: true })),
    answer: L.id,
    note: 'هذا حرف ' + L.name + '، ومخرجه من ' + L.makhraj + '.'
  }));
}

/* ================================================== ٣. الحروف المتشابهة */
function similarLetters(n: number): Question[] {
  const out: Question[] = [];
  while (out.length < n) {
    const g = pick(SIMILAR_GROUPS);
    const L = byId[pick(g.ids)];
    out.push({
      key: 'similar:' + L.id,
      mode: 'choice' as const,
      prompt: 'أيُّ هذه هو حرف ' + L.name + '؟',
      speak: L.name,
      options: shuffle(g.ids.map(id => ({ id, text: byId[id].c, big: true }))),
      answer: L.id,
      note: g.label + ' تتشابه في الرسم وتختلف في النقط والصوت.'
    });
  }
  return out;
}

/* ================================================== ٤. ترتيب الحروف */
function orderLetters(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor(Math.random() * (LETTERS.length - 5));
    const run = LETTERS.slice(start, start + 4);
    out.push({
      key: 'order:' + run[0].id,
      mode: 'order' as const,
      prompt: 'رتّب الحروف حسب ترتيبها في الهجاء',
      tiles: shuffle(run.map(L => ({ id: L.id, text: L.c }))),
      answerOrder: run.map(L => L.id),
      note: 'الترتيب الصحيح: ' + run.map(L => L.name).join(' ← ')
    });
  }
  return out;
}

/* ================================================== ٥. أشكال الحرف */
function letterForms(n: number): Question[] {
  const pool = LETTERS.filter(L => L.joinAfter !== false && L.id !== 'hamza');
  return sample(pool, n).map(L => {
    const f = forms(L);
    const pos = pick(['initial', 'medial', 'final']);
    const others = distractors(pool, L, 3, x => x.id)
      .map(o => ({ id: o.id, text: forms(o)[pos], big: true }));
    return {
      key: 'form:' + L.id,
      mode: 'choice' as const,
      prompt: 'أيُّ هذه هو شكل حرف ' + L.name + ' في ' + POS_NAMES[pos] + '؟',
      speak: L.name,
      options: shuffle([{ id: L.id, text: f[pos], big: true }, ...others]),
      answer: L.id,
      note: 'حرف ' + L.name + ': ' + f.initial + ' في الأول، و' + f.medial + ' في الوسط، و' + f.final + ' في الآخر.'
    };
  });
}

/* ================================================== ٦. موقع الحرف */
function letterPosition(n: number): Question[] {
  const ids = Object.keys(POSITION_WORDS);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const id = pick(ids);
    const L = byId[id];
    const pos = pick(['initial', 'medial', 'final']);
    const word = POSITION_WORDS[id][pos];
    out.push({
      key: 'pos:' + id,
      mode: 'choice' as const,
      prompt: 'أين يقع حرف ' + L.name + ' في هذه الكلمة؟',
      display: word,
      mark: L.c,
      speak: word,
      options: shuffle(Object.keys(POS_NAMES).map(k => ({ id: k, text: POS_NAMES[k] }))),
      answer: pos,
      note: 'في «' + word + '» يقع حرف ' + L.name + ' في ' + POS_NAMES[pos] + '.'
    });
  }
  return out;
}

/* ================================================== ٧. تدريب الحركات */
function harakahDrill(args: any, n: number): Question[] {
  const H = HARAKAT.find(h => h.id === args.harakah) || HARAKAT[0];
  const pool = LETTERS.filter(L => L.id !== 'alif');
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const L = pick(pool);
    const text = L.c + H.mark;
    out.push({
      key: 'har:' + L.id + ':' + H.id,
      mode: 'choice' as const,
      prompt: 'ما الحركة التي على هذا الحرف؟',
      display: text,
      speak: text,
      options: shuffle([H, ...distractors(HARAKAT.slice(0, 6), H, 3, x => x.id)])
        .map(h => ({ id: h.id, text: h.name, sub: '\u0640' + h.mark })),
      answer: H.id,
      note: H.name + ': ' + H.hint
    });
  }
  return out;
}

/* ================================================== ٨. صيد الحركة */
function harakahHunt(args: any, n: number): Question[] {
  const set = args && args.pool === 'tanween' ? HARAKAT.slice(3, 6) : HARAKAT.slice(0, 3);
  const out: Question[] = [];
  const rounds = Math.max(3, Math.round(n / 2));
  for (let i = 0; i < rounds; i++) {
    const H = pick(set);
    const others = set.filter(h => h.id !== H.id);
    const letters = sample(LETTERS.filter(L => L.id !== 'alif'), 9);
    const tiles = letters.map((L, idx) => {
      // ثلاث إجابات صحيحة مضمونة، وثلاثة مشتّتات مضمونة، والباقي عشوائي
      const h = idx < 3 ? H : (idx < 6 ? pick(others) : pick(set));
      return { id: 't' + idx, text: L.c + h.mark, ok: h.id === H.id };
    });
    out.push({
      key: 'hunt:' + H.id,
      mode: 'hunt' as const,
      prompt: 'اضغط كل حرف عليه ' + H.name,
      tiles: shuffle(tiles),
      note: H.name + ': ' + H.hint
    });
  }
  return out;
}

/* ================================================== ٩. مقاطع ساكنة */
function syllableDrill(args: any, n: number): Question[] {
  const mufakham = ['kha', 'sad', 'dad', 'tta', 'zza', 'ghayn', 'qaf'];
  const pool = args.set === 'mufakham'
    ? LETTERS.filter(L => mufakham.indexOf(L.id) > -1)
    : LETTERS.filter(L => mufakham.indexOf(L.id) === -1 && L.id !== 'alif');
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const a = pick(pool), b = pick(pool);
    const text = a.c + FATHA + b.c + SUKUN;
    const wrong: string[] = [];
    let guard = 0;
    while (wrong.length < 3 && guard++ < 60) {
      const t = pick(pool).c + FATHA + pick(pool).c + SUKUN;
      if (t !== text && wrong.indexOf(t) === -1) wrong.push(t);
    }
    const options = shuffle([text, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t, big: true }));
    out.push({
      key: 'syl:' + a.id + b.id,
      mode: 'choice' as const,
      prompt: 'استمع إلى المقطع ثم اختر رسمه',
      speak: text,
      audioOnly: true,
      options,
      answer: (options.find(o => o.text === text) as QuestionOption).id,
      note: 'الحرف الأول متحرك بالفتحة والثاني ساكن، فيُنطقان مقطعاً واحداً.'
    });
  }
  return out;
}

/* ================================================== ١٠. القلقلة */
function qalqala(n: number): Question[] {
  const qLetters = LETTERS.filter(L => L.q);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      const w = pick(QALQALA_WORDS);
      const bare = stripTashkeel(w);
      const found: Letter = qLetters.filter(L => bare.indexOf(L.c) > -1)[0] ?? qLetters[0];
      out.push({
        key: 'qal:' + found.id,
        mode: 'choice' as const,
        prompt: 'ما حرف القلقلة في هذه الكلمة؟',
        display: w,
        mark: found.c,
        speak: w,
        options: shuffle([found, ...distractors(qLetters, found, 3, x => x.id)])
          .map(L => ({ id: L.id, text: L.c, big: true })),
        answer: found.id,
        note: 'حروف القلقلة مجموعة في «قُطْبُ جَدٍّ»: ق ط ب ج د، وتُقلقل إذا سكنت.'
      });
    } else {
      const L = pick(LETTERS);
      out.push({
        key: 'qalYN:' + L.id,
        mode: 'choice' as const,
        prompt: 'هل حرف ' + L.name + ' من حروف القلقلة؟',
        display: L.c,
        speak: L.name,
        options: shuffle([{ id: 'y', text: 'نعم' }, { id: 'n', text: 'لا' }]),
        answer: L.q ? 'y' : 'n',
        note: 'حروف القلقلة خمسة: ق ط ب ج د.'
      });
    }
  }
  return out;
}

/* ================================================== ١١. الشدّة */
function shaddaDrill(n: number): Question[] {
  const pool = LETTERS.filter(L => L.id !== 'alif');
  return sample(pool, n).map(L => ({
    key: 'shad:' + L.id,
    mode: 'choice' as const,
    prompt: 'كم حرفاً يُنطق في هذا الرسم؟',
    display: L.c + SHADDA + FATHA,
    speak: L.c + SHADDA + FATHA,
    options: shuffle([
      { id: 'two', text: 'حرفان: ساكن ثم متحرك' },
      { id: 'one', text: 'حرف واحد متحرك' },
      { id: 'three', text: 'ثلاثة أحرف' },
      { id: 'none', text: 'لا يُنطق' }
    ]),
    answer: 'two',
    note: 'الشدة تدل على حرفين: الأول ساكن والثاني متحرك، يُدمجان في نطقة واحدة قوية.'
  }));
}

function shaddaContrast(n: number): Question[] {
  const pool = LETTERS.filter(L => L.id !== 'alif' && L.joinAfter !== false);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const L = pick(pool);
    const isShadda = Math.random() < 0.5;
    const text = 'مَ' + L.c + (isShadda ? SHADDA + FATHA : SUKUN) + 'د';
    out.push({
      key: 'shcon:' + L.id,
      mode: 'choice' as const,
      prompt: 'ما حال الحرف الأوسط؟',
      display: text,
      mark: L.c,
      speak: text,
      options: shuffle([{ id: 'sh', text: 'مُشدَّد' }, { id: 'sk', text: 'ساكن' }]),
      answer: isShadda ? 'sh' : 'sk',
      note: 'الشدة (\u0651) تعني تكرار الحرف، والسكون (\u0652) يعني وقف الصوت عليه.'
    });
  }
  return out;
}

/* ================================================== ١٢. قراءة الكلمات */
function readWords(args: any, n: number): Question[] {
  const bank = WORDS[args.bank] || WORDS.fatha;
  return sample(bank, Math.min(n, bank.length)).map(w => ({
    key: 'word:' + w,
    mode: 'read' as const,
    prompt: 'اقرأ الكلمة بصوت واضح، ثم استمع وقارن',
    display: w,
    speak: w,
    note: 'تدرَّب على النطق مرتين قبل الانتقال.'
  }));
}

function readSentence(n: number): Question[] {
  return sample(SENTENCES, Math.min(n, SENTENCES.length)).map(s => ({
    key: 'sent:' + s,
    mode: 'read' as const,
    prompt: 'اقرأ الجملة كاملة، ثم استمع وقارن',
    display: s,
    small: true,
    speak: s,
    note: 'اقرأ بتأنٍّ، وراعِ حركة آخر كل كلمة.'
  }));
}

/* ================================================== ١٣. تركيب الكلمة */
function buildWord(n: number): Question[] {
  const bank = WORDS.fatha.concat(WORDS.kasra, WORDS.damma)
    .filter(w => stripTashkeel(w).length <= 4);
  return sample(bank, n).map(w => {
    const chars = Array.from(stripTashkeel(w));
    return {
      key: 'build:' + w,
      mode: 'build' as const,
      prompt: 'استمع إلى الكلمة ثم رتّب حروفها',
      speak: w,
      reveal: w,
      tiles: shuffle(chars.map((c, i) => ({ id: 'c' + i, text: c }))),
      answerText: chars.join(''),
      note: 'الكلمة: ' + w
    };
  });
}

/* ================================================== ١٤. المد واللين */
function maddContrast(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const isLeen = Math.random() < 0.5;
    const w = isLeen ? pick(WORDS.leen) : pick(WORDS.madd_waw.concat(WORDS.madd_ya));
    out.push({
      key: 'madd:' + w,
      mode: 'choice' as const,
      prompt: 'هل الواو أو الياء هنا حرف مدّ أم حرف لين؟',
      display: w,
      speak: w,
      options: shuffle([{ id: 'madd', text: 'حرف مدّ' }, { id: 'leen', text: 'حرف لين' }]),
      answer: isLeen ? 'leen' : 'madd',
      note: 'حرف المد: واو ساكنة قبلها ضمة أو ياء ساكنة قبلها كسرة. وحرف اللين: واو أو ياء ساكنة قبلها فتحة.'
    });
  }
  return out;
}

/* ================================================== ١٥. اللام الشمسية */
function lamRule(n: number): Question[] {
  return sample(LAM_WORDS, Math.min(n, LAM_WORDS.length)).map(x => ({
    key: 'lam:' + x.w,
    mode: 'choice' as const,
    prompt: 'أيُّ لام في هذه الكلمة؟',
    display: x.w,
    speak: x.w,
    options: shuffle([
      { id: 'sun', text: 'لام شمسية', sub: 'تُكتب ولا تُنطق' },
      { id: 'moon', text: 'لام قمرية', sub: 'تُكتب وتُنطق' }
    ]),
    answer: x.type,
    note: x.type === 'sun'
      ? 'اللام الشمسية لا تُنطق، ويُشدَّد الحرف الذي بعدها.'
      : 'اللام القمرية تُنطق ساكنة واضحة.'
  }));
}

/* ================================================== ١٦. أحكام التجويد */
function learnRules(): Question[] {
  return TAJWEED_RULES.map(r => {
    const ex = TAJWEED_EXAMPLES.filter(e => e.rule === r.id)[0];
    return {
      key: 'rule:' + r.id,
      mode: 'learn' as const,
      prompt: 'احفظ الحكم وحروفه',
      display: r.letters,
      small: true,
      title: r.name,
      speak: r.name,
      facts: [
        { label: 'الحروف', value: r.letters },
        { label: 'التعريف', value: r.desc },
        { label: 'مثال', value: ex ? ex.t : '—' }
      ]
    };
  });
}

function rulePick(n: number): Question[] {
  return sample(TAJWEED_EXAMPLES, Math.min(n, TAJWEED_EXAMPLES.length)).map(ex => {
    const R = TAJWEED_RULES.filter(r => r.id === ex.rule)[0];
    return {
      key: 'tj:' + ex.t,
      mode: 'choice' as const,
      prompt: 'ما حكم النون الساكنة أو التنوين هنا؟',
      display: ex.t,
      small: true,
      speak: ex.t,
      options: shuffle([R, ...distractors(TAJWEED_RULES, R, 3, x => x.id)])
        .map(r => ({ id: r.id, text: r.name })),
      answer: R.id,
      note: R.name + ' — حروفه: ' + R.letters
    };
  });
}

function ruleLetters(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const R = pick(TAJWEED_RULES);
    const its = R.letters.split(' ');
    const mine = pick(its);
    const others = TAJWEED_RULES.filter(r => r.id !== R.id)
      .reduce<string[]>((a, r) => a.concat(r.letters.split(' ')), [])
      .filter(c => its.indexOf(c) === -1);
    const wrong = sample(others, 3);
    out.push({
      key: 'rl:' + R.id,
      mode: 'choice' as const,
      prompt: 'أيُّ هذه الحروف من حروف ' + R.name + '؟',
      options: shuffle([{ id: 'ok', text: mine, big: true },
        ...wrong.map((c, k) => ({ id: 'x' + k, text: c, big: true }))]),
      answer: 'ok',
      note: R.name + ': ' + R.letters
    });
  }
  return out;
}

/* ============================ مساعد عام: تصنيف كلمة بين خيارين أو أكثر */
function classify(pool: any[], n: number, cfg: any): Question[] {
  return sample(pool, Math.min(n, pool.length)).map(x => ({
    key: cfg.prefix + ':' + x.w,
    mode: 'choice' as const,
    prompt: cfg.prompt,
    display: x.w,
    mark: cfg.mark ? cfg.mark(x) : undefined,
    small: cfg.small,
    speak: x.w,
    options: shuffle(cfg.options.slice()),
    answer: x.type,
    note: cfg.note(x)
  }));
}

/* ================================================== أحكام الميم الساكنة */
function learnMeem(): Question[] {
  return MEEM_RULES.map(r => {
    const ex = MEEM_EXAMPLES.filter(e => e.rule === r.id)[0];
    return {
      key: 'meemrule:' + r.id,
      mode: 'learn' as const,
      prompt: 'احفظ الحكم وحروفه',
      display: r.id === 'izhar_shaf' ? '\u0645\u0652' : '\u0645\u0652 ' + r.letters,
      small: true,
      title: r.name,
      speak: r.name,
      facts: [
        { label: 'الحروف', value: r.letters },
        { label: 'التعريف', value: r.desc },
        { label: 'مثال', value: ex ? ex.t : '—' }
      ]
    };
  });
}

function meemPick(n: number): Question[] {
  return sample(MEEM_EXAMPLES, Math.min(n, MEEM_EXAMPLES.length)).map(ex => {
    const R = MEEM_RULES.filter(r => r.id === ex.rule)[0];
    return {
      key: 'mm:' + ex.t,
      mode: 'choice' as const,
      prompt: 'ما حكم الميم الساكنة هنا؟',
      display: ex.t,
      small: true,
      mark: '\u0645',
      speak: ex.t,
      options: shuffle(MEEM_RULES.map(r => ({ id: r.id, text: r.name }))),
      answer: R.id,
      note: R.name + ' — ' + R.desc
    };
  });
}

/** يخلط أمثلة النون والميم ليميّز الطالب بين البابين */
function noonMeemMix(n: number): Question[] {
  const pool = TAJWEED_EXAMPLES.map(e => ({ t: e.t, fam: 'noon' }))
    .concat(MEEM_EXAMPLES.map(e => ({ t: e.t, fam: 'meem' })));
  return sample(pool, Math.min(n, pool.length)).map(x => ({
    key: 'nm:' + x.t,
    mode: 'choice' as const,
    prompt: 'أيُّ بابٍ من أبواب التجويد ينطبق هنا؟',
    display: x.t,
    small: true,
    speak: x.t,
    options: shuffle([
      { id: 'noon', text: 'أحكام النون الساكنة والتنوين' },
      { id: 'meem', text: 'أحكام الميم الساكنة' }
    ]),
    answer: x.fam,
    note: x.fam === 'noon'
      ? 'الساكن هنا نونٌ أو تنوين، فيدخل في باب النون الساكنة.'
      : 'الساكن هنا ميمٌ، فيدخل في باب الميم الساكنة.'
  }));
}

/* ================================================== همزة الوصل والقطع */
function hamzaRule(n: number): Question[] {
  return classify(HAMZA_WORDS, n, {
    prefix: 'hamza',
    prompt: 'هل همزة أول الكلمة همزة وصل أم همزة قطع؟',
    options: [
      { id: 'wasl', text: 'همزة وصل', sub: 'تسقط في الوصل' },
      { id: 'qat',  text: 'همزة قطع', sub: 'تُنطق دائماً' }
    ],
    note: x => x.type === 'wasl'
      ? 'همزة وصل: تُنطق في الابتداء وتسقط إذا سبقها كلام، وتُكتب ألفاً بلا همزة.'
      : 'همزة قطع: تُنطق في الابتداء وفي الوصل، وتُكتب عليها الهمزة (أ إ).'
  });
}

/* ================================================== أنواع المد الفرعي */
function learnMadd(): Question[] {
  return MADD_TYPES.map(t => {
    const ex = MADD_EXAMPLES.filter(e => e.type === t.id)[0];
    return {
      key: 'maddtype:' + t.id,
      mode: 'learn' as const,
      prompt: 'احفظ نوع المد وسببه',
      display: ex ? ex.t : t.name,
      small: true,
      title: t.name,
      speak: t.name,
      facts: [
        { label: 'التعريف', value: t.desc },
        { label: 'أمثلة', value: MADD_EXAMPLES.filter(e => e.type === t.id).map(e => e.t).join('  ·  ') }
      ]
    };
  });
}

function maddType(n: number): Question[] {
  return sample(MADD_EXAMPLES, Math.min(n, MADD_EXAMPLES.length)).map(ex => {
    const T = MADD_TYPES.filter(t => t.id === ex.type)[0];
    return {
      key: 'mt:' + ex.t,
      mode: 'choice' as const,
      prompt: 'ما نوع المد في هذا المثال؟',
      display: ex.t,
      small: true,
      speak: ex.t,
      options: shuffle(MADD_TYPES.map(t => ({ id: t.id, text: t.name }))),
      answer: T.id,
      note: T.name + ': ' + T.desc
    };
  });
}

/* ================================================== الراء ولام الجلالة */
function learnRa(): Question[] {
  return [
    { id: 'heavy', name: 'الراء المُفخَّمة', words: RA_WORDS.filter(w => w.type === 'heavy') },
    { id: 'light', name: 'الراء المُرقَّقة', words: RA_WORDS.filter(w => w.type === 'light') }
  ].map(g => ({
    key: 'rarule:' + g.id,
    mode: 'learn' as const,
    prompt: 'احفظ متى تُفخَّم الراء ومتى تُرقَّق',
    display: 'ر',
    title: g.name,
    speak: g.name,
    facts: [
      { label: 'القاعدة', value: RA_RULES[g.id] },
      { label: 'أمثلة', value: g.words.slice(0, 5).map(w => w.w).join('  ·  ') }
    ]
  }));
}

function raRule(n: number): Question[] {
  return classify(RA_WORDS, n, {
    prefix: 'ra',
    mark: () => 'ر',
    prompt: 'هل الراء هنا مفخَّمة أم مرقَّقة؟',
    options: [
      { id: 'heavy', text: 'مُفخَّمة' },
      { id: 'light', text: 'مُرقَّقة' }
    ],
    note: x => RA_RULES[x.type]
  });
}

function lamJalala(n: number): Question[] {
  return classify(LAM_JALALA, n, {
    prefix: 'lj',
    small: true,
    prompt: 'هل لام لفظ الجلالة هنا مفخَّمة أم مرقَّقة؟',
    options: [
      { id: 'heavy', text: 'مُفخَّمة' },
      { id: 'light', text: 'مُرقَّقة' }
    ],
    note: x => (x.type === 'heavy'
      ? 'تُفخَّم لام لفظ الجلالة إذا سبقتها فتحة أو ضمة. '
      : 'تُرقَّق لام لفظ الجلالة إذا سبقتها كسرة. ') + x.before
  });
}

/* ================================================== التاء والألف */
function taRule(n: number): Question[] {
  return classify(TA_WORDS, n, {
    prefix: 'ta',
    prompt: 'أيُّ تاءٍ في آخر هذه الكلمة؟',
    options: [
      { id: 'marbuta', text: 'تاء مربوطة', sub: 'ة' },
      { id: 'maftuha', text: 'تاء مفتوحة', sub: 'ت' }
    ],
    note: x => x.type === 'marbuta'
      ? 'التاء المربوطة تُنطق هاءً ساكنة عند الوقف عليها.'
      : 'التاء المفتوحة تبقى تاءً في الوصل والوقف.'
  });
}

function alifRule(n: number): Question[] {
  return classify(ALIF_WORDS, n, {
    prefix: 'alifr',
    prompt: 'كيف تُكتب الألف في آخر هذه الكلمة؟',
    options: [
      { id: 'maqsura', text: 'ألف مقصورة', sub: 'ى' },
      { id: 'mamduda', text: 'ألف قائمة', sub: 'ا' }
    ],
    note: x => x.type === 'maqsura'
      ? 'تُكتب ألفاً مقصورة (ى) وتُنطق ألفاً ممدودة.'
      : 'تُكتب ألفاً قائمة (ا)، وأصلها غالباً واو.'
  });
}

/* ==================================================================
   أنشطة مقتبسة من القاعدة النورانية
   ================================================================== */

/* ------------- ١. التهجّي: «باء فتحة بَ» ------------------------- */
function spellDrill(n: number): Question[] {
  const pool = LETTERS.filter(L => L.id !== 'alif');
  const hs = HARAKAT.slice(0, 6);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const L = pick(pool), H = pick(hs);
    const right = L.name + ' ' + HARAKAH_SPELL[H.id];
    const wrong: string[] = [];
    let guard = 0;
    while (wrong.length < 3 && guard++ < 80) {
      const t = (Math.random() < 0.5 ? pick(pool).name : L.name) + ' ' +
                HARAKAH_SPELL[pick(hs).id];
      if (t !== right && wrong.indexOf(t) === -1) wrong.push(t);
    }
    out.push({
      key: 'spell:' + L.id + ':' + H.id,
      mode: 'choice' as const,
      prompt: 'تهجَّ هذا الحرف كما تنطقه',
      display: L.c + H.mark,
      speak: right,
      options: shuffle([right, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t })),
      answerText: right,
      note: 'نقول: ' + right + ' ⇐ ' + L.c + H.mark
    });
  }
  return out.map(q => {
    q.answer = (q.options ?? []).filter(o => o.text === q.answerText)[0].id;
    delete q.answerText;
    return q;
  });
}

/* ------------- ٢. الحروف المركّبة: فُكّ التركيب إلى حروفه ---------- */
function compositeDrill(n: number): Question[] {
  return sample(COMPOSITES, Math.min(n, COMPOSITES.length)).map(g => {
    const joined = g.map(id => byId[id].c).join('');
    const right = g.map(id => byId[id].name).join(' ');
    const wrong: string[] = [];
    let guard = 0;
    while (wrong.length < 3 && guard++ < 80) {
      const alt: string[] | undefined = sample(COMPOSITES.filter(x => x.length === g.length), 1)[0];
      const t = alt ? alt.map(id => byId[id].name).join(' ')
                    : sample(LETTERS, g.length).map(L => L.name).join(' ');
      if (t !== right && wrong.indexOf(t) === -1) wrong.push(t);
    }
    return {
      key: 'comp:' + g.join('-'),
      mode: 'choice' as const,
      prompt: 'اقرأ هذا التركيب بالهجاء: ما حروفه؟',
      display: joined,
      speak: right,
      options: shuffle([right, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t })),
      answerText: right,
      note: joined + ' = ' + right
    };
  }).map((q: Question) => {
    q.answer = (q.options ?? []).filter(o => o.text === q.answerText)[0].id;
    delete q.answerText;
    return q;
  });
}

/* ------------- ٣. الحروف المقطّعة: أسماؤها ثم مدودها -------------- */
function learnMuqattaat(): Question[] {
  return MUQATTAAT.map(m => ({
    key: 'muq:' + m.t,
    mode: 'learn' as const,
    prompt: 'هذه فاتحة سورة — اقرأها بأسماء حروفها',
    display: m.t,
    title: 'سورة ' + m.surah,
    speak: m.letters.map(c => MUQATTAA_LETTERS[c].name).join(' '),
    facts: [
      { label: 'تُقرأ', value: m.letters.map(c => MUQATTAA_LETTERS[c].name).join(' ') },
      { label: 'المدود', value: m.letters.map(c => {
          const L = MUQATTAA_LETTERS[c];
          return L.name + ': ' + (L.madd === 0 ? 'بلا مدّ'
            : L.madd === 4 ? 'أربع أو ست حركات' : L.madd + ' حركات');
        }).join('  ·  ') }
    ]
  }));
}

function muqattaaRead(n: number): Question[] {
  return sample(MUQATTAAT, Math.min(n, MUQATTAAT.length)).map(m => {
    const right = m.letters.map(c => MUQATTAA_LETTERS[c].name).join(' ');
    const wrong: string[] = [];
    let guard = 0;
    while (wrong.length < 3 && guard++ < 80) {
      const alt = pick(MUQATTAAT);
      const t = alt.letters.map(c => MUQATTAA_LETTERS[c].name).join(' ');
      if (t !== right && wrong.indexOf(t) === -1) wrong.push(t);
    }
    return {
      key: 'muqr:' + m.t,
      mode: 'choice' as const,
      prompt: 'كيف تُقرأ فاتحة سورة ' + m.surah + '؟',
      display: m.t,
      speak: right,
      options: shuffle([right, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t })),
      answerText: right,
      note: 'الحروف المقطّعة تُقرأ بأسماء حروفها لا بأصواتها: ' + right
    };
  }).map((q: Question) => {
    q.answer = (q.options ?? []).filter(o => o.text === q.answerText)[0].id;
    delete q.answerText;
    return q;
  });
}

function muqattaaMadd(n: number): Question[] {
  const letters = Object.keys(MUQATTAA_LETTERS);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const c = pick(letters);
    const L = MUQATTAA_LETTERS[c];
    out.push({
      key: 'muqm:' + c,
      mode: 'choice' as const,
      prompt: 'كم يُمدّ حرف «' + L.name + '» في الحروف المقطّعة؟',
      display: c,
      speak: L.name,
      options: shuffle([
        { id: '0', text: 'لا يُمدّ' },
        { id: '2', text: 'حركتان', sub: 'حَيٌّ طَهُرَ' },
        { id: '6', text: 'ستّ حركات', sub: 'سَنَقُصُّ لَكُمْ' },
        { id: '4', text: 'أربع أو ستّ' }
      ]),
      answer: String(L.madd),
      note: L.madd === 0 ? 'الألف وحدها لا تُمدّ، تُنطق باسمها.'
        : L.madd === 4 ? 'العين تجوز فيها أربع حركات وست.'
        : L.madd === 2 ? 'حروف «حَيٌّ طَهُرَ» تُمدّ حركتين مدّاً طبيعياً.'
        : 'حروف «سَنَقُصُّ لَكُمْ» تُمدّ ستّ حركات مدّاً لازماً حرفياً.'
    });
  }
  return out;
}

/* الحرف الذي تختلف فيه كلمتان من زوج صغرى، كما هو مرسوم في الثانية */
function diffChar(a: string, b: string): string | null {
  const x = Array.from(stripTashkeel(a)), y = Array.from(stripTashkeel(b));
  for (let i = 0; i < y.length; i++) if (x[i] !== y[i]) return y[i];
  return null;
}

/* ------------- ٤. المتشابهة صوتاً: الأزواج الصغرى ---------------- */
function soundSimilar(n: number): Question[] {
  const all = SOUND_GROUPS.reduce<{ g: any; pr: any }[]>((a, g) =>
    a.concat(g.pairs.map((pr: any) => ({ g, pr }))), []);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const { g, pr } = pick(all);
    if (i % 2 === 0) {
      const target = Math.random() < 0.5 ? pr.da : pr.db;
      const word = target === pr.da ? pr.a : pr.b;
      out.push({
        key: 'snd:' + g.id + ':' + pr.a,
        mode: 'choice' as const,
        prompt: 'أيُّ الكلمتين فيها حرف ' + byId[target].name + '؟',
        options: shuffle([
          { id: 'a', text: pr.a }, { id: 'b', text: pr.b }
        ].map(o => ({ ...o, big: true }))),
        answer: word === pr.a ? 'a' : 'b',
        note: '«' + pr.a + '» بـ' + byId[pr.da].name + '، و«' + pr.b + '» بـ' + byId[pr.db].name +
              '. ' + g.label + ' تتشابه صوتاً وتختلف مخرجاً.'
      });
    } else {
      const others = distractors(LETTERS, byId[pr.da], 2, x => x.id)
        .filter(L => L.id !== pr.db);
      out.push({
        key: 'snddiff:' + g.id + ':' + pr.a,
        mode: 'choice' as const,
        prompt: 'بأيّ حرفٍ تُكتب «' + pr.b + '»؟',
        display: pr.b,
        mark: diffChar(pr.a, pr.b),
        small: true,
        speak: pr.b,
        options: shuffle([byId[pr.db], byId[pr.da], ...others]
          .map(L => ({ id: L.id, text: L.c, big: true }))),
        answer: pr.db,
        note: '«' + pr.b + '» بـ' + byId[pr.db].name + '، وأختها «' + pr.a + '» بـ' +
              byId[pr.da].name + '. ' + g.label + ' تتشابه صوتاً وتختلف مخرجاً.'
      });
    }
  }
  return out;
}

/* ------------- ٥. الضاد والظاء ---------------------------------- */
function dadZa(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const pr = pick(DAD_ZA_PAIRS);
    const isDad = Math.random() < 0.5;
    const w = isDad ? pr.dad : pr.za;
    out.push({
      key: 'dz:' + w,
      mode: 'choice' as const,
      prompt: 'أبالضاد هذه الكلمة أم بالظاء؟',
      display: w,
      mark: isDad ? 'ض' : 'ظ',
      speak: w,
      options: shuffle([
        { id: 'dad', text: 'بالضّاد', sub: 'ض' },
        { id: 'za',  text: 'بالظّاء', sub: 'ظ' }
      ]),
      answer: isDad ? 'dad' : 'za',
      note: 'الضاد من حافة اللسان مع الأضراس، والظاء من طرف اللسان مع أطراف الثنايا. ' +
            '«' + pr.dad + '» بالضاد و«' + pr.za + '» بالظاء.'
    });
  }
  return out;
}

/* ------------- ٦. الوقف ----------------------------------------- */
function waqfRule(n: number): Question[] {
  return sample(WAQF_WORDS, Math.min(n, WAQF_WORDS.length)).map(x => {
    const others = WAQF_WORDS.filter(y => y.rule !== x.rule && y.stop !== x.stop);
    const wrong = sample(others, 3).map(y => y.stop);
    return {
      key: 'waqf:' + x.w,
      mode: 'choice' as const,
      prompt: 'كيف تقف على هذه الكلمة؟',
      display: x.w,
      speak: x.stop,
      options: shuffle([x.stop, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t, big: true })),
      answerText: x.stop,
      note: (WAQF_RULES.filter(r => r.id === x.rule)[0] || {}).desc || ''
    };
  }).map((q: Question) => {
    q.answer = (q.options ?? []).filter(o => o.text === q.answerText)[0].id;
    delete q.answerText;
    return q;
  });
}

/* ------------- ٧. تفكيك الكلمة إلى حروفها ------------------------ */
function decomposeWord(n: number): Question[] {
  const bank = WORDS.fatha.concat(WORDS.kasra).filter(w => stripTashkeel(w).length === 3);
  return sample(bank, Math.min(n, bank.length)).map(w => {
    const chars = Array.from(stripTashkeel(w));
    const right = chars.map(c => (byChar[c] || { name: c }).name).join(' ');
    const wrong: string[] = [];
    let guard = 0;
    while (wrong.length < 3 && guard++ < 80) {
      const alt = sample(bank, 1)[0];
      const t = Array.from(stripTashkeel(alt)).map(c => (byChar[c] || { name: c }).name).join(' ');
      if (t !== right && wrong.indexOf(t) === -1) wrong.push(t);
    }
    return {
      key: 'dec:' + w,
      mode: 'choice' as const,
      prompt: 'فُكّ الكلمة إلى حروفها بالهجاء',
      display: w,
      speak: right,
      options: shuffle([right, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t })),
      answerText: right,
      note: w + ' = ' + right
    };
  }).map((q: Question) => {
    q.answer = (q.options ?? []).filter(o => o.text === q.answerText)[0].id;
    delete q.answerText;
    return q;
  });
}

/* ==================================================================
   عائلات الكلمات — تدرّج القراءة
   ================================================================== */

const famsOf = (tier?: number): WordFamily[] => WORD_FAMILIES.filter(f => !tier || f.tier === tier);

/* ------------- تعرّف على العائلة كاملةً ------------------------- */
function familyLearn(args: any): Question[] {
  return sample(famsOf(args.tier), args.count || 6).map(f => {
    const ws = familyWords(f);
    return {
      key: 'fam:' + f.id,
      mode: 'learn' as const,
      prompt: 'اقرأ العائلة كلها — النهاية ثابتة والأول يتغيّر',
      display: ws.slice(0, 6).map(x => x.w).join('   '),
      small: true,
      title: 'عائلة ' + f.label,
      speak: ws.slice(0, 5).map(x => x.w).join('، '),
      facts: [
        { label: 'النهاية', value: f.label },
        { label: 'الكلمات', value: ws.map(x => x.w).join('  ·  ') },
        { label: 'العدد', value: ws.length + ' كلمة' }
      ]
    };
  });
}

/* ------------- اسمع واختر من العائلة (أزواج صغرى حقيقية) -------- */
function familyPick(args: any, n: number): Question[] {
  const fams = famsOf(args.tier).filter(f => f.onsets.length >= 4);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const f = pick(fams);
    const ws = shuffle(familyWords(f)).slice(0, 4);
    const right = pick(ws);
    out.push({
      key: 'famw:' + right.w,
      mode: 'choice' as const,
      prompt: 'استمع ثم اختر الكلمة — كلها من عائلة ' + f.label,
      speak: right.w,
      audioOnly: true,
      options: shuffle(ws).map(x => ({ id: x.w, text: x.w, big: true })),
      answer: right.w,
      note: 'كلمات العائلة لا تختلف إلا في حرفها الأول، فالتركيز عليه.'
    });
  }
  return out;
}

/* ------------- الدخيلة على العائلة ------------------------------ */
function familyOdd(args: any, n: number): Question[] {
  const fams = famsOf(args.tier).filter(f => f.onsets.length >= 3);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const f = pick(fams);
    const other = pick(WORD_FAMILIES.filter(x => x.id !== f.id && x.tier === f.tier));
    const mine = shuffle(familyWords(f)).slice(0, 3);
    const alien = pick(familyWords(other));
    out.push({
      key: 'famodd:' + f.id,
      mode: 'choice' as const,
      prompt: 'أيُّ كلمةٍ ليست من عائلة ' + f.label + '؟',
      options: shuffle([...mine, alien].map(x => ({ id: x.w, text: x.w, big: true }))),
      answer: alien.w,
      note: '«' + alien.w + '» من عائلة ' + other.label + '، وبقيّتها من ' + f.label + '.'
    });
  }
  return out;
}

/* ------------- قراءة كلمات العائلات بالتدرّج ------------------- */
function familyRead(args: any, n: number): Question[] {
  const pool = allFamilyWords().filter(x => !args.tier || x.tier === args.tier);
  return sample(pool, Math.min(n, pool.length)).map(x => ({
    key: 'word:' + x.w,
    mode: 'read' as const,
    prompt: 'اقرأ الكلمة بصوت واضح، ثم استمع وقارن',
    display: x.w,
    speak: x.w,
    note: 'من عائلة ' + (WORD_FAMILIES.filter(f => f.id === x.family)[0] || {}).label
  }));
}

/* ------------- المقاطع المغلقة القصيرة ------------------------- */
function cvcRead(n: number): Question[] {
  return sample(CVC_WORDS, Math.min(n, CVC_WORDS.length)).map(x => ({
    key: 'cvc:' + x.w,
    mode: 'read' as const,
    prompt: 'اقرأ الكلمة: حرفٌ متحرك ثم حرفٌ ساكن',
    display: x.w,
    speak: x.w,
    note: x.kind === 'أمر' ? 'فعل أمر من ثلاثة أحرف.' : 'حرفٌ من حروف المعاني، يكثر في القرآن.'
  }));
}

function cvcPick(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const right = pick(CVC_WORDS);
    const wrong = distractors(CVC_WORDS, right, 3, x => x.w);
    out.push({
      key: 'cvcp:' + right.w,
      mode: 'choice' as const,
      prompt: 'استمع ثم اختر الكلمة',
      speak: right.w,
      audioOnly: true,
      options: shuffle([right, ...wrong]).map(x => ({ id: x.w, text: x.w, big: true })),
      answer: right.w,
      note: 'الحرف الأول متحرك والثاني ساكن، فيُنطقان مقطعاً واحداً.'
    });
  }
  return out;
}

/* ==================================================================
   ما يلزم لقراءة المصحف
   ================================================================== */

/* ------------- الألف الخنجرية: تُنطق ولا تُرسم ------------------ */
function daggerAlif(n: number): Question[] {
  return sample(DAGGER_WORDS, Math.min(n, DAGGER_WORDS.length)).map(x => {
    const wrong = distractors(DAGGER_WORDS, x, 3, y => y.w).map(y => y.read);
    return {
      key: 'dag:' + x.w,
      mode: 'choice' as const,
      prompt: 'كيف تُنطق هذه الكلمة؟',
      display: x.w,
      mark: '\u0670',
      speak: x.read,
      options: shuffle([x.read, ...wrong]).map((t, k) => ({ id: 'o' + k, text: t, big: true })),
      answerText: x.read,
      note: 'الألف الخنجرية (\u0670) ألفٌ صغيرة تُنطق مدّاً ولا تُرسم ألفاً.'
    };
  }).map((q: Question) => {
    q.answer = (q.options ?? []).filter(o => o.text === q.answerText)[0].id;
    delete q.answerText;
    return q;
  });
}

/* ------------- حروف تُرسم ولا تُنطق ----------------------------- */
function silentLetters(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const x = pick(SILENT_WORDS);
    if (i % 2 === 0) {
      const others: Letter[] = distractors(LETTERS.filter(L => L.c !== x.silent), byId.ba, 3, y => y.id);
      out.push({
        key: 'sil:' + x.w,
        mode: 'choice' as const,
        prompt: 'أيُّ حرفٍ في هذه الكلمة يُكتب ولا يُنطق؟',
        display: x.w,
        speak: x.w,
        options: shuffle([{ id: 'ok', text: x.silent, big: true },
          ...others.map((L, k) => ({ id: 'x' + k, text: L.c, big: true }))]),
        answer: 'ok',
        note: x.why + '.'
      });
    } else {
      out.push({
        key: 'silyn:' + x.w,
        mode: 'choice' as const,
        prompt: 'هل في هذه الكلمة حرفٌ يُكتب ولا يُنطق؟',
        display: x.w,
        speak: x.w,
        options: shuffle([{ id: 'y', text: 'نعم' }, { id: 'n', text: 'لا' }]),
        answer: 'y',
        note: x.why + '.'
      });
    }
  }
  return out;
}

/* ------------- الغنّة: النون والميم المشدّدتان ------------------ */
function ghunna(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      const x = pick(GHUNNA_WORDS);
      out.push({
        key: 'ghn:' + x.w,
        mode: 'choice' as const,
        prompt: 'ما الحرف المشدَّد الذي تجب فيه الغنّة هنا؟',
        display: x.w,
        mark: x.letter,
        speak: x.w,
        options: shuffle([
          { id: 'ن', text: 'ن' }, { id: 'م', text: 'م' },
          { id: 'ل', text: 'ل' }, { id: 'ر', text: 'ر' }
        ].map(o => ({ ...o, big: true }))),
        answer: x.letter,
        note: 'النون والميم المشدَّدتان تجب فيهما غنّة مقدار حركتين، وتُسمّيان «أغنّ ما في القرآن».'
      });
    } else {
      const x = pick(GHUNNA_WORDS);
      out.push({
        key: 'ghnq:' + x.w,
        mode: 'choice' as const,
        prompt: 'كم مقدار الغنّة في الحرف المشدَّد؟',
        display: x.w,
        mark: x.letter,
        speak: x.w,
        options: shuffle([
          { id: 'two', text: 'حركتان' }, { id: 'one', text: 'حركة واحدة' },
          { id: 'four', text: 'أربع حركات' }, { id: 'none', text: 'لا غنّة' }
        ]),
        answer: 'two',
        note: 'الغنّة في النون والميم المشدَّدتين حركتان دائماً.'
      });
    }
  }
  return out;
}

/* ------------- الشدّة مع المدّ والشدّتان في كلمة ---------------- */
function shaddaMadd(n: number): Question[] {
  return sample(SHADDA_MADD_WORDS, Math.min(n, SHADDA_MADD_WORDS.length)).map(x => ({
    key: 'shm:' + x.w,
    mode: 'read' as const,
    prompt: 'اقرأ الكلمة متأنّياً — شدّة ومدّ معاً',
    display: x.w,
    small: true,
    speak: x.w,
    note: x.note + '. أعطِ كل شدّةٍ حقّها وكل مدٍّ مقداره.'
  }));
}

/* ------------- علامات الوقف في المصحف -------------------------- */
function learnWaqfMarks(): Question[] {
  return WAQF_MARKS.map(m => ({
    key: 'wm:' + m.m,
    mode: 'learn' as const,
    prompt: 'احفظ العلامة وحكمها',
    display: m.m,
    title: m.name,
    speak: m.name,
    facts: [{ label: 'الحكم', value: m.rule }]
  }));
}

function waqfMarkPick(n: number): Question[] {
  return sample(WAQF_MARKS, Math.min(n, WAQF_MARKS.length)).map(m => ({
    key: 'wmp:' + m.m,
    mode: 'choice' as const,
    prompt: 'ما حكم هذه العلامة في المصحف؟',
    display: m.m,
    speak: m.name,
    options: shuffle([m, ...distractors(WAQF_MARKS, m, 3, x => x.m)])
      .map(x => ({ id: x.m, text: x.name })),
    answer: m.m,
    note: m.name + ': ' + m.rule
  }));
}

/* ------------- مخارج الحروف الخمسة ------------------------------ */
function learnMakharij(): Question[] {
  return MAKHARIJ_GROUPS.map(g => ({
    key: 'mkh:' + g.id,
    mode: 'learn' as const,
    prompt: 'تعرَّف على المخرج وحروفه',
    display: g.letters,
    small: true,
    title: g.name,
    speak: g.name,
    facts: [
      { label: 'الحروف', value: g.letters },
      { label: 'الوصف', value: g.desc }
    ]
  }));
}

function makhrajPick(n: number): Question[] {
  const pool = LETTERS.filter(L => L.id !== 'alif');
  return sample(pool, n).map(L => {
    const right = MAKHARIJ_GROUPS.filter(g =>
      g.id !== 'khay' && g.letters.split(' ').indexOf(L.c) > -1)[0]
      || MAKHARIJ_GROUPS[2];
    return {
      key: 'mkhp:' + L.id,
      mode: 'choice' as const,
      prompt: 'من أيّ موضعٍ يخرج حرف ' + L.name + '؟',
      display: L.c,
      speak: L.name,
      options: shuffle(MAKHARIJ_GROUPS.filter(g => g.id !== 'khay')
        .map(g => ({ id: g.id, text: g.name }))),
      answer: right.id,
      note: L.name + ' من ' + right.name + '، وتفصيله: ' + L.makhraj + '.'
    };
  });
}

/* ------------- التلاوة: قراءة قصار السور ----------------------- */
function recite(args: any, n: number): Question[] {
  const surah = args.surah
    ? SURAHS.filter(x => x.id === args.surah)[0]
    : pick(SURAHS);
  const ayat = surah.ayat.slice(0, n || surah.ayat.length);
  return ayat.map((a, i) => ({
    key: 'ayah:' + surah.id + ':' + i,
    mode: 'read' as const,
    prompt: 'اقرأ الآية مطبّقاً كل ما تعلّمت',
    display: a,
    small: true,
    title: 'سورة ' + surah.name,
    speak: a,
    note: 'راعِ المدود ومقاديرها، وأحكام النون والميم، والغنّة، والوقف.'
  }));
}

function reciteMixed(n: number): Question[] {
  const all = SURAHS.reduce<{ t: string; s: any; i: number }[]>((a, s) =>
    a.concat(s.ayat.map((t: string, i: number) => ({ t, s, i }))), []);
  return sample(all, Math.min(n, all.length)).map(x => ({
    key: 'ayah:' + x.s.id + ':' + x.i,
    mode: 'read' as const,
    prompt: 'اقرأ الآية مطبّقاً كل ما تعلّمت',
    display: x.t,
    small: true,
    title: 'سورة ' + x.s.name,
    speak: x.t,
    note: 'من سورة ' + x.s.name + '.'
  }));
}

/* ------------- امتحان التخرّج الشامل --------------------------- */
function finalExam(): Question[] {
  const parts = [
    () => letterByAudio(2), () => soundSimilar(2), () => dadZa(1),
    () => muqattaaRead(1), () => muqattaaMadd(1),
    () => harakahDrill({ harakah: 'kasra' }, 1), () => spellDrill(1),
    () => syllableDrill({ set: 'mufakham' }, 1), () => qalqala(1),
    () => shaddaContrast(1), () => maddContrast(1), () => maddType(2),
    () => familyOdd({}, 1), () => lamRule(1), () => hamzaRule(1),
    () => waqfRule(1), () => waqfMarkPick(1),
    () => rulePick(2), () => meemPick(2), () => ghunna(1),
    () => raRule(1), () => lamJalala(1), () => daggerAlif(1), () => silentLetters(1),
    () => makhrajPick(1)
  ];
  return shuffle(parts.reduce<Question[]>((a, g) => a.concat(g()), [])).slice(0, 30);
}

/* ================================================== الاختبارات */
function examFor(worldId: string, n: number): Question[] {
  const mixes = {
    w1: [() => letterByAudio(3), () => similarLetters(3), () => letterForms(3),
         () => letterPosition(2), () => soundSimilar(2), () => dadZa(2)],
    w1b: [() => compositeDrill(4), () => muqattaaRead(4), () => muqattaaMadd(4)],
    w2: [() => harakahDrill({ harakah: 'fatha' }, 2), () => harakahDrill({ harakah: 'damma' }, 2),
         () => harakahDrill({ harakah: 'kasra' }, 2), () => harakahHunt({}, 2), () => spellDrill(4)],
    w3: [() => harakahDrill({ harakah: 'fathatan' }, 2), () => harakahDrill({ harakah: 'dammatan' }, 2),
         () => harakahDrill({ harakah: 'kasratan' }, 2), () => readWords({ bank: 'tanween' }, 3)],
    w4: [() => syllableDrill({ set: 'raqiq' }, 3), () => syllableDrill({ set: 'mufakham' }, 3), () => qalqala(4)],
    w5: [() => shaddaDrill(4), () => shaddaContrast(5)],
    w6: [() => maddContrast(4), () => readWords({ bank: 'madd_ya' }, 2), () => maddType(6)],
    w7: [() => buildWord(2), () => lamRule(2), () => hamzaRule(2), () => taRule(2),
         () => alifRule(2), () => decomposeWord(2), () => waqfRule(3)],
    w8: [() => rulePick(5), () => ruleLetters(5)],
    w9: [() => meemPick(6), () => noonMeemMix(6)],
    w10: [() => raRule(6), () => lamJalala(4)],
    wf: [() => familyPick({}, 4), () => familyOdd({}, 4), () => familyRead({}, 4)],
    wq: [() => waqfMarkPick(3), () => daggerAlif(2), () => silentLetters(2),
         () => ghunna(2), () => reciteMixed(3)]
  };
  const gens = (mixes as Record<string, (() => Question[])[]>)[worldId] || mixes.w1;
  return shuffle(gens.reduce<Question[]>((a, g) => a.concat(g()), [])).slice(0, n);
}

/* ================================================== الموزّع */
export function buildQuestions(station: Pick<Station, 'kind' | 'args'>, worldId: string, count?: number): Question[] {
  const n = count || 10;
  const a = station.args || {};
  switch (station.kind) {
    case 'learn_letters':   return learnLetters(a as unknown as { from: number; to: number });
    case 'letter_by_audio': return letterByAudio(n);
    case 'similar_letters': return similarLetters(n);
    case 'order_letters':   return orderLetters(Math.max(4, Math.round(n / 2)));
    case 'letter_forms':    return letterForms(n);
    case 'letter_position': return letterPosition(n);
    case 'harakah_drill':   return harakahDrill(a, n);
    case 'harakah_hunt':    return harakahHunt(a, n);
    case 'syllable_drill':  return syllableDrill(a, n);
    case 'qalqala':         return qalqala(n);
    case 'shadda_drill':    return shaddaDrill(n);
    case 'shadda_contrast': return shaddaContrast(n);
    case 'read_words':      return readWords(a, n);
    case 'read_sentence':   return readSentence(n);
    case 'build_word':      return buildWord(Math.max(4, Math.round(n / 2)));
    case 'madd_contrast':   return maddContrast(n);
    case 'lam_rule':        return lamRule(n);
    case 'learn_rules':     return learnRules();
    case 'rule_pick':       return rulePick(n);
    case 'rule_letters':    return ruleLetters(n);
    case 'learn_meem':      return learnMeem();
    case 'meem_pick':       return meemPick(n);
    case 'noon_meem_mix':   return noonMeemMix(n);
    case 'hamza_rule':      return hamzaRule(n);
    case 'learn_madd':      return learnMadd();
    case 'madd_type':       return maddType(n);
    case 'learn_ra':        return learnRa();
    case 'ra_rule':         return raRule(n);
    case 'lam_jalala':      return lamJalala(n);
    case 'ta_rule':         return taRule(n);
    case 'alif_rule':       return alifRule(n);
    case 'spell_drill':     return spellDrill(n);
    case 'composite':       return compositeDrill(n);
    case 'learn_muqattaat': return learnMuqattaat();
    case 'muqattaa_read':   return muqattaaRead(n);
    case 'muqattaa_madd':   return muqattaaMadd(n);
    case 'sound_similar':   return soundSimilar(n);
    case 'dad_za':          return dadZa(n);
    case 'waqf_rule':       return waqfRule(n);
    case 'decompose':       return decomposeWord(n);
    case 'family_learn':    return familyLearn(a);
    case 'family_pick':     return familyPick(a, n);
    case 'family_odd':      return familyOdd(a, n);
    case 'family_read':     return familyRead(a, n);
    case 'cvc_read':        return cvcRead(n);
    case 'cvc_pick':        return cvcPick(n);
    case 'dagger_alif':     return daggerAlif(n);
    case 'silent_letters':  return silentLetters(n);
    case 'ghunna':          return ghunna(n);
    case 'shadda_madd':     return shaddaMadd(n);
    case 'learn_waqf_marks':return learnWaqfMarks();
    case 'waqf_mark_pick':  return waqfMarkPick(n);
    case 'learn_makharij':  return learnMakharij();
    case 'makhraj_pick':    return makhrajPick(n);
    case 'recite':          return recite(a, n);
    case 'recite_mixed':    return reciteMixed(n);
    case 'final_exam':      return finalExam();
    case 'exam':            return examFor(worldId, 12);
    default:                return letterByAudio(n);
  }
}

/* أسئلة مراجعة مبنية على مفاتيح صندوق المراجعة */
export function reviewQuestions(keys: string[], count?: number): Question[] {
  const out: Question[] = [];
  const seen: Record<string, number> = {};
  for (const k of keys) {
    const parts = k.split(':');
    const type = parts[0], id = parts[1];
    let q: Question | null = null;

    if (type === 'letter' && byId[id]) {
      const L = byId[id];
      q = {
        key: k, mode: 'choice' as const, audioOnly: true, speak: L.name,
        prompt: 'استمع إلى اسم الحرف ثم اختر رسمه',
        options: shuffle([L, ...distractors(LETTERS, L, 3, x => x.id)])
          .map(o => ({ id: o.id, text: o.c, big: true })),
        answer: L.id,
        note: 'حرف ' + L.name + '، مخرجه من ' + L.makhraj + '.'
      };
    } else if (type === 'similar' && byId[id]) {
      const g = SIMILAR_GROUPS.filter(x => x.ids.indexOf(id) > -1)[0];
      const L = byId[id];
      q = {
        key: k, mode: 'choice' as const, speak: L.name,
        prompt: 'أيُّ هذه هو حرف ' + L.name + '؟',
        options: shuffle(g.ids.map(x => ({ id: x, text: byId[x].c, big: true }))),
        answer: id, note: g.label + ' تتشابه في الرسم.'
      };
    } else if (type === 'har') {
      q = harakahDrill({ harakah: parts[2] || 'fatha' }, 1)[0]; q.key = k;
    } else if (type === 'pos') {
      q = letterPosition(1)[0];
    } else if (type === 'word' || type === 'sent') {
      const w = k.slice(type.length + 1);
      q = { key: k, mode: 'read' as const, prompt: 'راجع قراءة هذا', display: w, speak: w, small: type === 'sent' };
    } else if (type === 'tj') {
      q = rulePick(1)[0];
    } else if (type === 'lam') {
      q = lamRule(1)[0];
    } else if (type === 'shad' || type === 'shcon') {
      q = shaddaContrast(1)[0];
    } else if (type === 'madd') {
      q = maddContrast(1)[0];
    } else if (type === 'mt') {
      q = maddType(1)[0];
    } else if (type === 'mm' || type === 'nm') {
      q = meemPick(1)[0];
    } else if (type === 'ra') {
      q = raRule(1)[0];
    } else if (type === 'lj') {
      q = lamJalala(1)[0];
    } else if (type === 'hamza') {
      q = hamzaRule(1)[0];
    } else if (type === 'ta') {
      q = taRule(1)[0];
    } else if (type === 'alifr') {
      q = alifRule(1)[0];
    } else if (type === 'spell') {
      q = spellDrill(1)[0];
    } else if (type === 'comp') {
      q = compositeDrill(1)[0];
    } else if (type === 'muq' || type === 'muqr') {
      q = muqattaaRead(1)[0];
    } else if (type === 'muqm') {
      q = muqattaaMadd(1)[0];
    } else if (type === 'snd' || type === 'snddiff') {
      q = soundSimilar(1)[0];
    } else if (type === 'dz') {
      q = dadZa(1)[0];
    } else if (type === 'waqf') {
      q = waqfRule(1)[0];
    } else if (type === 'dec') {
      q = decomposeWord(1)[0];
    } else if (type === 'famw') {
      q = familyPick({}, 1)[0];
    } else if (type === 'famodd' || type === 'fam') {
      q = familyOdd({}, 1)[0];
    } else if (type === 'cvc' || type === 'cvcp') {
      q = cvcPick(1)[0];
    } else if (type === 'dag') {
      q = daggerAlif(1)[0];
    } else if (type === 'sil' || type === 'silyn') {
      q = silentLetters(1)[0];
    } else if (type === 'ghn' || type === 'ghnq') {
      q = ghunna(1)[0];
    } else if (type === 'wm' || type === 'wmp') {
      q = waqfMarkPick(1)[0];
    } else if (type === 'mkh' || type === 'mkhp') {
      q = makhrajPick(1)[0];
    } else if (type === 'ayah') {
      const t = k.split(':'); const sr = SURAHS.filter(x => x.id === t[1])[0];
      if (sr) q = { key: k, mode: 'read' as const, prompt: 'راجع تلاوة الآية',
                    display: sr.ayat[+t[2]], small: true, speak: sr.ayat[+t[2]],
                    title: 'سورة ' + sr.name };
    } else if (type === 'qal' || type === 'qalYN') {
      q = qalqala(1)[0];
    } else {
      q = letterByAudio(1)[0];
    }

    if (q && !seen[q.key]) { seen[q.key] = 1; out.push(q); }
    if (out.length >= (count || 12)) break;
  }
  return out;
}
