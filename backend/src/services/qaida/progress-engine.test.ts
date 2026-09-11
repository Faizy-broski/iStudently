import { 
  applySession, 
  calculateAccuracy, 
  calculateStars, 
  evaluateBadges, 
  QaidaState, 
  SessionSubmission 
} from './progress-engine';

describe('progress-engine', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-11T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('calculateAccuracy', () => {
    it('returns 0 for empty or null items', () => {
      expect(calculateAccuracy([])).toBe(0);
      expect(calculateAccuracy(null as any)).toBe(0);
    });

    it('calculates correct percentages with rounding', () => {
      expect(calculateAccuracy([{ correct: true }])).toBe(100);
      expect(calculateAccuracy([{ correct: false }])).toBe(0);
      expect(calculateAccuracy([
        { correct: true },
        { correct: false },
        { correct: false }
      ])).toBe(33.33);
    });
  });

  describe('calculateStars', () => {
    it('returns correct stars based on accuracy thresholds', () => {
      expect(calculateStars(100)).toBe(3);
      expect(calculateStars(95)).toBe(3);
      expect(calculateStars(94.9)).toBe(2);
      expect(calculateStars(80)).toBe(2);
      expect(calculateStars(79.9)).toBe(1);
      expect(calculateStars(60)).toBe(1);
      expect(calculateStars(59.9)).toBe(0);
      expect(calculateStars(0)).toBe(0);
    });
  });

  describe('evaluateBadges', () => {
    const baseState: QaidaState = { srs: {}, stationAttempts: {}, badgesUnlocked: [] };
    
    it('awards perfect_station for 100% accuracy', () => {
      const badges = evaluateBadges(baseState, { seconds: 60, items: [{ key: '1', correct: true }] } as any, 100, 3);
      expect(badges).toContain('perfect_station');
    });

    it('does not award perfect_station if already unlocked', () => {
      const state = { ...baseState, badgesUnlocked: ['perfect_station'] };
      const badges = evaluateBadges(state, { seconds: 60, items: [{ key: '1', correct: true }] } as any, 100, 3);
      expect(badges).not.toContain('perfect_station');
    });

    it('awards speed_demon for fast, accurate sessions', () => {
      const items = Array(10).fill({ key: '1', correct: true });
      const badges = evaluateBadges(baseState, { seconds: 25, items } as any, 80, 2);
      expect(badges).toContain('speed_demon');
    });

    it('does not award speed_demon if not enough items or too slow or inaccurate', () => {
      const items = Array(10).fill({ key: '1', correct: true });
      expect(evaluateBadges(baseState, { seconds: 35, items } as any, 80, 2)).not.toContain('speed_demon'); // Too slow
      expect(evaluateBadges(baseState, { seconds: 25, items: items.slice(0, 5) } as any, 80, 2)).not.toContain('speed_demon'); // Not enough items
      expect(evaluateBadges(baseState, { seconds: 25, items } as any, 79, 1)).not.toContain('speed_demon'); // Not accurate enough
    });

    it('does not award speed_demon if already unlocked', () => {
      const state = { ...baseState, badgesUnlocked: ['speed_demon'] };
      const items = Array(10).fill({ correct: true });
      const badges = evaluateBadges(state, { seconds: 25, items } as any, 100, 3);
      expect(badges).not.toContain('speed_demon');
    });
  });

  describe('applySession', () => {
    const getInitialState = (): QaidaState => ({
      srs: {},
      stationAttempts: {},
      badgesUnlocked: []
    });

    const getBaseSubmission = (): SessionSubmission => ({
      worldId: '1',
      stationId: 'W1_S1',
      isReview: false,
      seconds: 45,
      items: [
        { key: 'item1', correct: true },
        { key: 'item2', correct: false }
      ],
      overallAccuracyBeforeSession: 0
    });

    it('safely handles missing state properties', () => {
      const result = applySession({} as any, getBaseSubmission());
      expect(result.newState.srs).toBeDefined();
      expect(result.newState.stationAttempts).toBeDefined();
      expect(result.newState.badgesUnlocked).toBeDefined();
    });

    it('safely handles missing submission items', () => {
      const sub = getBaseSubmission();
      sub.items = null as any;
      const result = applySession(getInitialState(), sub);
      expect(result.accuracy).toBe(0);
      expect(result.stars).toBe(0);
    });

    it('updates attempts count', () => {
      const state = getInitialState();
      state.stationAttempts['W1_S1'] = 2;
      const result = applySession(state, getBaseSubmission());
      expect(result.newState.stationAttempts['W1_S1']).toBe(3);
    });

    it('updates SRS boxes correctly', () => {
      const state = getInitialState();
      state.srs['item1'] = { box: 2, lastSeen: 0 }; // Will be correct -> box 3
      state.srs['item2'] = { box: 3, lastSeen: 0 }; // Will be incorrect -> box 1
      state.srs['item3'] = { box: 5, lastSeen: 0 }; // Not tested this session
      
      const sub = getBaseSubmission();
      sub.items = [
        { key: 'item1', correct: true },
        { key: 'item2', correct: false },
        { key: 'item4', correct: true } // New item -> box 1 then +1 = min(0+1, 5)? Wait.
        // Actually, if it's new, currentBox = 0. If correct, newBox = 1.
      ];

      const result = applySession(state, sub);
      
      expect(result.newState.srs['item1'].box).toBe(3);
      expect(result.newState.srs['item2'].box).toBe(1);
      expect(result.newState.srs['item3'].box).toBe(5); // Unchanged
      expect(result.newState.srs['item4'].box).toBe(1); // New correct
    });

    it('caps SRS box at 5', () => {
      const state = getInitialState();
      state.srs['item1'] = { box: 5, lastSeen: 0 };
      
      const sub = getBaseSubmission();
      sub.items = [{ key: 'item1', correct: true }];
      
      const result = applySession(state, sub);
      expect(result.newState.srs['item1'].box).toBe(5);
    });

    it('calculates XP correctly', () => {
      const state = getInitialState();
      const sub = getBaseSubmission();
      sub.items = [{ key: 'item1', correct: true }]; // 100% -> 3 stars
      
      // Normal session (3 stars): 10 base + (3 * 5) = 25 XP
      let result = applySession(state, sub);
      expect(result.xpAwarded).toBe(25);
      
      // Review session (3 stars): 10 base + (3 * 5) + 5 review = 30 XP
      sub.isReview = true;
      result = applySession(state, sub);
      expect(result.xpAwarded).toBe(30);
      
      // 0 stars: 0 XP
      sub.items = [{ key: 'item1', correct: false }];
      result = applySession(state, sub);
      expect(result.xpAwarded).toBe(0);
    });

    it('handles graduation logic', () => {
      const state = getInitialState();
      const sub = getBaseSubmission();
      sub.worldId = '13';
      sub.items = [{ key: '1', correct: true }]; // 100% accuracy this session
      
      // Case 1: Overall accuracy would drop below 90
      sub.overallAccuracyBeforeSession = 80;
      let result = applySession(state, sub);
      expect(result.graduated).toBe(false);
      
      // Case 2: Overall accuracy stays >= 90
      sub.overallAccuracyBeforeSession = 95;
      result = applySession(state, sub);
      expect(result.graduated).toBe(true);

      // Case 3: World is not 13
      sub.worldId = '12';
      result = applySession(state, sub);
      expect(result.graduated).toBe(false);
      
      // Case 4: Session accuracy < 90
      sub.worldId = '13';
      sub.items = [{ key: '1', correct: false }]; // 0%
      result = applySession(state, sub);
      expect(result.graduated).toBe(false);
    });
  });
});
