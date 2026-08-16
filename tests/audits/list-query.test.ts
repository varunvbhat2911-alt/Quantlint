import { describe, it, expect } from "vitest";
import {
  parseListQuery,
  statusConstraint,
  frameworkConstraint,
  dateCutoff,
  sortOrder,
  HISTORY_SORTS,
  STATUS_FILTERS,
  FRAMEWORK_FILTERS,
  DATE_FILTERS,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_LIST_PARAMS,
  MAX_SEARCH_LENGTH,
} from "@/lib/audits/list-query";

/* ── parseListQuery ─────────────────────────────────────── */

describe("parseListQuery", () => {
  it("returns defaults for empty search params", () => {
    const result = parseListQuery(new URLSearchParams());
    expect(result).toEqual({ ok: true, params: DEFAULT_LIST_PARAMS });
  });

  it("parses all valid params", () => {
    const sp = new URLSearchParams({
      page: "2",
      pageSize: "25",
      status: "completed",
      framework: "vectorbt",
      date: "7days",
      sort: "oldest",
      search: "mean reversion",
    });
    const result = parseListQuery(sp);
    if (!result.ok) throw new Error("unexpected failure");
    expect(result.params).toEqual({
      page: 2,
      pageSize: 25,
      status: "completed",
      framework: "vectorbt",
      date: "7days",
      sort: "oldest",
      search: "mean reversion",
    });
  });

  it("accepts 'q' as alias for 'search'", () => {
    const sp = new URLSearchParams({ q: "momentum" });
    const result = parseListQuery(sp);
    if (!result.ok) throw new Error("unexpected failure");
    expect(result.params.search).toBe("momentum");
  });

  it("'search' takes precedence over 'q'", () => {
    const sp = new URLSearchParams({ search: "a", q: "b" });
    const result = parseListQuery(sp);
    if (!result.ok) throw new Error("unexpected failure");
    expect(result.params.search).toBe("a");
  });

  it("trims search whitespace before validating length", () => {
    const sp = new URLSearchParams({ search: "  momentum  " });
    const result = parseListQuery(sp);
    if (!result.ok) throw new Error("unexpected failure");
    expect(result.params.search).toBe("momentum");
  });

  it("rejects page below minimum", () => {
    const sp = new URLSearchParams({ page: "0" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.page).toContain("between");
    }
  });

  it("rejects page above maximum (10000)", () => {
    const sp = new URLSearchParams({ page: "10001" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.page).toContain("between");
    }
  });

  it("rejects negative page (non-digit)", () => {
    const sp = new URLSearchParams({ page: "-1" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric page", () => {
    const sp = new URLSearchParams({ page: "abc" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("rejects pageSize of 0", () => {
    const sp = new URLSearchParams({ pageSize: "0" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("rejects pageSize above 50", () => {
    const sp = new URLSearchParams({ pageSize: "51" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid status", () => {
    const sp = new URLSearchParams({ status: "needs-review" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.status).toContain(STATUS_FILTERS.join(", "));
    }
  });

  it("rejects invalid framework", () => {
    const sp = new URLSearchParams({ framework: "metatrader" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid sort", () => {
    const sp = new URLSearchParams({ sort: "score-desc" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid date", () => {
    const sp = new URLSearchParams({ date: "90days" });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
  });

  it("collects multiple validation errors at once", () => {
    const sp = new URLSearchParams({
      page: "-1",
      pageSize: "999",
      status: "bogus",
      framework: "bogus",
      sort: "bogus",
      date: "bogus",
    });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.details).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("reports search truncation as a detail error", () => {
    const sp = new URLSearchParams({ search: "x".repeat(MAX_SEARCH_LENGTH + 1) });
    const result = parseListQuery(sp);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.search).toContain(String(MAX_SEARCH_LENGTH));
    }
  });

  it("accepts page=10000 (upper bound)", () => {
    const sp = new URLSearchParams({ page: "10000" });
    const result = parseListQuery(sp);
    if (!result.ok) throw new Error("unexpected failure");
    expect(result.params.page).toBe(10000);
  });

  it("accepts pageSize=50 (upper bound)", () => {
    const sp = new URLSearchParams({ pageSize: "50" });
    const result = parseListQuery(sp);
    if (!result.ok) throw new Error("unexpected failure");
    expect(result.params.pageSize).toBe(50);
  });

  it("accepts all status filter values", () => {
    for (const status of STATUS_FILTERS) {
      const result = parseListQuery(new URLSearchParams({ status }));
      if (!result.ok) throw new Error(`failed for status=${status}`);
      expect(result.params.status).toBe(status);
    }
  });

  it("accepts all sort values", () => {
    for (const sort of HISTORY_SORTS) {
      const result = parseListQuery(new URLSearchParams({ sort }));
      if (!result.ok) throw new Error(`failed for sort=${sort}`);
      expect(result.params.sort).toBe(sort);
    }
  });

  it("accepts all framework filter values", () => {
    for (const fw of FRAMEWORK_FILTERS) {
      const result = parseListQuery(new URLSearchParams({ framework: fw }));
      if (!result.ok) throw new Error(`failed for framework=${fw}`);
      expect(result.params.framework).toBe(fw);
    }
  });

  it("accepts all date filter values", () => {
    for (const d of DATE_FILTERS) {
      const result = parseListQuery(new URLSearchParams({ date: d }));
      if (!result.ok) throw new Error(`failed for date=${d}`);
      expect(result.params.date).toBe(d);
    }
  });
});

/* ── statusConstraint ───────────────────────────────────── */

describe("statusConstraint", () => {
  it('returns null for "all"', () => {
    expect(statusConstraint("all")).toBeNull();
  });

  it("returns the value for specific statuses", () => {
    expect(statusConstraint("completed")).toBe("completed");
    expect(statusConstraint("failed")).toBe("failed");
    expect(statusConstraint("running")).toBe("running");
    expect(statusConstraint("queued")).toBe("queued");
  });
});

/* ── frameworkConstraint ─────────────────────────────────── */

describe("frameworkConstraint", () => {
  it('returns null for "all"', () => {
    expect(frameworkConstraint("all")).toBeNull();
  });

  it("returns the value for specific frameworks", () => {
    expect(frameworkConstraint("vectorbt")).toBe("vectorbt");
    expect(frameworkConstraint("backtrader")).toBe("backtrader");
  });
});

/* ── dateCutoff ─────────────────────────────────────────── */

describe("dateCutoff", () => {
  it("returns null for 'all'", () => {
    expect(dateCutoff("all")).toBeNull();
  });

  it("returns an ISO string for valid values", () => {
    expect(dateCutoff("today")).not.toBeNull();
    expect(dateCutoff("7days")).not.toBeNull();
    expect(dateCutoff("30days")).not.toBeNull();
  });

  it("today cutoff is within the last 24 hours", () => {
    const cutoff = new Date(dateCutoff("today")!);
    const diffMs = Date.now() - cutoff.getTime();
    expect(diffMs).toBeGreaterThan(0);
    expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("7days cutoff is between 7-8 days ago", () => {
    const cutoff = new Date(dateCutoff("7days")!);
    const diffMs = Date.now() - cutoff.getTime();
    expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(8 * 24 * 60 * 60 * 1000);
  });
});

/* ── sortOrder ──────────────────────────────────────────── */

describe("sortOrder", () => {
  it("newest → created_at desc", () => {
    expect(sortOrder("newest")).toEqual({
      column: "created_at",
      ascending: false,
    });
  });

  it("oldest → created_at asc", () => {
    expect(sortOrder("oldest")).toEqual({
      column: "created_at",
      ascending: true,
    });
  });

  it("name-az → strategy_name asc", () => {
    expect(sortOrder("name-az")).toEqual({
      column: "strategy_name",
      ascending: true,
    });
  });

  it("name-za → strategy_name desc", () => {
    expect(sortOrder("name-za")).toEqual({
      column: "strategy_name",
      ascending: false,
    });
  });
});
