"use client";

import { useMemo, useState, useCallback } from "react";
import {
  MOCK_AUDIT_HISTORY,
  computeHistoryMetrics,
  type AuditHistoryRecord,
  type HistoryStatus,
  type HistoryFramework,
  type HistorySummaryMetrics,
} from "@/lib/mock-data/audit-history";

/* ── Filter / Sort types ──────────────────────────────── */

export type StatusFilter = "all" | HistoryStatus;
export type FrameworkFilter = "all" | HistoryFramework;
export type ScoreFilter = "all" | "90-100" | "80-89" | "70-79" | "below-70";
export type DateFilter = "all" | "today" | "7days" | "30days";
export type SortOption =
  | "newest"
  | "oldest"
  | "score-high"
  | "score-low"
  | "issues-most"
  | "issues-least"
  | "name-az"
  | "name-za";

export type AuditHistoryFilters = {
  search: string;
  status: StatusFilter;
  framework: FrameworkFilter;
  score: ScoreFilter;
  date: DateFilter;
  sort: SortOption;
  page: number;
  pageSize: number;
};

const DEFAULT_FILTERS: AuditHistoryFilters = {
  search: "",
  status: "all",
  framework: "all",
  score: "all",
  date: "all",
  sort: "newest",
  page: 1,
  pageSize: 10,
};

/* ── Filter helpers ───────────────────────────────────── */

function matchesSearch(record: AuditHistoryRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    record.strategyName.toLowerCase().includes(q) ||
    record.fileName.toLowerCase().includes(q) ||
    record.framework.toLowerCase().includes(q) ||
    record.id.toLowerCase().includes(q) ||
    record.status.toLowerCase().includes(q)
  );
}

function matchesStatus(record: AuditHistoryRecord, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  return record.status === filter;
}

function matchesFramework(
  record: AuditHistoryRecord,
  filter: FrameworkFilter
): boolean {
  if (filter === "all") return true;
  return record.framework === filter;
}

function matchesScore(record: AuditHistoryRecord, filter: ScoreFilter): boolean {
  if (filter === "all") return true;
  if (record.score === null) return false;
  switch (filter) {
    case "90-100":
      return record.score >= 90 && record.score <= 100;
    case "80-89":
      return record.score >= 80 && record.score <= 89;
    case "70-79":
      return record.score >= 70 && record.score <= 79;
    case "below-70":
      return record.score < 70;
    default:
      return true;
  }
}

function matchesDate(record: AuditHistoryRecord, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const recordDate = new Date(record.createdAt);
  const now = new Date();

  switch (filter) {
    case "today": {
      return (
        recordDate.getFullYear() === now.getFullYear() &&
        recordDate.getMonth() === now.getMonth() &&
        recordDate.getDate() === now.getDate()
      );
    }
    case "7days": {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return recordDate >= weekAgo;
    }
    case "30days": {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      return recordDate >= monthAgo;
    }
    default:
      return true;
  }
}

function sortRecords(
  records: AuditHistoryRecord[],
  sort: SortOption
): AuditHistoryRecord[] {
  const sorted = [...records];
  switch (sort) {
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case "score-high":
      return sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    case "score-low":
      return sorted.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    case "issues-most":
      return sorted.sort((a, b) => b.issues - a.issues);
    case "issues-least":
      return sorted.sort((a, b) => a.issues - b.issues);
    case "name-az":
      return sorted.sort((a, b) =>
        a.strategyName.localeCompare(b.strategyName)
      );
    case "name-za":
      return sorted.sort((a, b) =>
        b.strategyName.localeCompare(a.strategyName)
      );
    default:
      return sorted;
  }
}

/* ── Filter records pipeline ──────────────────────────── */

export function filterAuditHistory(
  records: AuditHistoryRecord[],
  filters: AuditHistoryFilters
): AuditHistoryRecord[] {
  let result = records;

  // 1. Search
  result = result.filter((r) => matchesSearch(r, filters.search));

  // 2. Filters
  result = result.filter((r) => matchesStatus(r, filters.status));
  result = result.filter((r) => matchesFramework(r, filters.framework));
  result = result.filter((r) => matchesScore(r, filters.score));
  result = result.filter((r) => matchesDate(r, filters.date));

  // 3. Sort
  result = sortRecords(result, filters.sort);

  return result;
}

/* ── Hook return type ─────────────────────────────────── */

export type UseAuditHistoryReturn = {
  /** All records (unfiltered) */
  allRecords: AuditHistoryRecord[];
  /** Filtered + sorted records (pre-pagination) */
  filteredRecords: AuditHistoryRecord[];
  /** Records for the current page */
  paginatedRecords: AuditHistoryRecord[];
  /** Summary metrics derived from all records */
  metrics: HistorySummaryMetrics;
  /** Current filters */
  filters: AuditHistoryFilters;
  /** Total pages */
  totalPages: number;
  /** Update a single filter value */
  setFilter: <K extends keyof AuditHistoryFilters>(
    key: K,
    value: AuditHistoryFilters[K]
  ) => void;
  /** Reset all filters to defaults */
  clearFilters: () => void;
  /** Whether any filter is active */
  hasActiveFilters: boolean;
};

/* ── Main hook ────────────────────────────────────────── */

export function useAuditHistory(): UseAuditHistoryReturn {
  const [filters, setFilters] = useState<AuditHistoryFilters>(DEFAULT_FILTERS);

  // In the future, replace MOCK_AUDIT_HISTORY with API data
  const allRecords = MOCK_AUDIT_HISTORY;

  const metrics = useMemo(() => computeHistoryMetrics(allRecords), [allRecords]);

  const filteredRecords = useMemo(
    () => filterAuditHistory(allRecords, filters),
    [allRecords, filters]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRecords.length / filters.pageSize)),
    [filteredRecords.length, filters.pageSize]
  );

  const paginatedRecords = useMemo(() => {
    const start = (filters.page - 1) * filters.pageSize;
    return filteredRecords.slice(start, start + filters.pageSize);
  }, [filteredRecords, filters.page, filters.pageSize]);

  const setFilter = useCallback(
    <K extends keyof AuditHistoryFilters>(
      key: K,
      value: AuditHistoryFilters[K]
    ) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        // Reset to page 1 when any filter changes (except page itself)
        if (key !== "page") {
          next.page = 1;
        }
        return next;
      });
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.framework !== "all" ||
    filters.score !== "all" ||
    filters.date !== "all" ||
    filters.sort !== "newest";

  return {
    allRecords,
    filteredRecords,
    paginatedRecords,
    metrics,
    filters,
    totalPages,
    setFilter,
    clearFilters,
    hasActiveFilters,
  };
}
