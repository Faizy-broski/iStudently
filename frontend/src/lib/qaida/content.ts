/* ==========================================================================
   قاعدة الجهابذة — بيانات المحتوى التعليمي
   وحدة خالصة (pure): لا DOM ولا React ولا متصفح. تعمل على الخادم والعميل معاً.
   المصدر: «معلم القراءة العربية مع القاعدة البغدادية» + أفكار القاعدة النورانية.
   ========================================================================== */

export interface Letter {
  id: string; c: string; name: string; makhraj: string;
  q?: boolean; tf?: boolean; sun?: boolean; halq?: boolean;
  joinBefore?: boolean; joinAfter?: boolean;
}

export interface Harakah { id: string; mark: string; name: string; hint: string; tanween?: boolean }

export interface Station {
  id: string; title: string; kind: StationKind;
  args?: Record<string, unknown>; exam?: boolean; final?: boolean;
}

export interface World {
  id: string; title: string; subtitle: string; glyph: string; stations: Station[];
}

export type StationKind =
  | 'learn_letters' | 'letter_by_audio' | 'similar_letters' | 'order_letters'
  | 'letter_forms' | 'letter_position' | 'sound_similar' | 'dad_za'
  | 'learn_makharij' | 'makhraj_pick' | 'composite' | 'learn_muqattaat'
  | 'muqattaa_read' | 'muqattaa_madd' | 'harakah_drill' | 'harakah_hunt'
  | 'spell_drill' | 'syllable_drill' | 'qalqala' | 'cvc_read' | 'cvc_pick'
  | 'shadda_drill' | 'shadda_contrast' | 'shadda_madd' | 'read_words'
  | 'read_sentence' | 'madd_contrast' | 'learn_madd' | 'madd_type'
  | 'family_learn' | 'family_pick' | 'family_odd' | 'family_read'
  | 'build_word' | 'decompose' | 'lam_rule' | 'hamza_rule' | 'ta_rule'
  | 'alif_rule' | 'waqf_rule' | 'learn_rules' | 'rule_pick' | 'rule_letters'
  | 'learn_meem' | 'meem_pick' | 'noon_meem_mix' | 'ghunna'
  | 'learn_ra' | 'ra_rule' | 'lam_jalala'
  | 'dagger_alif' | 'silent_letters' | 'learn_waqf_marks' | 'waqf_mark_pick'
  | 'recite' | 'recite_mixed' | 'exam' | 'final_exam';

export interface WordFamily {
  id: string; rime: string; tier: 1 | 2 | 3; label: string; onsets: string[];
}

export const ZWJ = '\u200D';
export const FATHA = '\u064E', DAMMA = '\u064F', KASRA = '\u0650';
export const FATHATAN = '\u064B', DAMMATAN = '\u064C', KASRATAN = '\u064D';
export const SUKUN = '\u0652', SHADDA = '\u0651';

/* ---------------------------------------------------------------- الحروف */
/* q: قلقلة | tf: تفخيم دائم | sun: لام شمسية | halq: حرف حلقي */
export const LETTERS: Letter[] = [
  { id:'alif', c:'ا', name:'أَلِف',  makhraj:'الجوف',        joinBefore:true,  joinAfter:false },
  { id:'ba',   c:'ب', name:'بَاء',   makhraj:'الشفتان',       q:true },
  { id:'ta',   c:'ت', name:'تَاء',   makhraj:'طرف اللسان',    sun:true },
  { id:'tha',  c:'ث', name:'ثَاء',   makhraj:'طرف اللسان',    sun:true },
  { id:'jim',  c:'ج', name:'جِيم',   makhraj:'وسط اللسان',    q:true },
  { id:'hha',  c:'ح', name:'حَاء',   makhraj:'وسط الحلق',     halq:true },
  { id:'kha',  c:'خ', name:'خَاء',   makhraj:'أدنى الحلق',    tf:true, halq:true },
  { id:'dal',  c:'د', name:'دَال',   makhraj:'طرف اللسان',    q:true, sun:true, joinAfter:false },
  { id:'dhal', c:'ذ', name:'ذَال',   makhraj:'طرف اللسان',    sun:true, joinAfter:false },
  { id:'ra',   c:'ر', name:'رَاء',   makhraj:'طرف اللسان',    sun:true, joinAfter:false },
  { id:'zay',  c:'ز', name:'زَاي',   makhraj:'طرف اللسان',    sun:true, joinAfter:false },
  { id:'sin',  c:'س', name:'سِين',   makhraj:'طرف اللسان',    sun:true },
  { id:'shin', c:'ش', name:'شِين',   makhraj:'وسط اللسان',    sun:true },
  { id:'sad',  c:'ص', name:'صَاد',   makhraj:'طرف اللسان',    tf:true, sun:true },
  { id:'dad',  c:'ض', name:'ضَاد',   makhraj:'حافة اللسان',   tf:true, sun:true },
  { id:'tta',  c:'ط', name:'طَاء',   makhraj:'طرف اللسان',    tf:true, q:true, sun:true },
  { id:'zza',  c:'ظ', name:'ظَاء',   makhraj:'طرف اللسان',    tf:true, sun:true },
  { id:'ayn',  c:'ع', name:'عَين',   makhraj:'وسط الحلق',     halq:true },
  { id:'ghayn',c:'غ', name:'غَين',   makhraj:'أدنى الحلق',    tf:true, halq:true },
  { id:'fa',   c:'ف', name:'فَاء',   makhraj:'الشفة والثنايا' },
  { id:'qaf',  c:'ق', name:'قَاف',   makhraj:'أقصى اللسان',   tf:true, q:true },
  { id:'kaf',  c:'ك', name:'كَاف',   makhraj:'أقصى اللسان' },
  { id:'lam',  c:'ل', name:'لَام',   makhraj:'حافة اللسان',   sun:true },
  { id:'mim',  c:'م', name:'مِيم',   makhraj:'الشفتان' },
  { id:'nun',  c:'ن', name:'نُون',   makhraj:'طرف اللسان',    sun:true },
  { id:'ha',   c:'ه', name:'هَاء',   makhraj:'أقصى الحلق',    halq:true },
  { id:'waw',  c:'و', name:'وَاو',   makhraj:'الشفتان',       joinAfter:false },
  { id:'ya',   c:'ي', name:'يَاء',   makhraj:'وسط اللسان' },
  { id:'hamza',c:'ء', name:'هَمْزَة', makhraj:'أقصى الحلق',    halq:true, joinBefore:false, joinAfter:false }
];

export const byId: Record<string, Letter> = Object.fromEntries(LETTERS.map(l => [l.id, l]));
export const byChar: Record<string, Letter> = Object.fromEntries(LETTERS.map(l => [l.c, l]));

/** أشكال الحرف: منفصل / أول / وسط / آخر — تُبنى بـ ZWJ */
export function forms(L: Letter) {
  const after  = L.joinAfter  !== false;
  const before = L.joinBefore !== false;
  return {
    isolated: L.c,
    initial:  after  ? L.c + ZWJ : L.c,
    medial:   after && before ? ZWJ + L.c + ZWJ : (before ? ZWJ + L.c : L.c),
    final:    before ? ZWJ + L.c : L.c
  };
}

/* ------------------------------------------- مجموعات الحروف المتشابهة رسماً */
export const SIMILAR_GROUPS = [
  { id:'btth', label:'الباء والتاء والثاء', ids:['ba','ta','tha'] },
  { id:'jhkh', label:'الجيم والحاء والخاء', ids:['jim','hha','kha'] },
  { id:'ddh',  label:'الدال والذال',        ids:['dal','dhal'] },
  { id:'rz',   label:'الراء والزاي',        ids:['ra','zay'] },
  { id:'ssh',  label:'السين والشين',        ids:['sin','shin'] },
  { id:'sd',   label:'الصاد والضاد',        ids:['sad','dad'] },
  { id:'tz',   label:'الطاء والظاء',        ids:['tta','zza'] },
  { id:'agh',  label:'العين والغين',        ids:['ayn','ghayn'] },
  { id:'fq',   label:'الفاء والقاف',        ids:['fa','qaf'] }
];

/* --------------------------------------------------------------- الحركات */
export const HARAKAT: Harakah[] = [
  { id:'fatha',    mark:FATHA,    name:'الفَتْحَة',  hint:'صوت قصير مفتوح، والفم ينفتح' },
  { id:'damma',    mark:DAMMA,    name:'الضَّمَّة',   hint:'صوت قصير، والشفتان تستديران' },
  { id:'kasra',    mark:KASRA,    name:'الكَسْرَة',  hint:'صوت قصير، والفك ينخفض' },
  { id:'fathatan', mark:FATHATAN, name:'فَتْحَتَان',  hint:'تُنطق فَتحة ثم نون ساكنة', tanween:true },
  { id:'dammatan', mark:DAMMATAN, name:'ضَمَّتَان',   hint:'تُنطق ضَمّة ثم نون ساكنة', tanween:true },
  { id:'kasratan', mark:KASRATAN, name:'كَسْرَتَان',  hint:'تُنطق كَسرة ثم نون ساكنة', tanween:true },
  { id:'sukun',    mark:SUKUN,    name:'السُّكُون',  hint:'الحرف بلا حركة، يُوقف عليه' },
  { id:'shadda',   mark:SHADDA+FATHA, name:'الشَّدَّة', hint:'حرفان: ساكن ثم متحرك، يُنطقان معاً' }
];

/* ----------------------------------------------------------- بنك الكلمات */
export const WORDS: Record<string, string[]> = {
  fatha: ['كَتَبَ','ذَهَبَ','جَلَسَ','فَتَحَ','شَرَبَ','سَمَعَ','رَسَمَ','حَمَلَ','خَرَجَ','دَخَلَ',
          'نَصَرَ','وَعَدَ','طَلَبَ','ضَرَبَ','قَعَدَ','سَجَدَ','حَصَدَ','زَرَعَ','غَسَلَ','ظَهَرَ',
          'ثَبَتَ','بَعَثَ','مَنَعَ','وَزَنَ','لَمَسَ','فَصَلَ','مَرَجَ','حَكَمَ','سَقَطَ','خَلَقَ'],
  damma: ['كَرُمَ','حَسُنَ','كَبُرَ','صَغُرَ','ظَرُفَ','شَرُفَ','قَرُبَ','بَعُدَ','حَمُضَ','عَذُبَ',
          'سَهُلَ','صَعُبَ','نَظُفَ','فَصُحَ','ثَقُلَ','خَشُنَ','جَمُلَ','لَطُفَ','قَبُحَ','ضَعُفَ'],
  kasra: ['أَمِنَ','حَمِدَ','رَمِضَ','سَمِعَ','ضَمِنَ','طَمِعَ','ظَمِئَ','عَمِيَ','عَمِلَ','غَمِصَ',
          'أَنِسَ','قَوِيَ','تَهِمَ','جَهِلَ','شَهِدَ','فَهِمَ','وَهِيَ','وَرِثَ','كَتِفَ','حَذِرَ'],
  tanween: ['قَلَمٌ','وَلَدٌ','رَجُلٌ','شَجَرٌ','حَجَرٌ','عَمَلٌ','أَمَلٌ','جَبَلٌ','سَمَكٌ','ذَهَبٌ',
            'قَلَمًا','وَلَدًا','عَمَلًا','جَبَلًا','سَمَكًا','قَلَمٍ','وَلَدٍ','عَمَلٍ','جَبَلٍ','ذَهَبٍ'],
  sukun: ['مَكْتَبٌ','مَسْجِدٌ','مَشْرَبٌ','مَلْعَبٌ','صَبْرٌ','فَجْرٌ','عَصْرٌ','شَمْسٌ','نَجْمٌ','قَلْبٌ',
          'دَرْسٌ','أَرْضٌ','عِلْمٌ','حِلْمٌ','بَحْرٌ','نَهْرٌ','سَهْمٌ','رَمْزٌ','حَبْلٌ','وَقْتٌ'],
  shadda: ['مَدَّ','شَدَّ','رَبَّ','حَقَّ','خَطَّ','سَرَّ','فَرَّ','مَرَّ','عَزَّ','ذَلَّ',
           'قَلَّ','ظَنَّ','صَفَّ','حَبَّ','جَدَّ','هَمَّ','ضَمَّ','كَفَّ','نَصَّ','سَدَّ',
           'عَلَّمَ','كَسَّرَ','قَدَّمَ','سَلَّمَ','بَشَّرَ','حَدَّثَ','رَتَّبَ','عَظَّمَ','فَكَّرَ','نَظَّفَ'],
  madd_alif: ['قَالَ','بَابٌ','نَامَ','قَامَ','صَامَ','جَاءَ','شَاءَ','مَالٌ','حَالٌ','نَارٌ',
              'دَارٌ','سَارَ','طَارَ','كَانَ','زَادَ','عَادَ','فَازَ','خَافَ','طَابَ','ثَابَ'],
  madd_waw: ['يَقُولُ','نُورٌ','سُورٌ','يَكُونُ','رَسُولٌ','عُيُونٌ','قُلُوبٌ','يَدُومُ','يَعُودُ','يَمُوتُ',
             'يَقُومُ','عُقُولٌ','سُطُورٌ','دُخُولٌ','جُلُوسٌ','رُكُوعٌ','سُجُودٌ','نُزُولٌ','ظُهُورٌ','حُضُورٌ'],
  madd_ya: ['يُجِيرُ','يُمِيتُ','يُعِيدُ','يَزِيدُ','سَرِيعٌ','حَدِيثٌ','بَدِيعٌ','رَفِيعٌ','تَغِيضُ','تَلِينُ',
            'تَفِيضُ','تَحِيدُ','نُقِيمُ','تُثِيرُ','تَشِيعُ','وَقِيلَ','وَسِيقَ','كَرِيمٌ','رَحِيمٌ','عَلِيمٌ'],
  leen: ['بَيْتٌ','خَيْرٌ','عَيْنٌ','سَيْفٌ','لَيْلٌ','زَيْتٌ','قَوْمٌ','يَوْمٌ','نَوْمٌ','خَوْفٌ',
         'صَوْتٌ','لَوْنٌ','فَوْقَ','حَوْلَ','كَيْفَ','أَيْنَ','بَيْنَ','ثَوْبٌ','ضَوْءٌ','شَيْءٌ']
};

/* أمثلة موقع الحرف في الكلمة — من صفحة «أمثلة على موقع الحرف في الكلمة» */
export const POSITION_WORDS: Record<string, { initial: string; medial: string; final: string }> = {
  qaf:  { initial:'قَصَدَ', medial:'سَقَطَ', final:'خَلَقَ' },
  kaf:  { initial:'كَتَمَ', medial:'سَكَبَ', final:'مَسَكَ' },
  lam:  { initial:'لَمَسَ', medial:'خَلَفَ', final:'فَصَلَ' },
  mim:  { initial:'مَرَجَ', medial:'حَمَلَ', final:'حَكَمَ' },
  nun:  { initial:'نَشَأَ', medial:'مَنَعَ', final:'وَزَنَ' },
  ba:   { initial:'بَذَرَ', medial:'صَبَرَ', final:'كَتَبَ' },
  ta:   { initial:'تَرَكَ', medial:'كَتَبَ', final:'ثَبَتَ' },
  ra:   { initial:'رَسَمَ', medial:'شَرَبَ', final:'نَصَرَ' },
  sin:  { initial:'سَجَدَ', medial:'رَسَمَ', final:'جَلَسَ' },
  jim:  { initial:'جَلَسَ', medial:'سَجَدَ', final:'خَرَجَ' },
  dal:  { initial:'دَخَلَ', medial:'صَدَرَ', final:'وَعَدَ' },
  fa:   { initial:'فَتَحَ', medial:'صَفَحَ', final:'خَلَفَ' },
  ayn:  { initial:'عَمِلَ', medial:'سَعَدَ', final:'رَجَعَ' },
  ha:   { initial:'هَرَبَ', medial:'ذَهَبَ', final:'فَقِهَ' },
  sad:  { initial:'صَبَرَ', medial:'نَصَرَ', final:'حَرَصَ' },
  tta:  { initial:'طَلَبَ', medial:'سَطَرَ', final:'سَقَطَ' }
};

/* ------------------------------------------------------------ الجُمل */
export const SENTENCES = [
  'ضَرَبَنِي أَبِي',
  'سَمِعَنِي أَخِي',
  'زَارَنِي خَالِي',
  'وَمَعَهُ خَالَتِي',
  'ذَهَبَ الْوَلَدُ إِلَى الْمَدْرَسَةِ',
  'قَرَأَ سَعِيدٌ الدَّرْسَ',
  'فَتَحَ الْمُعَلِّمُ الْبَابَ',
  'الشَّمْسُ طَالِعَةٌ وَالْقَمَرُ غَائِبٌ',
  'كَتَبَ التِّلْمِيذُ الدَّرْسَ بِخَطٍّ جَمِيلٍ',
  'فِي الْبُسْتَانِ زُهُورٌ كَثِيرَةٌ',
  'يَقُومُ الطَّالِبُ مُبَكِّرًا',
  'اللُّغَةُ الْعَرَبِيَّةُ لُغَةُ الْقُرْآنِ'
];

/* ------------------------------------------- اللام الشمسية والقمرية */
export const LAM_WORDS = [
  { w:'الشَّمْسُ', type:'sun' },   { w:'الْقَمَرُ', type:'moon' },
  { w:'النَّجْمُ', type:'sun' },   { w:'الْبَيْتُ', type:'moon' },
  { w:'الرَّجُلُ', type:'sun' },   { w:'الْعِلْمُ', type:'moon' },
  { w:'الدَّرْسُ', type:'sun' },   { w:'الْكِتَابُ', type:'moon' },
  { w:'الطَّرِيقُ', type:'sun' },  { w:'الْجَبَلُ', type:'moon' },
  { w:'السَّمَاءُ', type:'sun' },  { w:'الْمَاءُ', type:'moon' },
  { w:'الزَّيْتُ', type:'sun' },   { w:'الْحَقُّ', type:'moon' },
  { w:'الثَّوْبُ', type:'sun' },   { w:'الْغَيْثُ', type:'moon' },
  { w:'اللَّيْلُ', type:'sun' },   { w:'الْأَرْضُ', type:'moon' },
  { w:'التِّينُ', type:'sun' },    { w:'الْوَلَدُ', type:'moon' }
];

/* --------------------------------------------------- أحكام النون الساكنة */
export const TAJWEED_RULES = [
  { id:'izhar',   name:'الإِظْهَار',            letters:'ء ه ع ح غ خ',
    desc:'إذا جاء بعد النون الساكنة أو التنوين حرفٌ من حروف الحلق، تُنطق النون واضحةً بلا غنة زائدة.' },
  { id:'idgham_g',name:'الإِدْغَام بِغُنَّة',      letters:'ي ن م و',
    desc:'تُدغم النون في الحرف التالي مع بقاء الغنة مقدار حركتين.' },
  { id:'idgham_n',name:'الإِدْغَام بِغَيْرِ غُنَّة', letters:'ل ر',
    desc:'تُدغم النون في اللام أو الراء إدغاماً كاملاً بلا غنة.' },
  { id:'iqlab',   name:'الإِقْلَاب',            letters:'ب',
    desc:'تُقلب النون الساكنة ميماً مخفاة مع الغنة عند الباء.' },
  { id:'ikhfa',   name:'الإِخْفَاء',            letters:'ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك',
    desc:'تُنطق النون بين الإظهار والإدغام مع غنة، دون تشديد.' }
];

export const TAJWEED_EXAMPLES = [
  { t:'مَنْ آمَنَ',    rule:'izhar' },   { t:'مِنْ عِلْمٍ',    rule:'izhar' },
  { t:'أَنْعَمْتَ',     rule:'izhar' },   { t:'مِنْ خَيْرٍ',    rule:'izhar' },
  { t:'مَنْ يَعْمَلْ',   rule:'idgham_g' },{ t:'مِنْ وَلِيٍّ',   rule:'idgham_g' },
  { t:'مِنْ مَالٍ',     rule:'idgham_g' },{ t:'مِنْ نُورٍ',    rule:'idgham_g' },
  { t:'مِنْ رَبِّهِمْ',   rule:'idgham_n' },{ t:'مِنْ لَدُنْهُ',  rule:'idgham_n' },
  { t:'مِنْ بَعْدِ',     rule:'iqlab' },   { t:'سَمِيعٌ بَصِيرٌ',rule:'iqlab' },
  { t:'مِنْ قَبْلُ',     rule:'ikhfa' },   { t:'أَنْدَادًا',     rule:'ikhfa' },
  { t:'مِنْ تَحْتِهَا',   rule:'ikhfa' },   { t:'مِنْ شَيْءٍ',   rule:'ikhfa' }
];

/* ============================================ أحكام الميم الساكنة */
export const MEEM_RULES = [
  { id:'ikhfa_shaf',  name:'الإِخْفَاء الشَّفَوِي', letters:'ب',
    desc:'إذا جاء بعد الميم الساكنة باءٌ، أُخفيت الميم مع غنة مقدار حركتين، والشفتان تنطبقان انطباقاً خفيفاً.' },
  { id:'idgham_mith', name:'إِدْغَام المِثْلَيْن',   letters:'م',
    desc:'إذا جاء بعد الميم الساكنة ميمٌ، أُدغمت فيها مع غنة كاملة فصارتا ميماً واحدة مشدَّدة.' },
  { id:'izhar_shaf',  name:'الإِظْهَار الشَّفَوِي', letters:'باقي الحروف عدا الباء والميم',
    desc:'تُنطق الميم الساكنة واضحةً بلا غنة زائدة، وأشدّ ما يكون البيان عند الواو والفاء.' }
];

export const MEEM_EXAMPLES = [
  { t:'هُمْ بِهِ',            rule:'ikhfa_shaf' },  { t:'تَرْمِيهِمْ بِحِجَارَةٍ', rule:'ikhfa_shaf' },
  { t:'أَمْ بِهِ',            rule:'ikhfa_shaf' },  { t:'رَبُّهُمْ بِهِمْ',      rule:'ikhfa_shaf' },
  { t:'لَهُمْ مَا',           rule:'idgham_mith' }, { t:'فِي قُلُوبِهِمْ مَرَضٌ', rule:'idgham_mith' },
  { t:'كُنْتُمْ مُؤْمِنِينَ',   rule:'idgham_mith' }, { t:'أَمْ مَنْ',            rule:'idgham_mith' },
  { t:'عَلَيْهِمْ وَلَا',       rule:'izhar_shaf' },  { t:'هُمْ فِيهَا',          rule:'izhar_shaf' },
  { t:'لَكُمْ دِينُكُمْ',      rule:'izhar_shaf' },  { t:'أَنْعَمْتَ عَلَيْهِمْ',   rule:'izhar_shaf' }
];

/* ============================================ همزة الوصل والقطع */
export const HAMZA_WORDS = [
  { w:'اسْتَغْفَرَ', type:'wasl' }, { w:'أَكْرَمَ',    type:'qat' },
  { w:'انْطَلَقَ',   type:'wasl' }, { w:'أَحْمَدُ',    type:'qat' },
  { w:'اكْتُبْ',     type:'wasl' }, { w:'إِبْرَاهِيمُ', type:'qat' },
  { w:'ابْنٌ',       type:'wasl' }, { w:'أَنْتَ',      type:'qat' },
  { w:'اسْمٌ',       type:'wasl' }, { w:'أَخْرَجَ',    type:'qat' },
  { w:'امْرَأَةٌ',    type:'wasl' }, { w:'أُولَئِكَ',   type:'qat' },
  { w:'الْكِتَابُ',   type:'wasl' }, { w:'إِسْلَامٌ',   type:'qat' },
  { w:'اثْنَانِ',    type:'wasl' }, { w:'أَعْطَى',     type:'qat' }
];

/* ============================================ المدود الفرعية */
export const MADD_TYPES = [
  { id:'muttasil', name:'المَدّ المُتَّصِل',     desc:'حرف مدّ تليه همزة في الكلمة نفسها، ويُمدّ أربع حركات أو خمساً.' },
  { id:'munfasil', name:'المَدّ المُنْفَصِل',    desc:'حرف مدّ في آخر كلمة وهمزة في أول التي بعدها، ويُمدّ أربع حركات أو خمساً.' },
  { id:'arid',     name:'العَارِض لِلسُّكُون',  desc:'حرف مدّ يليه حرف سكونه عارض بسبب الوقف، ويجوز فيه القصر والتوسط والإشباع.' },
  { id:'lazim',    name:'المَدّ اللَّازِم',      desc:'حرف مدّ يليه سكون أصلي ثابت وصلاً ووقفاً، ويُمدّ ست حركات وجوباً.' }
];

export const MADD_EXAMPLES = [
  { t:'جَاءَ',            type:'muttasil' }, { t:'السَّمَاءِ',       type:'muttasil' },
  { t:'سُوءَ',            type:'muttasil' }, { t:'نِدَاءً',          type:'muttasil' },
  { t:'بِمَا أُنْزِلَ',     type:'munfasil' }, { t:'يَا أَيُّهَا',      type:'munfasil' },
  { t:'قَالُوا آمَنَّا',    type:'munfasil' }, { t:'فِي أَنْفُسِهِمْ',   type:'munfasil' },
  { t:'الْعَالَمِينْ',      type:'arid' },     { t:'نَسْتَعِينْ',       type:'arid' },
  { t:'الرَّحِيمْ',        type:'arid' },     { t:'الْحِسَابْ',        type:'arid' },
  { t:'الضَّالِّينَ',       type:'lazim' },    { t:'الْحَاقَّةُ',       type:'lazim' },
  { t:'الطَّامَّةُ',        type:'lazim' },    { t:'دَابَّةٌ',          type:'lazim' }
];

/* ==================================== تفخيم الراء وترقيقها */
export const RA_WORDS = [
  { w:'رَبٌّ',     type:'heavy' }, { w:'رِزْقٌ',      type:'light' },
  { w:'رَحْمَةٌ',   type:'heavy' }, { w:'رِجَالٌ',     type:'light' },
  { w:'رُسُلٌ',    type:'heavy' }, { w:'فِرْعَوْنُ',   type:'light' },
  { w:'رُزِقَ',    type:'heavy' }, { w:'مِرْيَةٌ',     type:'light' },
  { w:'بَرْقٌ',    type:'heavy' }, { w:'الشِّعْرِ',    type:'light' },
  { w:'قُرْآنٌ',   type:'heavy' }, { w:'رِيحٌ',        type:'light' },
  { w:'مَرْيَمُ',   type:'heavy' }, { w:'الْفِرْدَوْسِ', type:'light' },
  { w:'عَرْشٌ',    type:'heavy' }, { w:'شِرْذِمَةٌ',   type:'light' }
];

export const RA_RULES: Record<string, string> = {
  heavy: 'تُفخَّم الراء إذا كانت مفتوحة أو مضمومة، أو ساكنة بعد فتحة أو ضمة.',
  light: 'تُرقَّق الراء إذا كانت مكسورة، أو ساكنة بعد كسرة، أو ساكنة بعد ياء ساكنة.'
};

/* ==================================== لام لفظ الجلالة */
export const LAM_JALALA = [
  { w:'قَالَ اللهُ',    type:'heavy', h:'fatha',  before:'اللام سبقتها فتحة اللام في «قَالَ»' },
  { w:'شَهِدَ اللهُ',    type:'heavy', h:'fatha',  before:'اللام سبقتها فتحة الدال في «شَهِدَ»' },
  { w:'نَصْرُ اللهِ',    type:'heavy', h:'damma',  before:'اللام سبقتها ضمة الراء في «نَصْرُ»' },
  { w:'عَبْدُ اللهِ',    type:'heavy', h:'damma',  before:'اللام سبقتها ضمة الدال في «عَبْدُ»' },
  { w:'بِسْمِ اللهِ',    type:'light', h:'kasra',  before:'اللام سبقتها كسرة الميم في «بِسْمِ»' },
  { w:'فِي دِينِ اللهِ', type:'light', h:'kasra',  before:'اللام سبقتها كسرة النون في «دِينِ»' },
  { w:'الْحَمْدُ لِلَّهِ', type:'light', h:'kasra',  before:'اللام سبقتها كسرة لام الجر في «لِ»' },
  { w:'بِاللهِ',         type:'light', h:'kasra',  before:'اللام سبقتها كسرة الباء في «بِ»' }
];

/* ==================================== التاء المربوطة والمفتوحة */
export const TA_WORDS = [
  { w:'شَجَرَةٌ',   type:'marbuta' }, { w:'بِنْتٌ',    type:'maftuha' },
  { w:'مَدْرَسَةٌ',  type:'marbuta' }, { w:'أُخْتٌ',    type:'maftuha' },
  { w:'حَدِيقَةٌ',  type:'marbuta' }, { w:'نَبَاتٌ',   type:'maftuha' },
  { w:'رَحْمَةٌ',   type:'marbuta' }, { w:'كَتَبَتْ',   type:'maftuha' },
  { w:'جَنَّةٌ',     type:'marbuta' }, { w:'بَنَاتٌ',   type:'maftuha' },
  { w:'فَاطِمَةُ',  type:'marbuta' }, { w:'صَوْتٌ',    type:'maftuha' }
];

/* ==================================== الألف المقصورة والممدودة */
export const ALIF_WORDS = [
  { w:'هُدَى',     type:'maqsura' }, { w:'عَصَا',   type:'mamduda' },
  { w:'فَتَى',     type:'maqsura' }, { w:'دَعَا',   type:'mamduda' },
  { w:'عَلَى',     type:'maqsura' }, { w:'هُنَا',   type:'mamduda' },
  { w:'مُوسَى',    type:'maqsura' }, { w:'شَذَا',   type:'mamduda' },
  { w:'مُصْطَفَى',  type:'maqsura' }, { w:'سَنَا',   type:'mamduda' }
];

export const QALQALA_WORDS = ['قَدْ','يَجْعَلْ','قُطْبٌ','يَدْخُلُ','أَبْصَرَ','يَقْطَعُ','مُحِيطْ','خَلَقْ','أَجْرٌ','يَبْدَأُ'];

/* ==================================================================
   ما يلزم لقراءة المصحف فعلاً
   ================================================================== */

/* ---------- الألف الخنجرية: تُنطق ألفاً ولا تُرسم ألفاً ---------- */
export const DAGGER_WORDS = [
  { w:'هَٰذَا',      read:'هَاذَا' },
  { w:'ذَٰلِكَ',      read:'ذَالِكَ' },
  { w:'لَٰكِنْ',      read:'لَاكِنْ' },
  { w:'الرَّحْمَٰنِ',  read:'الرَّحْمَانِ' },
  { w:'إِلَٰهِ',      read:'إِلَاهِ' },
  { w:'أُولَٰئِكَ',    read:'أُولَائِكَ' },
  { w:'هَٰؤُلَاءِ',    read:'هَاؤُلَاءِ' },
  { w:'يَٰأَيُّهَا',    read:'يَاأَيُّهَا' }
];

/* ---------- حروف تُرسم ولا تُنطق ---------- */
export const SILENT_WORDS = [
  { w:'أُولَٰئِكَ', silent:'و', why:'واو زائدة في الرسم لا تُنطق' },
  { w:'أُولُو',    silent:'و', why:'الواو الأولى زائدة في الرسم' },
  { w:'مِائَةٍ',    silent:'ا', why:'ألف زائدة بين الميم والهمزة' },
  { w:'عَمْرٌو',    silent:'و', why:'واو تُميّز «عَمرو» من «عُمر»' },
  { w:'قَالُوا',    silent:'ا', why:'ألف فارقة بعد واو الجماعة' },
  { w:'كَتَبُوا',   silent:'ا', why:'ألف فارقة بعد واو الجماعة' },
  { w:'يَدْعُوا',   silent:'ا', why:'ألف فارقة بعد واو الجماعة' },
  { w:'أَنَا',      silent:'ا', why:'الألف الأخيرة تُكتب ولا تُنطق في الوصل' }
];

/* ---------- الغنّة: النون والميم المشدّدتان ---------- */
export const GHUNNA_WORDS = [
  { w:'إِنَّ',        letter:'ن' }, { w:'أَنَّ',      letter:'ن' },
  { w:'النَّاسِ',     letter:'ن' }, { w:'الْجِنَّةِ',  letter:'ن' },
  { w:'إِنَّا',       letter:'ن' }, { w:'الْخَنَّاسِ', letter:'ن' },
  { w:'ثُمَّ',        letter:'م' }, { w:'عَمَّ',      letter:'م' },
  { w:'مِمَّا',       letter:'م' }, { w:'أَمَّا',     letter:'م' },
  { w:'مُحَمَّدٌ',    letter:'م' }, { w:'الْأُمَّةِ',  letter:'م' }
];

/* ---------- الشدّة مع المدّ والشدّتان في كلمة ---------- */
export const SHADDA_MADD_WORDS = [
  { w:'الضَّالِّينَ',  note:'شدّتان ومدّ لازم' },
  { w:'الْحَاقَّةُ',   note:'مدّ لازم مثقّل' },
  { w:'الطَّامَّةُ',   note:'مدّ لازم مثقّل' },
  { w:'الصَّاخَّةُ',   note:'مدّ لازم مثقّل' },
  { w:'دَابَّةٌ',      note:'مدّ لازم مثقّل' },
  { w:'الَّذِينَ',     note:'شدّة ثم مدّ' },
  { w:'مُّتَّكِئِينَ',  note:'شدّتان متتاليتان' },
  { w:'الصَّافَّاتِ',  note:'شدّتان ومدّ' },
  { w:'حَاجَّ',        note:'مدّ ثم شدّة' },
  { w:'تُحَاجُّونِّي', note:'ثلاث شدّات ومدّ' }
];

/* ---------- علامات الوقف في المصحف ---------- */
export const WAQF_MARKS = [
  { m:'مـ',  name:'الوقف اللازم',       rule:'يجب الوقف، لأن الوصل يُغيّر المعنى.' },
  { m:'لا',  name:'الوقف الممنوع',      rule:'لا تقف هنا، فالمعنى لا يتمّ.' },
  { m:'ج',   name:'الوقف الجائز',       rule:'الوقف والوصل سواء.' },
  { m:'صلى', name:'الوصل أولى',         rule:'يجوز الوقف، والوصل أحسن.' },
  { m:'قلى', name:'الوقف أولى',         rule:'يجوز الوصل، والوقف أحسن.' },
  { m:'∴ ∴', name:'وقف المعانقة',       rule:'قف عند إحدى النقطتين لا عندهما معاً.' },
  { m:'س',   name:'السكت',              rule:'اسكت سكتة لطيفة بلا تنفّس.' },
  { m:'ۘ',   name:'وقف لازم (رسم مصحفي)', rule:'كالوقف اللازم في المصاحف المشرقية.' }
];

/* ---------- مخارج الحروف: خمسة مواضع ---------- */
export const MAKHARIJ_GROUPS = [
  { id:'jawf',  name:'الجَوف',   letters:'ا و ي',
    desc:'خلاء الفم والحلق، ومنه حروف المدّ الثلاثة.' },
  { id:'halq',  name:'الحَلق',   letters:'ء ه ع ح غ خ',
    desc:'ثلاثة مخارج: أقصاه (ء ه)، ووسطه (ع ح)، وأدناه (غ خ).' },
  { id:'lisan', name:'اللِّسان',  letters:'ق ك ج ش ي ض ل ن ر ط د ت ص ز س ظ ذ ث',
    desc:'أكثر المخارج، عشرة مخارج من أقصى اللسان إلى طرفه.' },
  { id:'shafa', name:'الشَّفتان', letters:'ف ب م و',
    desc:'الفاء من باطن الشفة السفلى مع الثنايا، والباقي من الشفتين.' },
  { id:'khay',  name:'الخَيشوم', letters:'غنّة النون والميم',
    desc:'أعلى الأنف، ومنه الغنّة وحدها لا حرف كامل.' }
];

/* ---------- قصار السور: ثمرة الإتقان ---------- */
export const SURAHS = [
  { id:'fatiha', name:'الفاتحة', ayat:[
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    'الرَّحْمَٰنِ الرَّحِيمِ',
    'مَالِكِ يَوْمِ الدِّينِ',
    'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
    'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ' ] },
  { id:'asr', name:'العصر', ayat:[
    'وَالْعَصْرِ',
    'إِنَّ الْإِنْسَانَ لَفِي خُسْرٍ',
    'إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ' ] },
  { id:'kawthar', name:'الكوثر', ayat:[
    'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ',
    'فَصَلِّ لِرَبِّكَ وَانْحَرْ',
    'إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ' ] },
  { id:'nasr', name:'النصر', ayat:[
    'إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ',
    'وَرَأَيْتَ النَّاسَ يَدْخُلُونَ فِي دِينِ اللَّهِ أَفْوَاجًا',
    'فَسَبِّحْ بِحَمْدِ رَبِّكَ وَاسْتَغْفِرْهُ إِنَّهُ كَانَ تَوَّابًا' ] },
  { id:'ikhlas', name:'الإخلاص', ayat:[
    'قُلْ هُوَ اللَّهُ أَحَدٌ',
    'اللَّهُ الصَّمَدُ',
    'لَمْ يَلِدْ وَلَمْ يُولَدْ',
    'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ' ] },
  { id:'falaq', name:'الفلق', ayat:[
    'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ',
    'مِنْ شَرِّ مَا خَلَقَ',
    'وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ',
    'وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ',
    'وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ' ] },
  { id:'nas', name:'الناس', ayat:[
    'قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
    'مَلِكِ النَّاسِ',
    'إِلَٰهِ النَّاسِ',
    'مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ',
    'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ',
    'مِنَ الْجِنَّةِ وَالنَّاسِ' ] },
  { id:'kafirun', name:'الكافرون', ayat:[
    'قُلْ يَا أَيُّهَا الْكَافِرُونَ',
    'لَا أَعْبُدُ مَا تَعْبُدُونَ',
    'وَلَا أَنْتُمْ عَابِدُونَ مَا أَعْبُدُ',
    'وَلَا أَنَا عَابِدٌ مَا عَبَدْتُمْ',
    'وَلَا أَنْتُمْ عَابِدُونَ مَا أَعْبُدُ',
    'لَكُمْ دِينُكُمْ وَلِيَ دِينِ' ] }
];

/* ==================================================================
   عائلات الكلمات — تدرّج القراءة الحقيقي
   ------------------------------------------------------------------
   العائلة: نهايةٌ ثابتة يتغيّر أولها، كما في cat / bat / hat.
   الكلمات تُبنى برمجياً من (حرف أول + فتحة + نهاية العائلة)، فلا
   يتسرّب خطأ تشكيل، وكل كلمة في العائلة عربية صحيحة مقصودة.
   ================================================================== */

export const WORD_FAMILIES: WordFamily[] = [
  /* ---------- عائلات المدّ بالألف: أفعال جوفاء ثلاثية ---------- */
  { id:'f_ama', rime:'امَ', tier:1, label:'ـَامَ',
    onsets:['qaf','nun','sad','dal','ayn','lam','ha','sin','hha','ra'] },
  { id:'f_ara', rime:'ارَ', tier:1, label:'ـَارَ',
    onsets:['sin','dal','zay','fa','ghayn','ba','hha','tta','tha','jim','sad','kha'] },
  { id:'f_ala', rime:'الَ', tier:1, label:'ـَالَ',
    onsets:['qaf','mim','nun','sin','zay','tta','hha','jim','kaf','ghayn'] },
  { id:'f_ada', rime:'ادَ', tier:1, label:'ـَادَ',
    onsets:['ayn','zay','sin','qaf','ba','jim','hha','sad','kaf','shin'] },
  { id:'f_aba', rime:'ابَ', tier:1, label:'ـَابَ',
    onsets:['ta','tha','kha','shin','tta','ayn','ghayn','nun','ha','jim','dhal'] },
  { id:'f_a3a', rime:'اعَ', tier:1, label:'ـَاعَ',
    onsets:['ba','dad','shin','dhal','tta','jim','ra'] },
  { id:'f_ana', rime:'انَ', tier:1, label:'ـَانَ',
    onsets:['kaf','ba','sad','kha','zay','lam','ha','dal','ra'] },
  { id:'f_aqa', rime:'اقَ', tier:1, label:'ـَاقَ',
    onsets:['sin','dhal','fa','dad','hha'] },
  { id:'f_ata', rime:'اتَ', tier:1, label:'ـَاتَ', onsets:['mim','ba','fa'] },
  { id:'f_aza', rime:'ازَ', tier:1, label:'ـَازَ', onsets:['fa','hha','jim'] },

  /* ---------- عائلات الشدّة: أفعال مضعّفة ---------- */
  { id:'f_alla', rime:'لَّ', tier:2, label:'ـَلَّ',
    onsets:['dal','dad','zza','hha','kha','zay','shin','sad','tta','ayn','ghayn','fa','qaf','kaf','mim','jim','dhal'] },
  { id:'f_arra', rime:'رَّ', tier:2, label:'ـَرَّ',
    onsets:['ba','jim','hha','kha','sin','shin','sad','dad','tta','ghayn','fa','qaf','kaf','mim','ha','dhal','zay'] },
  { id:'f_adda', rime:'دَّ', tier:2, label:'ـَدَّ',
    onsets:['ra','sin','ayn','mim','shin','hha','jim','sad','ha','waw','ba'] },
  { id:'f_abba', rime:'بَّ', tier:2, label:'ـَبَّ',
    onsets:['hha','dal','sin','shin','sad','tta','ha','ra'] },
  { id:'f_amma', rime:'مَّ', tier:2, label:'ـَمَّ',
    onsets:['hamza','ta','tha','jim','hha','dhal','sin','shin','dad','ayn','ghayn','lam','ha'] },
  { id:'f_anna', rime:'نَّ', tier:2, label:'ـَنَّ',
    onsets:['zza','dad','hha','ra','mim','jim','sin','hamza','shin'] },
  { id:'f_affa', rime:'فَّ', tier:2, label:'ـَفَّ',
    onsets:['kha','sad','ayn','kaf','lam','ra','zay'] },
  { id:'f_aqqa', rime:'قَّ', tier:2, label:'ـَقَّ', onsets:['hha','dal','ra','shin','ayn'] },
  { id:'f_atta', rime:'طَّ', tier:2, label:'ـَطَّ', onsets:['kha','hha','shin','ghayn','qaf','nun'] },
  { id:'f_akka', rime:'كَّ', tier:2, label:'ـَكَّ', onsets:['shin','fa','dal','hha'] },
  { id:'f_assa', rime:'سَّ', tier:2, label:'ـَسَّ', onsets:['hha','dal','mim'] },
  { id:'f_ajja', rime:'جَّ', tier:2, label:'ـَجَّ', onsets:['hha','zay','lam'] },
  { id:'f_asha', rime:'شَّ', tier:2, label:'ـَشَّ', onsets:['ra','ghayn','ha'] },
  { id:'f_azza', rime:'زَّ', tier:2, label:'ـَزَّ', onsets:['ayn','ha'] },
  { id:'f_ahha', rime:'حَّ', tier:2, label:'ـَحَّ', onsets:['shin','sad'] },

  /* ---------- عائلات ثلاثية مفتوحة على وزن فَعَلَ ---------- */
  { id:'f_alaba', rime:'لَبَ', tier:3, label:'ـَلَبَ',
    onsets:['tta','qaf','jim','hha','sin','ghayn'] },
  { id:'f_afara', rime:'فَرَ', tier:3, label:'ـَفَرَ',
    onsets:['kaf','sin','zza','hha','ghayn','nun','zay'] },
  { id:'f_adara', rime:'دَرَ', tier:3, label:'ـَدَرَ',
    onsets:['qaf','sad','ba','ghayn','kaf','ha'] },
  { id:'f_asara', rime:'سَرَ', tier:3, label:'ـَسَرَ',
    onsets:['kaf','ya','kha','hamza'] },
  { id:'f_araja', rime:'رَجَ', tier:3, label:'ـَرَجَ',
    onsets:['kha','ayn','dal','mim','fa','hha'] },
  { id:'f_asara2', rime:'صَرَ', tier:3, label:'ـَصَرَ',
    onsets:['nun','ba','qaf','hha','ayn'] },
  { id:'f_abara', rime:'بَرَ', tier:3, label:'ـَبَرَ',
    onsets:['sad','ayn','kha','jim'] },
  { id:'f_amara', rime:'مَرَ', tier:3, label:'ـَمَرَ',
    onsets:['hamza','ayn','sin'] },
  { id:'f_ashara', rime:'شَرَ', tier:3, label:'ـَشَرَ',
    onsets:['nun','hha','ba'] },
  { id:'f_arada', rime:'رَدَ', tier:3, label:'ـَرَدَ',
    onsets:['ba','tta','shin','waw','sin','jim'] },
  { id:'f_afaa', rime:'فَعَ', tier:3, label:'ـَفَعَ',
    onsets:['ra','dal','nun','shin'] },
  { id:'f_azala', rime:'زَلَ', tier:3, label:'ـَزَلَ',
    onsets:['nun','ayn','ha','ghayn'] },
  { id:'f_aada', rime:'عَدَ', tier:3, label:'ـَعَدَ',
    onsets:['sin','qaf','waw','sad'] },
  { id:'f_asaba', rime:'سَبَ', tier:3, label:'ـَسَبَ',
    onsets:['hha','kaf','nun'] },
  { id:'f_adala', rime:'دَلَ', tier:3, label:'ـَدَلَ',
    onsets:['ayn','ba','jim'] },
  { id:'f_ahaba', rime:'هَبَ', tier:3, label:'ـَهَبَ',
    onsets:['dhal','waw','nun'] },
  { id:'f_asama', rime:'سَمَ', tier:3, label:'ـَسَمَ',
    onsets:['ra','qaf','waw','hha'] },
  { id:'f_arafa', rime:'رَفَ', tier:3, label:'ـَرَفَ',
    onsets:['ayn','sad','hha'] },
  { id:'f_amala', rime:'مَلَ', tier:3, label:'ـَمَلَ',
    onsets:['hha','hamza','shin'] },
  { id:'f_aala', rime:'عَلَ', tier:3, label:'ـَعَلَ',
    onsets:['fa','jim','sin'] }
];

/* ---------- مقاطع مغلقة قصيرة: أوامر وحروف ---------- */
export const CVC_WORDS = [
  { w:'قُلْ', kind:'أمر' },  { w:'كُنْ', kind:'أمر' },  { w:'قُمْ', kind:'أمر' },
  { w:'صُمْ', kind:'أمر' },  { w:'نَمْ', kind:'أمر' },  { w:'زِدْ', kind:'أمر' },
  { w:'عُدْ', kind:'أمر' },  { w:'خُذْ', kind:'أمر' },  { w:'كُلْ', kind:'أمر' },
  { w:'سَلْ', kind:'أمر' },  { w:'قِفْ', kind:'أمر' },  { w:'بِعْ', kind:'أمر' },
  { w:'عِشْ', kind:'أمر' },  { w:'سِرْ', kind:'أمر' },  { w:'طِرْ', kind:'أمر' },
  { w:'بَلْ', kind:'حرف' },  { w:'هَلْ', kind:'حرف' },  { w:'مِنْ', kind:'حرف' },
  { w:'عَنْ', kind:'حرف' },  { w:'إِنْ', kind:'حرف' },  { w:'أَنْ', kind:'حرف' },
  { w:'لَنْ', kind:'حرف' },  { w:'لَمْ', kind:'حرف' },  { w:'كَمْ', kind:'حرف' },
  { w:'قَدْ', kind:'حرف' }
];

/** يبني كلمات العائلة: حرف أول + فتحة + نهاية العائلة */
export function familyWords(f: WordFamily) {
  return f.onsets.map(id => ({
    w: byId[id].c + FATHA + f.rime,
    onset: id
  }));
}

/** كل كلمات كل العائلات في قائمة واحدة */
export function allFamilyWords(): { w: string; onset: string; family: string; tier: number }[] {
  const out: { w: string; onset: string; family: string; tier: number }[] = [];
  for (const f of WORD_FAMILIES) {
    for (const x of familyWords(f)) out.push({ ...x, family: f.id, tier: f.tier });
  }
  return out;
}

/* ==================================================================
   مقتبس من القاعدة النورانية للشيخ نور محمد حقاني
   ================================================================== */

/* ---------------- التهجّي: اسم الحرف + اسم حركته + الصوت الناتج ----- */
export const HARAKAH_SPELL: Record<string, string> = {
  fatha:'فَتْحَة', damma:'ضَمَّة', kasra:'كَسْرَة',
  fathatan:'فَتْحَتَان', dammatan:'ضَمَّتَان', kasratan:'كَسْرَتَان',
  sukun:'سُكُون', shadda:'شَدَّة'
};

/* ---------------- الحروف المركّبة: تُقرأ بالهجاء لا بالصوت --------- */
/* كل عنصر: الحروف بالترتيب (معرّفات) — ويُبنى شكلها المتصل برمجياً */
export const COMPOSITES: string[][] = [
  ['lam','alif'],  ['ba','ta','tha'], ['jim','hha','kha'], ['sin','shin'],
  ['mim','nun'],   ['fa','qaf'],      ['sad','dad'],       ['ta','mim'],
  ['nun','jim','mim'], ['kaf','ta','ba'], ['sin','lam','mim'], ['ha','mim'],
  ['ya','sin'],    ['ba','sin','mim'], ['ayn','lam','mim'], ['tta','ha']
];

/* ---------------- الحروف المقطّعة (فواتح السور) -------------------
   madd: 2 = حروف «حي طهر» تُمدّ حركتين
         6 = حروف «سنقص لكم» تُمدّ ستّ حركات
         0 = الألف لا تُمدّ، تُنطق باسمها
         4 = العين تُمدّ أربعاً أو ستّاً                                */
export const MUQATTAA_LETTERS: Record<string, { name: string; madd: number }> = {
  'ا':{ name:'أَلِف', madd:0 }, 'ح':{ name:'حَا', madd:2 }, 'ي':{ name:'يَا', madd:2 },
  'ط':{ name:'طَا', madd:2 },  'ه':{ name:'هَا', madd:2 }, 'ر':{ name:'رَا', madd:2 },
  'س':{ name:'سِين', madd:6 }, 'ن':{ name:'نُون', madd:6 }, 'ق':{ name:'قَاف', madd:6 },
  'ص':{ name:'صَاد', madd:6 }, 'ل':{ name:'لَام', madd:6 }, 'ك':{ name:'كَاف', madd:6 },
  'م':{ name:'مِيم', madd:6 }, 'ع':{ name:'عَين', madd:4 }
};

export const MUQATTAAT = [
  { t:'الم',    surah:'البقرة',  letters:['ا','ل','م'] },
  { t:'المص',   surah:'الأعراف', letters:['ا','ل','م','ص'] },
  { t:'الر',    surah:'يونس',    letters:['ا','ل','ر'] },
  { t:'المر',   surah:'الرعد',   letters:['ا','ل','م','ر'] },
  { t:'كهيعص',  surah:'مريم',    letters:['ك','ه','ي','ع','ص'] },
  { t:'طه',     surah:'طه',      letters:['ط','ه'] },
  { t:'طسم',    surah:'الشعراء', letters:['ط','س','م'] },
  { t:'طس',     surah:'النمل',   letters:['ط','س'] },
  { t:'يس',     surah:'يس',      letters:['ي','س'] },
  { t:'ص',      surah:'ص',       letters:['ص'] },
  { t:'حم',     surah:'غافر',    letters:['ح','م'] },
  { t:'عسق',    surah:'الشورى',  letters:['ع','س','ق'] },
  { t:'ق',      surah:'ق',       letters:['ق'] },
  { t:'ن',      surah:'القلم',   letters:['ن'] }
];

/* ---------------- الحروف المتشابهة صوتاً (لا رسماً) ---------------
   أزواج صغرى: كلمتان لا تختلفان إلا في حرف واحد.                     */
export const SOUND_GROUPS = [
  { id:'dh_z_zz', label:'الذال والزاي والظاء', ids:['dhal','zay','zza'], pairs:[
      { a:'ذَلَّ', b:'ظَلَّ', da:'dhal', db:'zza' },
      { a:'حَذَرَ', b:'حَظَرَ', da:'dhal', db:'zza' },
      { a:'نَذِيرٌ', b:'نَظِيرٌ', da:'dhal', db:'zza' },
      { a:'زَرَعَ', b:'ذَرَعَ', da:'zay', db:'dhal' } ] },
  { id:'s_sd_th', label:'السين والصاد والثاء', ids:['sin','sad','tha'], pairs:[
      { a:'سَارَ', b:'صَارَ', da:'sin', db:'sad' },
      { a:'سَيْفٌ', b:'صَيْفٌ', da:'sin', db:'sad' },
      { a:'ثَارَ', b:'سَارَ', da:'tha', db:'sin' },
      { a:'بَسَرَ', b:'بَصَرَ', da:'sin', db:'sad' } ] },
  { id:'t_tt', label:'التاء والطاء', ids:['ta','tta'], pairs:[
      { a:'تَابَ', b:'طَابَ', da:'ta', db:'tta' },
      { a:'تِينٌ', b:'طِينٌ', da:'ta', db:'tta' },
      { a:'بَتَّ', b:'بَطَّ', da:'ta', db:'tta' } ] },
  { id:'d_dd', label:'الدال والضاد', ids:['dal','dad'], pairs:[
      { a:'دَلَّ', b:'ضَلَّ', da:'dal', db:'dad' },
      { a:'دَرَّ', b:'ضَرَّ', da:'dal', db:'dad' } ] },
  { id:'h_hh', label:'الهاء والحاء', ids:['ha','hha'], pairs:[
      { a:'هَالَ', b:'حَالَ', da:'ha', db:'hha' },
      { a:'سَهَرَ', b:'سَحَرَ', da:'ha', db:'hha' },
      { a:'نَهْرٌ', b:'نَحْرٌ', da:'ha', db:'hha' } ] },
  { id:'hamza_ain', label:'الهمزة والعين', ids:['hamza','ayn'], pairs:[
      { a:'أَمَلٌ', b:'عَمَلٌ', da:'hamza', db:'ayn' },
      { a:'أَلَمٌ', b:'عَلَمٌ', da:'hamza', db:'ayn' },
      { a:'سَأَلَ', b:'سَعَلَ', da:'hamza', db:'ayn' } ] },
  { id:'k_q', label:'الكاف والقاف', ids:['kaf','qaf'], pairs:[
      { a:'كَلْبٌ', b:'قَلْبٌ', da:'kaf', db:'qaf' },
      { a:'كَادَ', b:'قَادَ', da:'kaf', db:'qaf' },
      { a:'كَبْرٌ', b:'قَبْرٌ', da:'kaf', db:'qaf' } ] }
];

/* ---------------- الضاد والظاء: أشدّ ما يلتبس على الليبيين -------- */
export const DAD_ZA_PAIRS = [
  { dad:'ضَلَّ', za:'ظَلَّ' },
  { dad:'ضَنَّ', za:'ظَنَّ' },
  { dad:'حَضَرَ', za:'حَظَرَ' },
  { dad:'نَضِيرٌ', za:'نَظِيرٌ' },
  { dad:'فَضٌّ', za:'فَظٌّ' },
  { dad:'ضَهَرَ', za:'ظَهَرَ' }
];

/* ---------------- قواعد الوقف ------------------------------------ */
export const WAQF_RULES = [
  { id:'sukkin', name:'تسكين الآخر',
    desc:'إذا وقفتَ على كلمة آخرها متحرك أو منوَّن بضمّ أو كسر، أسكنتَ آخرها.' },
  { id:'ha',     name:'التاء تصير هاءً',
    desc:'التاء المربوطة تُنطق هاءً ساكنة عند الوقف.' },
  { id:'alif',   name:'تنوين الفتح يصير ألفاً',
    desc:'إذا وقفتَ على منوَّن بالفتح، أبدلتَ التنوين ألفاً ممدودة.' }
];

export const WAQF_WORDS = [
  { w:'الْكِتَابُ', stop:'الْكِتَابْ', rule:'sukkin' },
  { w:'الْمُعَلِّمُ', stop:'الْمُعَلِّمْ', rule:'sukkin' },
  { w:'بِالْحَقِّ',  stop:'بِالْحَقّْ',  rule:'sukkin' },
  { w:'الْعَلِيمِ',  stop:'الْعَلِيمْ',  rule:'sukkin' },
  { w:'رَحْمَةٌ',   stop:'رَحْمَهْ',   rule:'ha' },
  { w:'جَنَّةٌ',     stop:'جَنَّهْ',     rule:'ha' },
  { w:'مَدْرَسَةٌ',  stop:'مَدْرَسَهْ',  rule:'ha' },
  { w:'شَجَرَةٌ',   stop:'شَجَرَهْ',   rule:'ha' },
  { w:'كِتَابًا',   stop:'كِتَابَا',   rule:'alif' },
  { w:'عَلِيمًا',   stop:'عَلِيمَا',   rule:'alif' },
  { w:'مَاءً',      stop:'مَاءَا',     rule:'alif' },
  { w:'هُدًى',      stop:'هُدَى',      rule:'alif' }
];

/* ====================================================================
   بنية المنهج: عوالم ← محطات
   ==================================================================== */
export const WORLDS: World[] = [
  {
    id:'w1', title:'الحُروف', subtitle:'الأسماء والأشكال', glyph:'ا',
    stations:[
      { id:'w1s1', title:'تعرَّف على الحروف',   kind:'learn_letters', args:{ from:0,  to:10 } },
      { id:'w1s2', title:'من الجيم إلى الضاد',  kind:'learn_letters', args:{ from:10, to:20 } },
      { id:'w1s3', title:'من الطاء إلى الهمزة', kind:'learn_letters', args:{ from:20, to:29 } },
      { id:'w1s4', title:'اسمعْ واختَرْ',        kind:'letter_by_audio' },
      { id:'w1s5', title:'الحروف المتشابهة',    kind:'similar_letters' },
      { id:'w1s6', title:'ترتيب الحروف',        kind:'order_letters' },
      { id:'w1s7', title:'أشكال الحرف',         kind:'letter_forms' },
      { id:'w1s8', title:'موقع الحرف',          kind:'letter_position' },
      { id:'w1s11',title:'مخارج الحروف',        kind:'learn_makharij' },
      { id:'w1s12',title:'من أين يخرج الحرف؟',   kind:'makhraj_pick' },
      { id:'w1s9', title:'المتشابهة صوتاً',      kind:'sound_similar' },
      { id:'w1s10',title:'الضاد والظاء',        kind:'dad_za' },
      { id:'w1x',  title:'اختبار عالم الحروف',  kind:'exam', exam:true }
    ]
  },
  {
    id:'w1b', title:'المركّبة والمقطّعة', subtitle:'اقرأ بالهجاء لا بالصوت', glyph:'الم',
    stations:[
      { id:'w1bs1', title:'الحروف المركّبة',      kind:'composite' },
      { id:'w1bs2', title:'فواتح السور',          kind:'learn_muqattaat' },
      { id:'w1bs3', title:'اقرأ الحروف المقطّعة',  kind:'muqattaa_read' },
      { id:'w1bs4', title:'مدود الحروف المقطّعة', kind:'muqattaa_madd' },
      { id:'w1bx',  title:'اختبار المقطّعة',       kind:'exam', exam:true }
    ]
  },
  {
    id:'w2', title:'الحَرَكات', subtitle:'فتحة وضمة وكسرة', glyph:'\u0640\u064E',
    stations:[
      { id:'w2s1', title:'الحروف المفتوحة',  kind:'harakah_drill', args:{ harakah:'fatha' } },
      { id:'w2s2', title:'الحروف المضمومة',  kind:'harakah_drill', args:{ harakah:'damma' } },
      { id:'w2s3', title:'الحروف المكسورة',  kind:'harakah_drill', args:{ harakah:'kasra' } },
      { id:'w2s4', title:'صيد الحركة',       kind:'harakah_hunt' },
      { id:'w2s8', title:'التهجّي',           kind:'spell_drill' },
      { id:'w2s9', title:'عائلات فَعَلَ',      kind:'family_read', args:{ tier:3 } },
      { id:'w2s5', title:'كلمات مفتوحة',     kind:'read_words', args:{ bank:'fatha' } },
      { id:'w2s6', title:'كلمات مضمومة',     kind:'read_words', args:{ bank:'damma' } },
      { id:'w2s7', title:'كلمات مكسورة',     kind:'read_words', args:{ bank:'kasra' } },
      { id:'w2x',  title:'اختبار الحركات',   kind:'exam', exam:true }
    ]
  },
  {
    id:'w3', title:'التَّنوين', subtitle:'فتحتان وضمتان وكسرتان', glyph:'\u0640\u064B',
    stations:[
      { id:'w3s1', title:'الفتحتان',         kind:'harakah_drill', args:{ harakah:'fathatan' } },
      { id:'w3s2', title:'الضمتان',          kind:'harakah_drill', args:{ harakah:'dammatan' } },
      { id:'w3s3', title:'الكسرتان',         kind:'harakah_drill', args:{ harakah:'kasratan' } },
      { id:'w3s4', title:'كلمات منوَّنة',     kind:'read_words', args:{ bank:'tanween' } },
      { id:'w3s5', title:'حركة أم تنوين؟',   kind:'harakah_hunt', args:{ pool:'tanween' } },
      { id:'w3x',  title:'اختبار التنوين',   kind:'exam', exam:true }
    ]
  },
  {
    id:'w4', title:'السُّكون', subtitle:'مهارة النطق بحرفين', glyph:'\u0640\u0652',
    stations:[
      { id:'w4s1', title:'حرفان مُرقَّقان',   kind:'syllable_drill', args:{ set:'raqiq' } },
      { id:'w4s2', title:'حرفان مُفخَّمان',   kind:'syllable_drill', args:{ set:'mufakham' } },
      { id:'w4s3', title:'كلمات ساكنة',      kind:'read_words', args:{ bank:'sukun' } },
      { id:'w4s4', title:'القَلْقَلة',         kind:'qalqala' },
      { id:'w4s5', title:'مقاطع مغلقة',      kind:'cvc_read' },
      { id:'w4s6', title:'اسمع المقطع',      kind:'cvc_pick' },
      { id:'w4x',  title:'اختبار السكون',    kind:'exam', exam:true }
    ]
  },
  {
    id:'w5', title:'الشَّدَّة', subtitle:'الحرف المشدَّد', glyph:'\u0640\u0651',
    stations:[
      { id:'w5s1', title:'الحروف المشدَّدة',  kind:'shadda_drill' },
      { id:'w5s2', title:'كلمات مشدَّدة',     kind:'read_words', args:{ bank:'shadda' } },
      { id:'w5s3', title:'مشدَّد أم ساكن؟',   kind:'shadda_contrast' },
      { id:'w5s4', title:'عائلات المضعَّف',   kind:'family_read', args:{ tier:2 } },
      { id:'w5s5', title:'شدّة ومدّ معاً',     kind:'shadda_madd' },
      { id:'w5x',  title:'اختبار الشدة',     kind:'exam', exam:true }
    ]
  },
  {
    id:'w6', title:'المُدود', subtitle:'الأصلية والفرعية', glyph:'\u0622',
    stations:[
      { id:'w6s1', title:'المد بالألف',       kind:'read_words', args:{ bank:'madd_alif' } },
      { id:'w6s2', title:'المد بالواو',       kind:'read_words', args:{ bank:'madd_waw' } },
      { id:'w6s3', title:'المد بالياء',       kind:'read_words', args:{ bank:'madd_ya' } },
      { id:'w6s4', title:'حروف اللين',        kind:'read_words', args:{ bank:'leen' } },
      { id:'w6s5', title:'مدٌّ أم لين؟',       kind:'madd_contrast' },
      { id:'w6s6b',title:'عائلات المدّ',      kind:'family_read', args:{ tier:1 } },
      { id:'w6s6', title:'أنواع المد الفرعي', kind:'learn_madd' },
      { id:'w6s7', title:'ما نوع المد؟',      kind:'madd_type' },
      { id:'w6x',  title:'اختبار المدود',     kind:'exam', exam:true }
    ]
  },
  {
    id:'wf', title:'عائلات الكلمات', subtitle:'النهاية ثابتة والأول يتغيّر', glyph:'ـَلَّ',
    stations:[
      { id:'wfs1', title:'عائلات فَعَلَ',        kind:'family_learn', args:{ tier:3, count:6 } },
      { id:'wfs2', title:'عائلات المضعَّف',      kind:'family_learn', args:{ tier:2, count:6 } },
      { id:'wfs3', title:'عائلات المدّ',         kind:'family_learn', args:{ tier:1, count:6 } },
      { id:'wfs4', title:'اسمع واختر من العائلة', kind:'family_pick' },
      { id:'wfs5', title:'الدخيلة على العائلة',  kind:'family_odd' },
      { id:'wfs6', title:'قراءة متدرّجة',        kind:'family_read' },
      { id:'wfx',  title:'اختبار العائلات',      kind:'exam', exam:true }
    ]
  },
  {
    id:'w7', title:'القِراءة', subtitle:'الكلمة ثم الجملة', glyph:'ق',
    stations:[
      { id:'w7s1', title:'ابنِ الكلمة',              kind:'build_word' },
      { id:'w7s2', title:'اللام الشمسية والقمرية',   kind:'lam_rule' },
      { id:'w7s3', title:'همزة الوصل والقطع',        kind:'hamza_rule' },
      { id:'w7s4', title:'التاء المربوطة والمفتوحة', kind:'ta_rule' },
      { id:'w7s5', title:'الألف المقصورة والممدودة', kind:'alif_rule' },
      { id:'w7s7', title:'فُكّ الكلمة',               kind:'decompose' },
      { id:'w7s8', title:'قواعد الوقف',              kind:'waqf_rule' },
      { id:'w7s6', title:'اقرأ الجملة',              kind:'read_sentence' },
      { id:'w7x',  title:'اختبار القراءة',           kind:'exam', exam:true }
    ]
  },
  {
    id:'w8', title:'النُّون السَّاكِنة', subtitle:'إظهار وإدغام وإقلاب وإخفاء', glyph:'\u06DD',
    stations:[
      { id:'w8s1', title:'تعرَّف على الأحكام', kind:'learn_rules' },
      { id:'w8s2', title:'ما الحكم؟',        kind:'rule_pick' },
      { id:'w8s3', title:'حروف كل حكم',      kind:'rule_letters' },
      { id:'w8x',  title:'اختبار النون',     kind:'exam', exam:true }
    ]
  },
  {
    id:'w9', title:'المِيم السَّاكِنة', subtitle:'إخفاء وإدغام وإظهار شفوي', glyph:'\u0645\u0652',
    stations:[
      { id:'w9s1', title:'أحكام الميم الثلاثة', kind:'learn_meem' },
      { id:'w9s2', title:'ما حكم الميم؟',      kind:'meem_pick' },
      { id:'w9s3', title:'نون أم ميم؟',        kind:'noon_meem_mix' },
      { id:'w9s4', title:'الغنّة',              kind:'ghunna' },
      { id:'w9x',  title:'اختبار الميم',       kind:'exam', exam:true }
    ]
  },
  {
    id:'w10', title:'التَّفخيم والتَّرقيق', subtitle:'الراء ولام لفظ الجلالة', glyph:'ر',
    stations:[
      { id:'w10s1', title:'قاعدتا الراء',      kind:'learn_ra' },
      { id:'w10s2', title:'مفخَّمة أم مرقَّقة؟', kind:'ra_rule' },
      { id:'w10s3', title:'لام لفظ الجلالة',   kind:'lam_jalala' },
      { id:'w10x',  title:'اختبار التفخيم',    kind:'exam', exam:true }
    ]
  },
  {
    id:'wq', title:'التِّلاوة', subtitle:'قراءة المصحف وثمرة الإتقان', glyph:'۞',
    stations:[
      { id:'wqs1', title:'الألف الخنجرية',      kind:'dagger_alif' },
      { id:'wqs2', title:'حروف تُكتب ولا تُنطق', kind:'silent_letters' },
      { id:'wqs3', title:'علامات الوقف',        kind:'learn_waqf_marks' },
      { id:'wqs4', title:'ما حكم العلامة؟',     kind:'waqf_mark_pick' },
      { id:'wqs5', title:'سورة الفاتحة',        kind:'recite', args:{ surah:'fatiha' } },
      { id:'wqs6', title:'العصر والكوثر والنصر', kind:'recite_mixed' },
      { id:'wqs7', title:'المعوّذات والإخلاص',   kind:'recite', args:{ surah:'nas' } },
      { id:'wqs8', title:'تلاوة مختلطة',        kind:'recite_mixed' },
      { id:'wqx',  title:'اختبار التلاوة',      kind:'exam', exam:true },
      { id:'wqf',  title:'امتحان التخرّج',       kind:'final_exam', exam:true, final:true }
    ]
  }
];

export const RANKS = [
  { xp:0,     title:'مُبتدِئ' },
  { xp:300,   title:'قارئ ناشئ' },
  { xp:900,   title:'قارئ' },
  { xp:2000,  title:'قارئ مُجيد' },
  { xp:4000,  title:'مُتقِن' },
  { xp:7000,  title:'مُتقِن مُجوِّد' },
  { xp:12000, title:'جَهبَذ' },
  { xp:18000, title:'شَيخ الجَهابِذة' }
];

export const BADGES = [
  { id:'first_steps', title:'أول الطريق',    desc:'أكملتَ أول محطة',                      icon:'flag' },
  { id:'letters',     title:'صاحب الحروف',   desc:'أتقنتَ عالم الحروف كاملاً',             icon:'alef' },
  { id:'perfect',     title:'إجابة كاملة',   desc:'محطة بلا خطأ واحد',                    icon:'star' },
  { id:'streak3',     title:'ثلاثة أيام',    desc:'تدرّبتَ ثلاثة أيام متتالية',            icon:'fire' },
  { id:'streak7',     title:'أسبوع كامل',    desc:'تدرّبتَ سبعة أيام متتالية',             icon:'fire' },
  { id:'review50',    title:'المراجِع',      desc:'راجعتَ خمسين بطاقة من صندوق المراجعة',  icon:'repeat' },
  { id:'speed',       title:'سريع البديهة',  desc:'عشر إجابات صحيحة متتالية',             icon:'bolt' },
  { id:'tajweed',     title:'مُجوِّد',        desc:'أتقنتَ عالم التجويد',                   icon:'book' },
  { id:'reciter',     title:'التالي',        desc:'أتممتَ عالم التلاوة وقرأتَ قصار السور',    icon:'book' },
  { id:'families',    title:'صاحب العائلات', desc:'أتقنتَ عائلات الكلمات الخمس والأربعين',  icon:'alef' },
  { id:'muqattaat',   title:'قارئ الفواتح',  desc:'أتقنتَ الحروف المقطّعة ومدودها',        icon:'book' },
  { id:'meem',        title:'ضابط الميم',    desc:'أتقنتَ أحكام الميم الساكنة',            icon:'book' },
  { id:'tafkheem',    title:'صاحب التفخيم',  desc:'أتقنتَ الراء ولام لفظ الجلالة',          icon:'bolt' },
  { id:'graduate',    title:'خِرِّيج القاعدة', desc:'اجتزتَ امتحان التخرّج الشامل',             icon:'medal' }
];
