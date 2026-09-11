export interface LetterDef {
  isolated: string;
  initial: string;
  medial: string;
  final: string;
  audioId: string;
}

export const LETTERS: Record<string, LetterDef> = {
  alif: { isolated: 'ا', initial: 'ا', medial: 'ـا', final: 'ـا', audioId: 'alif' },
  baa: { isolated: 'ب', initial: 'بـ', medial: 'ـبـ', final: 'ـب', audioId: 'baa' },
  taa: { isolated: 'ت', initial: 'تـ', medial: 'ـتـ', final: 'ـت', audioId: 'taa' },
  thaa: { isolated: 'ث', initial: 'ثـ', medial: 'ـثـ', final: 'ـث', audioId: 'thaa' },
  jiim: { isolated: 'ج', initial: 'جـ', medial: 'ـجـ', final: 'ـج', audioId: 'jiim' },
  haa: { isolated: 'ح', initial: 'حـ', medial: 'ـحـ', final: 'ـح', audioId: 'haa' },
  khaa: { isolated: 'خ', initial: 'خـ', medial: 'ـخـ', final: 'ـخ', audioId: 'khaa' }
};

export const WORLDS = [
  {
    id: '1',
    title: 'The Isolated Letters',
    stations: [
      { id: 'W1_S1', title: 'Alif to Thaa', activityTypes: ['letter_recognition'], contentKeys: ['alif', 'baa', 'taa', 'thaa'] },
      { id: 'W1_S2', title: 'Jiim to Khaa', activityTypes: ['letter_recognition'], contentKeys: ['jiim', 'haa', 'khaa'] }
    ]
  },
  {
    id: '2',
    title: 'Letter Forms',
    stations: [
      { id: 'W2_S1', title: 'Forms of Baa, Taa, Thaa', activityTypes: ['form_matching'], contentKeys: ['baa', 'taa', 'thaa'] },
      { id: 'W2_S2', title: 'Forms of Jiim, Haa, Khaa', activityTypes: ['form_matching'], contentKeys: ['jiim', 'haa', 'khaa'] }
    ]
  }
];

export const WORD_BANKS = {};
export const FAMILIES = {};
