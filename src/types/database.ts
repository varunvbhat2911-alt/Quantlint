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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
