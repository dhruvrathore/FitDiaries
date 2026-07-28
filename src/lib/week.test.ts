import {
  deloadWeekIndex,
  fromISODate,
  isDeloadWeek,
  mondayOf,
  relativeWeekLabel,
  toISODate,
  weekRange,
  weeksSinceCycleStart,
} from './week';

describe('mondayOf', () => {
  it('returns the same Monday for any day that week', () => {
    // 2026-07-20 is a Monday.
    const monday = '2026-07-20';
    for (const d of ['2026-07-20', '2026-07-22', '2026-07-26']) {
      expect(toISODate(mondayOf(fromISODate(d)))).toBe(monday);
    }
  });

  it('maps Sunday back to the preceding Monday', () => {
    // 2026-07-26 is a Sunday.
    expect(toISODate(mondayOf(fromISODate('2026-07-26')))).toBe('2026-07-20');
  });
});

describe('weekRange', () => {
  it('spans exactly 7 days', () => {
    const { startMs, endMs } = weekRange(fromISODate('2026-07-22'));
    expect(endMs - startMs).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('relativeWeekLabel', () => {
  // 2026-07-22 is a Wednesday; its Monday is 2026-07-20.
  const now = fromISODate('2026-07-22');

  it('labels the current and previous week', () => {
    expect(relativeWeekLabel(fromISODate('2026-07-20'), now)).toBe('This week');
    expect(relativeWeekLabel(fromISODate('2026-07-25'), now)).toBe('This week'); // same week, later day
    expect(relativeWeekLabel(fromISODate('2026-07-13'), now)).toBe('Last week');
  });

  it('returns null for older weeks', () => {
    expect(relativeWeekLabel(fromISODate('2026-07-06'), now)).toBeNull();
    expect(relativeWeekLabel(fromISODate('2026-06-01'), now)).toBeNull();
  });
});

describe('deload cycle', () => {
  const start = '2026-07-20'; // Monday, week 1 of the cycle

  it('counts whole weeks since cycle start', () => {
    expect(weeksSinceCycleStart(fromISODate('2026-07-20'), start)).toBe(0);
    expect(weeksSinceCycleStart(fromISODate('2026-07-27'), start)).toBe(1);
    expect(weeksSinceCycleStart(fromISODate('2026-08-10'), start)).toBe(3);
  });

  it('makes every 4th week a deload week', () => {
    expect(deloadWeekIndex(fromISODate('2026-07-20'), start)).toBe(1);
    expect(deloadWeekIndex(fromISODate('2026-07-27'), start)).toBe(2);
    expect(deloadWeekIndex(fromISODate('2026-08-03'), start)).toBe(3);
    expect(deloadWeekIndex(fromISODate('2026-08-10'), start)).toBe(4);
    expect(isDeloadWeek(fromISODate('2026-08-10'), start)).toBe(true);
    expect(isDeloadWeek(fromISODate('2026-07-20'), start)).toBe(false);
    // cycle repeats
    expect(isDeloadWeek(fromISODate('2026-09-07'), start)).toBe(true);
  });
});
