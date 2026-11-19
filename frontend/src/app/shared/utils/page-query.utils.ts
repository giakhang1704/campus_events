import { ParamMap, Router } from '@angular/router';

/**
 * Lists keep their page in the URL as a 1-based `?page=2` (page 1 has no parameter),
 * while the API counts pages from 0.
 */
export function pageFromQuery(query: ParamMap): number {
  return Math.max(0, (Number(query.get('page')) || 1) - 1);
}

/** Changes some query parameters of the current URL and keeps the others (null removes one). */
export function mergeQueryParams(router: Router, queryParams: Record<string, string | number | null>): void {
  void router.navigate([], { queryParams, queryParamsHandling: 'merge' });
}

/** The `page` query value for a 0-based page: null removes it on the first page. */
export function pageToQuery(page: number): number | null {
  return page > 0 ? page + 1 : null;
}
