import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SortOrder = 'ASC' | 'DESC';

export function normalizeListQuery(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 10));
  const search = (input.search || '').trim();
  const sortBy = (input.sortBy || '').trim();
  const sortOrder: SortOrder =
    String(input.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  return {
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    skip: (page - 1) * pageSize,
  };
}

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
  };
}

// sortBy comes from the query string, so it never goes into SQL as is:
// we map it through a list of allowed columns
export function resolveSort(
  sortBy: string,
  allowed: Record<string, string>,
  fallback: string,
): string {
  return allowed[sortBy] ?? allowed[fallback];
}

// % and _ in a search are plain text, not wildcards
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<T>> {
  const [items, total] = await qb
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .getManyAndCount();
  return toPaginated(items, total, page, pageSize);
}
