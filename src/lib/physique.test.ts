import { setsByMuscle } from './metrics';
import { levelFor, partLevels, partProgress, PARTS } from './physique';

describe('setsByMuscle', () => {
  it('counts one per completed set, grouped by muscle', () => {
    expect(
      setsByMuscle([
        { reps: 10, muscle: 'Chest' },
        { reps: 8, muscle: 'Chest' },
        { reps: 12, muscle: 'Biceps' },
      ])
    ).toEqual({ Chest: 2, Biceps: 1 });
  });

  it('ignores sets with no reps logged (e.g. cardio / empty)', () => {
    expect(setsByMuscle([{ reps: null, muscle: 'Chest' }, { reps: 5, muscle: 'Chest' }])).toEqual({
      Chest: 1,
    });
  });
});

describe('levelFor', () => {
  it('maps completion ratio to a 0..3 level', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(0.01)).toBe(1);
    expect(levelFor(0.39)).toBe(1);
    expect(levelFor(0.4)).toBe(2);
    expect(levelFor(0.74)).toBe(2);
    expect(levelFor(0.75)).toBe(3);
    expect(levelFor(1)).toBe(3);
  });
});

describe('partProgress', () => {
  it('rolls fine muscle groups into their body part', () => {
    // Arms = Biceps + Triceps + Forearms + Grip
    const p = partProgress({ Biceps: 6, Triceps: 4 });
    expect(p.arms.sets).toBe(10);
  });

  it('caps pct at 1 and derives the level', () => {
    const chest = PARTS.find((x) => x.key === 'chest')!;
    const p = partProgress({ Chest: chest.target + 5 });
    expect(p.chest.pct).toBe(1);
    expect(p.chest.level).toBe(3);
  });

  it('leaves an untrained part at level 0', () => {
    const p = partProgress({});
    expect(p.legs.sets).toBe(0);
    expect(p.legs.level).toBe(0);
  });

  it('partLevels projects just the level per part', () => {
    const levels = partLevels(partProgress({ Core: 100 }));
    expect(levels.abs).toBe(3);
    expect(levels.chest).toBe(0);
  });
});
