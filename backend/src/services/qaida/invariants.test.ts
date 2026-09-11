import { generators } from './activities';
import { LETTERS } from './content';

describe('Qaida Invariants', () => {
  describe('Generator constraints', () => {
    const letterKeys = Object.keys(LETTERS);
    const TEST_RUNS = 12;

    Object.entries(generators).forEach(([activityType, generator]) => {
      describe(`Generator: ${activityType}`, () => {
        it('always includes the correct answer in its options list', () => {
          // Test multiple randomized runs (12) per brief requirement
          for (let run = 0; run < TEST_RUNS; run++) {
            // Pick a random valid target key for the test run
            const randomTargetKey = letterKeys[Math.floor(Math.random() * letterKeys.length)];
            
            const result = generator(randomTargetKey);
            
            // Invariant 1: The correct key matches the requested target
            expect(result.key).toBe(randomTargetKey);
            
            // Invariant 2: The options array contains an object where option.key === result.key
            const correctOptionPresent = result.options.some(opt => opt.key === result.key);
            expect(correctOptionPresent).toBe(true);
            
            // Invariant 3: Options must be exactly 4 (target + 3 distractors) if available
            // Since we have 7 letters total right now, we can always get 3 distractors.
            expect(result.options.length).toBe(4);
            
            // Invariant 4: No duplicate keys in options
            const uniqueKeys = new Set(result.options.map(o => o.key));
            expect(uniqueKeys.size).toBe(result.options.length);
          }
        });
      });
    });
  });
});
