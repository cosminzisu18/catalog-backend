import {
  likePattern,
  normalizeListQuery,
  resolveSort,
  toPaginated,
} from './pagination.util';

describe('pagination utils', () => {
  it('clamps page and pageSize', () => {
    const q = normalizeListQuery({ page: -3, pageSize: 5000 });
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(100);
    expect(q.skip).toBe(0);
  });

  it('accepts only ASC/DESC as sort order', () => {
    expect(normalizeListQuery({ sortOrder: 'desc' }).sortOrder).toBe('DESC');
    expect(normalizeListQuery({ sortOrder: 'DROP TABLE' }).sortOrder).toBe(
      'ASC',
    );
  });

  it('maps sortBy only through the allowed columns', () => {
    const allowed = { name: 'subject.name', createdAt: 'subject.createdAt' };
    expect(resolveSort('createdAt', allowed, 'name')).toBe('subject.createdAt');
    expect(resolveSort('name; DROP TABLE users', allowed, 'name')).toBe(
      'subject.name',
    );
  });

  it('escapes LIKE wildcards from user input', () => {
    expect(likePattern('9_A%')).toBe('%9\\_A\\%%');
    expect(likePattern('a\\b')).toBe('%a\\\\b%');
  });

  it('computes total pages', () => {
    expect(toPaginated([], 0, 1, 10).totalPages).toBe(1);
    expect(toPaginated([], 21, 1, 10).totalPages).toBe(3);
  });
});
