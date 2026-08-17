import { describe, expect, it } from "vitest";
import { runAudit } from "@/lib/audit-engine/execution";
import type { AuditRepository, AuditRow } from "@/lib/audit-engine/repository";

/* In-memory repository: verifies runAudit's state transitions and persistence
 * calls without any database (the Supabase repository is exercised in the
 * controlled end-to-end test instead). */

type InsertLog = { table: string; count: number };

class InMemoryAuditRepository implements AuditRepository {
  row: AuditRow;
  updates: { status?: AuditRow["status"]; progress?: number }[] = [];
  inserts: InsertLog[] = [];
  claimShouldFail = false;

  constructor(overrides: Partial<AuditRow> = {}) {
    this.row = {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "99999999-9999-4999-8999-999999999999",
      strategy_name: "Test Strategy",
      input_type: "paste",
      file_name: null,
      framework: "auto",
      analysis_depth: "standard",
      rule_categories: [
        "Look-ahead Bias",
        "Data Leakage",
        "Survivorship Bias",
        "Risk Management",
        "Position Sizing",
        "Performance Metrics",
        "Execution Logic",
        "Transaction Costs",
        "Portfolio Logic",
      ],
      code: 'import pandas as pd\nsignal = close.shift(-1) > mean\n',
      status: "queued",
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  async getAudit(): Promise<AuditRow | null> {
    return this.row;
  }

  async claimAudit(): Promise<AuditRow | null> {
    if (this.claimShouldFail || this.row.status !== "queued") return null;
    this.row = { ...this.row, status: "running", progress: 0 };
    return this.row;
  }

  async updateAudit(_id: string, patch: { status?: AuditRow["status"]; progress?: number }) {
    this.updates.push(patch);
    this.row = { ...this.row, ...patch, updated_at: new Date().toISOString() };
    return this.row;
  }

  async getResults() {
    return { violations: [], metrics: [], recommendations: [], timeline: [] };
  }

  async insertViolations(rows: unknown[]) {
    this.inserts.push({ table: "audit_violations", count: rows.length });
  }

  async insertMetrics(rows: unknown[]) {
    this.inserts.push({ table: "audit_metrics", count: rows.length });
  }

  async insertRecommendations(rows: unknown[]) {
    this.inserts.push({ table: "audit_recommendations", count: rows.length });
  }

  async insertTimeline(rows: unknown[]) {
    this.inserts.push({ table: "audit_timeline", count: rows.length });
  }

  async commitResults(args: {
    violations: unknown[];
    metrics: unknown[];
    recommendations: unknown[];
    timeline: unknown[];
  }) {
    this.inserts.push({ table: "audit_violations", count: args.violations.length });
    this.inserts.push({ table: "audit_metrics", count: args.metrics.length });
    this.inserts.push({ table: "audit_recommendations", count: args.recommendations.length });
    this.inserts.push({ table: "audit_timeline", count: args.timeline.length });
  }

  async recoverStale(): Promise<string[]> {
    return [];
  }

  async resetForRetry(): Promise<boolean> {
    return false;
  }
}

const UUID = "11111111-1111-4111-8111-111111111111";

describe("runAudit state transitions", () => {
  it("takes a queued audit through running to completed with real progress", async () => {
    const repo = new InMemoryAuditRepository();
    const { audit, engine } = await runAudit(UUID, repo);

    expect(audit.status).toBe("completed");
    expect(audit.progress).toBe(100);
    expect(engine?.ok).toBe(true);

    // Progress updates reflect completed stages: strictly increasing to 100
    const progressValues = repo.updates
      .filter((u) => typeof u.progress === "number")
      .map((u) => u.progress as number);
    expect(progressValues.length).toBeGreaterThan(0);
    expect(progressValues).toEqual([...progressValues].sort((a, b) => a - b));
    expect(progressValues[progressValues.length - 1]).toBe(100);

    // The final status update marks completion
    expect(repo.updates[repo.updates.length - 1].status).toBe("completed");

    // Timeline includes "Audit started" plus per-stage entries
    const timelineInsert = repo.inserts.find((i) => i.table === "audit_timeline");
    expect(timelineInsert?.count).toBeGreaterThanOrEqual(8);

    // The planted look-ahead finding is persisted
    const violationInsert = repo.inserts.find((i) => i.table === "audit_violations");
    expect(violationInsert?.count).toBeGreaterThanOrEqual(1);

    // Metrics and deterministic recommendations are persisted
    expect(repo.inserts.find((i) => i.table === "audit_metrics")?.count).toBeGreaterThanOrEqual(10);
    expect(repo.inserts.find((i) => i.table === "audit_recommendations")?.count).toBeGreaterThanOrEqual(1);
  });

  it("marks the audit failed for malformed Python without exposing internals", async () => {
    const repo = new InMemoryAuditRepository({
      code: "def broken(:\n    x = (1 + 2\n",
    });
    const { audit, engine } = await runAudit(UUID, repo);

    expect(audit.status).toBe("failed");
    expect(engine?.ok).toBe(false);
    expect(repo.inserts.find((i) => i.table === "audit_violations")).toBeUndefined();
    expect(repo.inserts.find((i) => i.table === "audit_timeline")).toBeDefined();

    const lastUpdate = repo.updates[repo.updates.length - 1];
    expect(lastUpdate.status).toBe("failed");
    // Failure progress reflects real work (intake only), not fake completion
    const progressValues = repo.updates
      .filter((u) => typeof u.progress === "number")
      .map((u) => u.progress as number);
    expect(progressValues[progressValues.length - 1]).toBeLessThan(100);
  });

  it("is idempotent for an already-completed audit", async () => {
    const repo = new InMemoryAuditRepository({ status: "completed", progress: 100 });
    const { audit, engine } = await runAudit(UUID, repo);
    expect(audit.status).toBe("completed");
    expect(engine).toBeNull();
    expect(repo.updates).toHaveLength(0);
    expect(repo.inserts).toHaveLength(0);
  });

  it("does not double-execute when the claim is lost", async () => {
    const repo = new InMemoryAuditRepository({ status: "queued" });
    repo.claimShouldFail = true; // another runner claimed it first
    const { audit } = await runAudit(UUID, repo);
    expect(audit.status).toBe("queued"); // unchanged — the other runner owns it
    expect(repo.inserts).toHaveLength(0);
  });

  it("rejects unknown audit ids", async () => {
    const repo = new InMemoryAuditRepository();
    const missing = new (class extends InMemoryAuditRepository {
      override async getAudit() {
        return null;
      }
    })();
    void repo;
    await expect(runAudit("22222222-2222-4222-8222-222222222222", missing)).rejects.toThrow(
      /not found/i,
    );
  });
});
