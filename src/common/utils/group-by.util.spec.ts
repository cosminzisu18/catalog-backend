import { groupBy } from './group-by.util';

describe('groupBy', () => {
  it('groups rows by key and keeps their order', () => {
    const rows = [
      { subjectId: 1, value: 9 },
      { subjectId: 2, value: 7 },
      { subjectId: 1, value: 10 },
    ];
    const groups = groupBy(rows, (r) => r.subjectId);
    expect([...groups.keys()]).toEqual([1, 2]);
    expect(groups.get(1)!.map((r) => r.value)).toEqual([9, 10]);
  });

  it('returns an empty map for no rows', () => {
    expect(groupBy([], () => 1).size).toBe(0);
  });
});
