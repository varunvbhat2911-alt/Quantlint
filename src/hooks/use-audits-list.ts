"use client";

/* useAuditsList — real, paginated audit history backed by GET /api/audits.
 * No mocks, no silent fallbacks: failures surface as an error state. */

import * as React from "react";
import type { AuditListItem, AuditListResult } from "@/lib/audits/service";

export type ListFilters = {
  search: string;
  status: "all" | "queued" | "running" | "completed" | "failed";
  framework: "all" | "auto" | "vectorbt" | "backtrader" | "zipline" | "pandas";
  date: "all" | "today" | "7days" | "30days";
  sort: "newest" | "oldest" | "name-az" | "name-za";
  page: number;
  pageSize: number;
};

export const DEFAULT_LIST_FILTERS: ListFilters = {
  search: "",
  status: "all",
  framework: "all",
  date: "all",
  sort: "newest",
  page: 1,
  pageSize: 10,
};

export type AuditsListState = {
  audits: AuditListItem[];
  pagination: AuditListResult["pagination"] | null;
  summary: AuditListResult["summary"] | null;
  loading: boolean;
  error: string | null;
  filters: ListFilters;
  totalPages: number;
  setFilter: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  clearFilters: () => void;
  refresh: () => void;
  hasActiveFilters: boolean;
};

export function useAuditsList(initial?: Partial<ListFilters>): AuditsListState {
  const [filters, setFilters] = React.useState<ListFilters>({
    ...DEFAULT_LIST_FILTERS,
    ...initial,
  });
  const [audits, setAudits] = React.useState<AuditListItem[]>([]);
  const [pagination, setPagination] = React.useState<AuditListResult["pagination"] | null>(null);
  const [summary, setSummary] = React.useState<AuditListResult["summary"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  // Debounced fetch whenever filters change (search typing friendly)
  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({
            page: String(filters.page),
            pageSize: String(filters.pageSize),
            status: filters.status,
            framework: filters.framework,
            date: filters.date,
            sort: filters.sort,
          });
          if (filters.search) params.set("search", filters.search);

          const res = await fetch(`/api/audits?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload: unknown = await res.json().catch(() => null);
          if (!res.ok || !payload || typeof payload !== "object" ||
              (payload as { success?: unknown }).success !== true) {
            throw new Error(
              typeof payload === "object" && payload !== null &&
              "error" in payload &&
              typeof (payload as { error?: unknown }).error === "string"
                ? (payload as { error: string }).error
                : `HTTP ${res.status}`,
            );
          }
          const body = payload as {
            audits: AuditListItem[];
            pagination: AuditListResult["pagination"];
            summary: AuditListResult["summary"];
          };
          setAudits(body.audits);
          setPagination(body.pagination);
          setSummary(body.summary);
        } catch (err) {
          if (controller.signal.aborted) return;
          setError(
            err instanceof Error && err.message
              ? `Could not load audit history (${err.message}).`
              : "Could not load audit history.",
          );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      250,
    );

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [filters, nonce]);

  const setFilter = React.useCallback(
    <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        // Any filter change returns to the first page
        ...(key !== "page" && key !== "pageSize" ? { page: 1 } : null),
      }));
    },
    [],
  );

  const clearFilters = React.useCallback(() => {
    setFilters((prev) => ({ ...DEFAULT_LIST_FILTERS, pageSize: prev.pageSize }));
  }, []);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.framework !== "all" ||
    filters.date !== "all" ||
    filters.sort !== "newest";

  return {
    audits,
    pagination,
    summary,
    loading,
    error,
    filters,
    totalPages: pagination?.totalPages ?? 1,
    setFilter,
    clearFilters,
    refresh,
    hasActiveFilters,
  };
}
