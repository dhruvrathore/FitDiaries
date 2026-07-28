import {
  anyPR,
  currentRecords,
  detectPRs,
  epley1RM,
  prEvents,
  setVolume,
  totalVolume,
  volumeByMuscle,
} from './metrics';

describe('volume', () => {
  it('multiplies weight by reps', () => {
    expect(setVolume({ weight: 45, reps: 10 })).toBe(450);
  });

  it('treats null weight/reps as zero', () => {
    expect(setVolume({ weight: null, reps: 10 })).toBe(0);
    expect(setVolume({ weight: 20, reps: null })).toBe(0);
  });

  it('sums a session', () => {
    expect(
      totalVolume([
        { weight: 45, reps: 10 },
        { weight: 52, reps: 6 },
      ])
    ).toBe(450 + 312);
  });

  it('groups volume by muscle', () => {
    const out = volumeByMuscle([
      { weight: 45, reps: 10, muscle: 'Back / Lats' }, // 450
      { weight: 30, reps: 5, muscle: 'Back / Lats' }, // 150
      { weight: 20, reps: 12, muscle: 'Biceps' }, // 240
      { weight: null, reps: 12, muscle: 'Cardio' }, // 0, dropped
    ]);
    expect(out).toEqual({ 'Back / Lats': 600, Biceps: 240 });
  });
});

describe('epley1RM', () => {
  it('equals weight at 1 rep', () => {
    expect(epley1RM(100, 1)).toBeCloseTo(100 * (1 + 1 / 30));
  });
  it('rewards more reps', () => {
    expect(epley1RM(60, 10)).toBeGreaterThan(epley1RM(60, 5));
  });
});

describe('detectPRs', () => {
  it('flags nothing for the first-ever set (baseline)', () => {
    expect(detectPRs([], { weight: 45, reps: 10 })).toEqual({
      heaviest: false,
      oneRm: false,
      repsAtWeight: false,
    });
  });

  it('flags heaviest when lifting more than ever', () => {
    const f = detectPRs([{ weight: 45, reps: 10 }], { weight: 50, reps: 3 });
    expect(f.heaviest).toBe(true);
  });

  it('flags most reps at a used weight', () => {
    const f = detectPRs(
      [
        { weight: 45, reps: 8 },
        { weight: 45, reps: 10 },
      ],
      { weight: 45, reps: 11 }
    );
    expect(f.repsAtWeight).toBe(true);
    expect(f.heaviest).toBe(false);
  });

  it('does not flag reps@weight for a brand-new weight', () => {
    const f = detectPRs([{ weight: 45, reps: 10 }], { weight: 40, reps: 20 });
    expect(f.repsAtWeight).toBe(false);
  });

  it('flags a 1RM PR when more reps at the same top weight', () => {
    const f = detectPRs([{ weight: 45, reps: 8 }], { weight: 45, reps: 12 });
    expect(f.oneRm).toBe(true);
    expect(anyPR(f)).toBe(true);
  });

  it('flags no 1RM PR when strictly worse', () => {
    const f = detectPRs([{ weight: 45, reps: 12 }], { weight: 45, reps: 8 });
    expect(f.oneRm).toBe(false);
  });
});

describe('prEvents', () => {
  it('walks history chronologically and skips the first set', () => {
    const events = prEvents([
      { weight: 45, reps: 8, at: 1 }, // baseline, no event
      { weight: 50, reps: 8, at: 2 }, // heaviest + oneRm
      { weight: 45, reps: 12, at: 3 }, // repsAtWeight (45 used before)
    ]);
    const types = events.map((e) => `${e.type}@${e.at}`);
    expect(types).toContain('heaviest@2');
    expect(types).toContain('oneRm@2');
    expect(types).toContain('repsAtWeight@3');
    // first set emits nothing
    expect(events.every((e) => e.at !== 1)).toBe(true);
  });
});

describe('currentRecords', () => {
  it('returns nulls with no counted sets', () => {
    expect(currentRecords([{ weight: null, reps: 5 }])).toEqual({
      heaviest: null,
      bestOneRm: null,
      bestOneRmAt: null,
    });
  });

  it('finds heaviest and best 1RM', () => {
    // epley(60,3)=66 beats epley(45,12)=63, so 60×3 is the best 1RM set.
    const r = currentRecords([
      { weight: 45, reps: 12 },
      { weight: 60, reps: 3 },
    ]);
    expect(r.heaviest).toBe(60);
    expect(r.bestOneRm).toBeCloseTo(epley1RM(60, 3));
    expect(r.bestOneRmAt).toEqual({ weight: 60, reps: 3 });
  });
});
