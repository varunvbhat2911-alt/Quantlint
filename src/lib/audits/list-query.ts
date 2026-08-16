/* Pure list-query parsing/validation for GET /api/audits — unit-tested in
 * tests/audits/list-query.test.ts. Bounded and allow-listed; no arbitrary
 * page sizes, no user_id parameter (ownership comes from the session). */

import type { AuditFramework, AuditStatus } from "@/types/database";

export const HISTORY_SORTS = ["newest", "oldest", "name-az", "name-za"] as const;
export type HistorySort = (typeof HISTORY_SORTS)[number];

export const STATUS_FILTERS = ["all", "queued", "running", "completed", "failed"] as const;
export type StatusFilterValue = (typeof STATUS_FILTERS)[number];

export const FRAMEWORK_FILTERS = ["all", "auto", "vectorbt", "backtrader", "zipline", "pandas"] as const;
export type FrameworkFilterValue = (typeof FRAMEWORK_FILTERS)[number];

export const DATE_FILTERS = ["all", "today", "7days", "30days"] as const;
export type DateFilterValue = (typeof DATE_FILTERS)[number];

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_SEARCH_LENGTH = 100;

export type ListQueryParams = {
  page: number;
  pageSize: number;
  status: StatusFilterValue;
  framework: FrameworkFilterValue;
  date: DateFilterValue;
  sort: HistorySort;
  search: string;
};

export const DEFAULT_LIST_PARAMS: ListQueryParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  status: "all",
  framework: "all",
  date: "all",
  sort: "newest",
  search: "",
};

export type ParseListQueryResult =
  | { ok: true; params: ListQueryParams }
  | { ok: false; error: string; details: Record<string, string> };

export function parseListQuery(searchParams: URLSearchParams): ParseListQueryResult {
  const details: Record<string, string> = {};

  const intIn = (name: string, min: number, max: number, fallback: number) => {
    const raw = searchParams.get(name);
    if (raw === null || raw.trim() === "") return fallback;
    if (!/^\d+$/.test(raw.trim())) {
      details[name] = "Must be a positive integer.";
      return fallback;
    }
    const value = parseInt(raw, 10);
    if (value < min || value > max) {
      details[name] = `Must be between ${min} and ${max}.`;
      return fallback;
    }
    return value;
  };

  const enumIn = <T extends readonly string[]>(
    name: string,
    allowed: T,
    fallback: T[number],
  ): T[number] => {
    const raw = searchParams.get(name);
    if (raw === null || raw === "" ) return fallback;
    if (!(allowed as readonly string[]).includes(raw)) {
      details[name] = `Must be one of: ${allowed.join(", ")}.`;
      return fallback;
    }
    return raw as T[number];
  };

  const searchRaw = searchParams.get("search") ?? searchParams.get("q") ?? "";
  const search = searchRaw.trim().slice(0, MAX_SEARCH_LENGTH);
  if (searchRaw.length > MAX_SEARCH_LENGTH) {
    details.search = `Must be at most ${MAX_SEARCH_LENGTH} characters.`;
  }

  const params: ListQueryParams = {
    page: intIn("page", 1, 10_000, 1),
    pageSize: intIn("pageSize", 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    status: enumIn("status", STATUS_FILTERS, "all"),
    framework: enumIn("framework", FRAMEWORK_FILTERS, "all"),
    date: enumIn("date", DATE_FILTERS, "all"),
    sort: enumIn("sort", HISTORY_SORTS, "newest"),
    search,
  };

  if (Object.keys(details).length > 0) {
    return { ok: false, error: "Invalid list query.", details };
  }
  return { ok: true, params };
}

/* Server-side query construction inputs (framework/status narrowed types). */
export function statusConstraint(status: StatusFilterValue): AuditStatus | null {
  return status === "all" ? null : (status as AuditStatus);
}

export function frameworkConstraint(framework: FrameworkFilterValue): AuditFramework | null {
  return framework === "all" ? null : (framework as AuditFramework);
}

export function dateCutoff(date: DateFilterValue): string | null {
  if (date === "all") return null;
  const days = date === "today" ? 1 : date === "7days" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function sortOrder(sort: HistorySort): { column: "created_at" | "strategy_name"; ascending: boolean } {
  switch (sort) {
    case "oldest":
      return { column: "created_at", ascending: true };
    case "name-az":
      return { column: "strategy_name", ascending: true };
    case "name-za":
      return { column: "strategy_name", ascending: false };
    default:
      return { column: "created_at", ascending: false };
  }
}
