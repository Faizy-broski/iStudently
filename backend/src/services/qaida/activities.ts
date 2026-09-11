import { LETTERS } from './content';

export interface ActivityItem {
  key: string;
  prompt: string;
  options: { key: string; label: string }[];
}

export function shuffle<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function getRandomDistractors(correctKey: string, count: number): string[] {
  const allKeys = Object.keys(LETTERS).filter(k => k !== correctKey);
  return shuffle(allKeys).slice(0, count);
}

export type ActivityGenerator = (targetKey: string) => ActivityItem;

export const generators: Record<string, ActivityGenerator> = {
  letter_recognition: (targetKey: string): ActivityItem => {
    const distractors = getRandomDistractors(targetKey, 3);
    
    const options = [targetKey, ...distractors].map(k => ({
      key: k,
      label: LETTERS[k].isolated
    }));

    return {
      key: targetKey,
      prompt: targetKey,
      options: shuffle(options)
    };
  },
  
  form_matching: (targetKey: string): ActivityItem => {
    const targetLetter = LETTERS[targetKey];
    const distractors = getRandomDistractors(targetKey, 3);
    
    const options = [targetKey, ...distractors].map(k => ({
      key: k,
      label: LETTERS[k].initial
    }));

    return {
      key: targetKey,
      prompt: targetLetter.isolated,
      options: shuffle(options)
    };
  }
};
