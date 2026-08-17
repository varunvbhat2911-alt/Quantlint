/* Database types for the QuantLint Supabase schema.
 *
 * Hand-written for Phases 1A-1B (audits + child tables). Once migrations are
 * applied to a database, prefer regenerating with:
 *   supabase gen types --lang=ts --project-id uehkniyiqjmtjqjsgerf
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AuditStatus = "queued" | "running" | "completed" | "failed";

export type AuditInputType = "upload" | "paste";

export type AuditFramework =
  | "auto"
  | "vectorbt"
  | "backtrader"
  | "zipline"
  | "pandas";

export type AuditAnalysisDepth = "standard" | "deep" | "fast";

/* Mirrors RULE_CATEGORIES in src/lib/audit-draft.ts and the rule_categories
 * CHECK constraint in supabase/migrations/20260816001522_create_audits_table.sql */
export type AuditRuleCategory =
  | "Look-ahead Bias"
  | "Data Leakage"
  | "Survivorship Bias"
  | "Risk Management"
  | "Position Sizing"
  | "Performance Metrics"
  | "Execution Logic"
  | "Transaction Costs"
  | "Portfolio Logic";

/* Mirrors Violation/FindingCategory in src/lib/mock-data/audit-result.ts */
export type ViolationSeverity = "critical" | "warning" | "info";
export type ViolationStatus = "open" | "resolved" | "ignored";
export type FindingCategory =
  | "bias"
  | "risk"
  | "execution"
  | "data"
  | "performance"
  | "structure";

export type Database = {
  public: {
    Tables: {
      audits: {
        Row: {
          id: string;
          /* Owning authenticated user (auth.users.id) — server-set only. */
          user_id: string;
          strategy_name: string;
          input_type: AuditInputType;
          file_name: string | null;
          framework: AuditFramework;
          analysis_depth: AuditAnalysisDepth;
          rule_categories: AuditRuleCategory[];
          code: string;
          status: AuditStatus;
          progress: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          strategy_name: string;
          input_type: AuditInputType;
          file_name?: string | null;
          framework?: AuditFramework;
          analysis_depth?: AuditAnalysisDepth;
          rule_categories?: AuditRuleCategory[];
          code?: string;
          status?: AuditStatus;
          progress?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          strategy_name?: string;
          input_type?: AuditInputType;
          file_name?: string | null;
          framework?: AuditFramework;
          analysis_depth?: AuditAnalysisDepth;
          rule_categories?: AuditRuleCategory[];
          code?: string;
          status?: AuditStatus;
          progress?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_violations: {
        Row: {
          id: string;
          audit_id: string;
          rule_id: string;
          severity: ViolationSeverity;
          category: FindingCategory;
          title: string;
          description: string;
          why_it_matters: string;
          file_name: string | null;
          line: number | null;
          detected_pattern: string | null;
          suggested_fix: string | null;
          code_snippet: string | null;
          fix_snippet: string | null;
          status: ViolationStatus;
          /* AIExplanation shape from src/lib/mock-data/audit-result.ts */
          ai_explanation: Json | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          audit_id: string;
          rule_id: string;
          severity: ViolationSeverity;
          category: FindingCategory;
          title: string;
          description: string;
          why_it_matters: string;
          file_name?: string | null;
          line?: number | null;
          detected_pattern?: string | null;
          suggested_fix?: string | null;
          code_snippet?: string | null;
          fix_snippet?: string | null;
          status?: ViolationStatus;
          ai_explanation?: Json | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          audit_id?: string;
          rule_id?: string;
          severity?: ViolationSeverity;
          category?: FindingCategory;
          title?: string;
          description?: string;
          why_it_matters?: string;
          file_name?: string | null;
          line?: number | null;
          detected_pattern?: string | null;
          suggested_fix?: string | null;
          code_snippet?: string | null;
          fix_snippet?: string | null;
          status?: ViolationStatus;
          ai_explanation?: Json | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_violations_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_metrics: {
        Row: {
          id: string;
          audit_id: string;
          group_label: string;
          key: string;
          label: string;
          value: string;
          tooltip: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          audit_id: string;
          group_label: string;
          key: string;
          label: string;
          value: string;
          tooltip?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          audit_id?: string;
          group_label?: string;
          key?: string;
          label?: string;
          value?: string;
          tooltip?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_metrics_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_recommendations: {
        Row: {
          id: string;
          audit_id: string;
          priority: number;
          title: string;
          severity: ViolationSeverity;
          why: string;
          suggested_action: string;
          related_rule_id: string;
          status: ViolationStatus;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          audit_id: string;
          priority: number;
          title: string;
          severity: ViolationSeverity;
          why: string;
          suggested_action: string;
          related_rule_id: string;
          status?: ViolationStatus;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          audit_id?: string;
          priority?: number;
          title?: string;
          severity?: ViolationSeverity;
          why?: string;
          suggested_action?: string;
          related_rule_id?: string;
          status?: ViolationStatus;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_recommendations_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_timeline: {
        Row: {
          id: string;
          audit_id: string;
          label: string;
          entry_at: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          audit_id: string;
          label: string;
          entry_at?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          audit_id?: string;
          label?: string;
          entry_at?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_timeline_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
      /* Phase 9: durable execution queue. RLS enabled, no policies →
       * service-role only. Payloads hold only the audit id. */
      audit_job_queue: {
        Row: {
          id: string;
          audit_id: string;
          status: "pending" | "running" | "completed" | "dead";
          attempts: number;
          max_attempts: number;
          visible_at: string;
          locked_by: string | null;
          locked_at: string | null;
          last_error: string | null;
          enqueued_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          audit_id: string;
          status?: "pending" | "running" | "completed" | "dead";
          attempts?: number;
          max_attempts?: number;
          visible_at?: string;
          locked_by?: string | null;
          locked_at?: string | null;
          last_error?: string | null;
          enqueued_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          audit_id?: string;
          status?: "pending" | "running" | "completed" | "dead";
          attempts?: number;
          max_attempts?: number;
          visible_at?: string;
          locked_by?: string | null;
          locked_at?: string | null;
          last_error?: string | null;
          enqueued_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_job_queue_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      commit_audit_results: {
        Args: {
          p_audit_id: string;
          p_status: string;
          p_progress: number;
          p_violations: Json;
          p_metrics: Json;
          p_recommendations: Json;
          p_timeline: Json;
        };
        Returns: undefined;
      };
      recover_stale_audits: {
        Args: {
          p_stale_after_minutes: number;
        };
        Returns: string[];
      };
      reset_audit_for_retry: {
        Args: {
          p_audit_id: string;
        };
        Returns: boolean;
      };
      enqueue_audit: {
        Args: { p_audit_id: string };
        Returns: boolean;
      };
      dequeue_audit: {
        Args: { p_worker_id: string; p_max_attempts: number };
        Returns: { job_id: string; audit_id: string; attempts: number }[];
      };
      complete_audit_job: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      fail_audit_job: {
        Args: {
          p_job_id: string;
          p_error: string;
          p_retry_delay_seconds: number;
        };
        Returns: undefined;
      };
      recover_stale_jobs: {
        Args: { p_stale_after_seconds: number };
        Returns: string[];
      };
      audit_status_counts: {
        Args: Record<string, never>;
        Returns: { status: string; count: number }[];
      };
      audit_list_summary: {
        Args: Record<string, never>;
        Returns: {
          total_audits: number;
          total_issues: number;
          critical_findings: number;
          scored_count: number;
          score_sum: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
