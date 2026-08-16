"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Code2,
  FileCode2,
  X,
  AlertCircle,
  ArrowRight,
  FileText,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type InputMethod,
  type AnalysisDepth,
  type Framework,
  type RuleCategory,
  type AuditDraft,
  type ExampleStrategy,
  FRAMEWORK_OPTIONS,
  ANALYSIS_DEPTH_OPTIONS,
  RULE_CATEGORIES,
  EXAMPLE_STRATEGIES,
  validateFile,
  fileNameWithoutExtension,
  formatFileSize,
  createAuditDraftId,
} from "@/lib/audit-draft";
import { usePreferences } from "@/hooks/use-preferences";
import { PreferenceTooltip } from "@/components/settings/preference-tooltip";

/* ────────────────────────────────────────────────────────── */
/*  INPUT METHOD TABS                                         */
/* ────────────────────────────────────────────────────────── */

function InputMethodTabs({
  value,
  onChange,
}: {
  value: InputMethod;
  onChange: (v: InputMethod) => void;
}) {
  const tabs: { value: InputMethod; label: string; icon: React.ElementType }[] =
    [
      { value: "upload", label: "Upload Strategy", icon: Upload },
      { value: "paste", label: "Paste Code", icon: Code2 },
    ];

  return (
    <div
      className="flex rounded-lg border border-border/60 bg-secondary/30 p-0.5"
      role="tablist"
      aria-label="Strategy input method"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium font-mono transition-all duration-150",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  FILE UPLOAD / DRAG-DROP                                   */
/* ────────────────────────────────────────────────────────── */

function StrategyUpload({
  file,
  error,
  onFileSelect,
  onRemove,
}: {
  file: File | null;
  error: string | null;
  onFileSelect: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onFileSelect(droppedFile);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) onFileSelect(selected);
    if (inputRef.current) inputRef.current.value = "";
  }

  // File selected state
  if (file && !error) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
            <FileCode2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground truncate">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {ext === "py" ? "Python Strategy" : "Archive"} ·{" "}
              {formatFileSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary/60"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="success" className="text-[10px] font-mono">
            Ready for analysis
          </Badge>
        </div>
      </div>
    );
  }

  // Drag and drop zone
  return (
    <div>
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload strategy file"
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-all duration-150",
          dragActive
            ? "border-foreground/30 bg-secondary/40"
            : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/30",
          error && "border-red-500/40"
        )}
      >
        <FileCode2
          className={cn(
            "h-8 w-8 mb-3 transition-colors",
            dragActive ? "text-foreground/60" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium text-foreground">
          Drop your strategy file here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">or</p>
        <SecondaryButton
          size="sm"
          className="mt-3 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Browse files
        </SecondaryButton>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Python files up to 10 MB · .py, .zip
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".py,.zip"
        onChange={handleChange}
        className="hidden"
        aria-label="Upload strategy file"
      />

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  CODE EDITOR                                               */
/* ────────────────────────────────────────────────────────── */

const CODE_PLACEHOLDER = `# Paste your Python strategy here

import pandas as pd
import numpy as np

...`;

function CodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const lineCount = Math.max((value || CODE_PLACEHOLDER).split("\n").length, 12);

  return (
    <div className="rounded-xl border border-border/60 bg-code overflow-hidden">
      <div className="flex">
        {/* Line numbers */}
        <div
          className="flex-shrink-0 select-none border-r border-border/40 px-3 py-4 text-right font-mono text-[11px] text-muted-foreground/50 leading-relaxed"
          aria-hidden
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={CODE_PLACEHOLDER}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent p-4 font-mono text-sm text-code-foreground leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none min-h-[300px] w-full"
          aria-label="Python strategy code"
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  FRAMEWORK SELECTOR                                        */
/* ────────────────────────────────────────────────────────── */

function FrameworkSelector({
  value,
  onChange,
}: {
  value: Framework;
  onChange: (v: Framework) => void;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="framework-select"
        className="text-sm font-semibold text-foreground"
      >
        Strategy Framework
      </label>
      <select
        id="framework-select"
        value={value}
        onChange={(e) => onChange(e.target.value as Framework)}
        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {FRAMEWORK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">
        QuantLint will use the selected framework to apply framework-specific
        validation rules.
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  EXAMPLE STRATEGY CARDS                                    */
/* ────────────────────────────────────────────────────────── */

function ExampleStrategyCard({
  example,
  onLoad,
}: {
  example: ExampleStrategy;
  onLoad: (e: ExampleStrategy) => void;
}) {
  const fw = FRAMEWORK_OPTIONS.find((f) => f.value === example.framework);
  return (
    <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{example.name}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {example.description}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-[10px] font-mono">
            {fw?.label ?? example.framework}
          </Badge>
          <button
            type="button"
            onClick={() => onLoad(example)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Load Example
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  AUDIT CONFIGURATION                                       */
/* ────────────────────────────────────────────────────────── */

function AuditConfiguration({
  depth,
  onDepthChange,
  rules,
  onRulesChange,
}: {
  depth: AnalysisDepth;
  onDepthChange: (d: AnalysisDepth) => void;
  rules: RuleCategory[];
  onRulesChange: (r: RuleCategory[]) => void;
}) {
  function toggleRule(cat: RuleCategory) {
    if (rules.includes(cat)) {
      onRulesChange(rules.filter((r) => r !== cat));
    } else {
      onRulesChange([...rules, cat]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Analysis Depth */}
      <div className="space-y-3">
        <PreferenceTooltip content="Controls how thoroughly QuantLint analyzes your strategy. Deep mode runs all rule categories with extended checks.">
          <label className="text-sm font-semibold text-foreground">
            Analysis Depth
          </label>
        </PreferenceTooltip>
        <div className="grid grid-cols-3 gap-2">
          {ANALYSIS_DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onDepthChange(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
                depth === opt.value
                  ? "border-foreground/30 bg-secondary/60 text-foreground"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              <p className="text-xs font-medium">{opt.label}</p>
              <p className="text-[10px] mt-0.5 opacity-70">
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Rule Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <PreferenceTooltip content="Select which rule categories to include in the audit. Disabled categories are skipped during analysis.">
            <label className="text-sm font-semibold text-foreground">
              Rule Categories
            </label>
          </PreferenceTooltip>
          <button
            type="button"
            onClick={() =>
              onRulesChange(
                rules.length === RULE_CATEGORIES.length
                  ? []
                  : [...RULE_CATEGORIES]
              )
            }
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {rules.length === RULE_CATEGORIES.length
              ? "Deselect all"
              : "Select all"}
          </button>
        </div>
        <div className="space-y-1.5">
          {RULE_CATEGORIES.map((cat) => {
            const checked = rules.includes(cat);
            return (
              <label
                key={cat}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-secondary/40"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRule(cat)}
                  className="h-3.5 w-3.5 rounded border-border text-foreground accent-foreground"
                />
                <span
                  className={
                    checked ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {cat}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  AUDIT SUMMARY SIDEBAR                                     */
/* ────────────────────────────────────────────────────────── */

function AuditSummary({
  strategyName,
  framework,
  depth,
  rules,
  hasInput,
  inputType,
  fileName,
}: {
  strategyName: string;
  framework: Framework;
  depth: AnalysisDepth;
  rules: RuleCategory[];
  hasInput: boolean;
  inputType: InputMethod;
  fileName: string | null;
}) {
  const fwLabel =
    FRAMEWORK_OPTIONS.find((f) => f.value === framework)?.label ?? "Auto Detect";
  const depthLabel =
    ANALYSIS_DEPTH_OPTIONS.find((d) => d.value === depth)?.label ?? "Standard";

  const rows: { label: string; value: string }[] = [
    {
      label: "Strategy",
      value: strategyName || "Not named",
    },
    {
      label: "Input",
      value: hasInput
        ? inputType === "upload"
          ? fileName ?? "File selected"
          : "Pasted code"
        : "Not provided",
    },
    { label: "Framework", value: fwLabel },
    { label: "Analysis", value: depthLabel },
    {
      label: "Rules",
      value:
        rules.length === RULE_CATEGORIES.length
          ? "All categories"
          : `${rules.length} of ${RULE_CATEGORIES.length}`,
    },
    {
      label: "Status",
      value: hasInput ? "Ready" : "Waiting for input",
    },
  ];

  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          Audit Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <dl className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-xs font-medium text-foreground text-right max-w-[60%] truncate">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 pt-4 border-t border-border/40">
          <Badge
            variant={hasInput ? "success" : "secondary"}
            className="text-[10px] font-mono"
          >
            {hasInput ? "Ready to audit" : "Awaiting strategy"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  TOAST NOTIFICATION                                        */
/* ────────────────────────────────────────────────────────── */

function Toast({
  message,
  visible,
  variant = "error",
  onClose,
}: {
  message: string;
  visible: boolean;
  variant?: "error" | "info";
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (visible) {
      const t = setTimeout(onClose, 5000);
      return () => clearTimeout(t);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border px-5 py-3.5 shadow-lg shadow-black/8",
          variant === "error"
            ? "border-red-500/30 bg-card text-red-600 dark:text-red-400"
            : "border-border/60 bg-card text-foreground"
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-sm">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  RUN AUDIT CTA                                             */
/* ────────────────────────────────────────────────────────── */

function RunAuditButton({
  disabled,
  submitting,
  uploadProgress,
  onClick,
}: {
  disabled: boolean;
  submitting: boolean;
  uploadProgress: number | null;
  onClick: () => void;
}) {
  const uploading = uploadProgress !== null;
  const label = uploading
    ? `Uploading… ${Math.round(uploadProgress * 100)}%`
    : submitting
      ? "Starting…"
      : "Run Audit";

  return (
    <div className="space-y-2">
      <PrimaryButton
        className="w-full"
        disabled={disabled}
        onClick={onClick}
      >
        {uploading ? (
          <Upload className="h-4 w-4 animate-pulse" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {label}
      </PrimaryButton>
      {uploading && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60"
          role="progressbar"
          aria-valuenow={Math.round(uploadProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div
            className="h-full rounded-full bg-foreground/70 transition-all duration-150"
            style={{ width: `${Math.round(uploadProgress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  UPLOAD TRANSPORT                                          */
/* ────────────────────────────────────────────────────────── */

/* POST multipart form data with real upload progress events (fetch cannot
 * report request-body progress). Resolves with the parsed JSON response. */
function postWithUploadProgress(
  url: string,
  form: FormData,
  totalBytes: number,
  onProgress: (fraction: number) => void,
): Promise<{ status: number; payload: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "text";

    if (totalBytes > 0) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(1, e.loaded / e.total));
        }
      };
    }

    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error body
      }
      resolve({ status: xhr.status, payload });
    };
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.onabort = () => reject(new Error("upload aborted"));

    xhr.send(form);
  });
}

/* ────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                 */
/* ────────────────────────────────────────────────────────── */

export default function NewAuditPage() {
  const router = useRouter();
  const { preferences, mounted: preferencesMounted } = usePreferences();

  // Input method
  const [inputMethod, setInputMethod] = React.useState<InputMethod>("upload");

  // File upload state
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  // Code editor state
  const [code, setCode] = React.useState("");

  // Strategy name
  const [strategyName, setStrategyName] = React.useState("");

  // Framework
  const [framework, setFramework] = React.useState<Framework>("auto");

  // Audit config
  const [analysisDepth, setAnalysisDepth] =
    React.useState<AnalysisDepth>("standard");
  const [ruleCategories, setRuleCategories] = React.useState<RuleCategory[]>([
    ...RULE_CATEGORIES,
  ]);
  const [defaultsApplied, setDefaultsApplied] = React.useState(false);

  React.useEffect(() => {
    if (preferencesMounted && !defaultsApplied) {
      setFramework(preferences.defaultFramework);
      setAnalysisDepth(preferences.defaultAnalysisDepth);
      setRuleCategories([...preferences.defaultRuleCategories]);
      setDefaultsApplied(true);
    }
  }, [preferencesMounted, defaultsApplied, preferences]);

  // Toast
  const [toast, setToast] = React.useState<{
    message: string;
    visible: boolean;
  }>({ message: "", visible: false });

  // Audit creation request in flight
  const [submitting, setSubmitting] = React.useState(false);
  // Real upload progress (0–100) while the file streams to the server
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(
    null,
  );

  // Derived
  const hasUpload = inputMethod === "upload" && file !== null && !fileError;
  const hasCode = inputMethod === "paste" && code.trim().length > 0;
  const hasInput = hasUpload || hasCode;

  /* ── Handlers ────────────────────────────────────────── */

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(f);
    if (!strategyName) {
      setStrategyName(fileNameWithoutExtension(f.name));
    }
  }

  function handleFileRemove() {
    setFile(null);
    setFileError(null);
  }

  function handleLoadExample(example: ExampleStrategy) {
    setInputMethod("paste");
    setCode(example.code);
    setFramework(example.framework);
    if (!strategyName) {
      setStrategyName(example.name);
    }
  }

  async function handleRunAudit() {
    // Validation
    if (!hasInput) {
      setToast({
        message:
          inputMethod === "upload"
            ? "Add a Python strategy before starting the audit."
            : "Paste a Python strategy before starting the audit.",
        visible: true,
      });
      return;
    }

    // Build draft (upload drafts carry metadata only — file contents are
    // streamed to the server, never placed in sessionStorage)
    const draft: AuditDraft = {
      id: createAuditDraftId(),
      strategyName: strategyName || "Untitled Strategy",
      inputType: inputMethod,
      fileName: file?.name ?? null,
      framework,
      analysisDepth,
      ruleCategories,
      code: inputMethod === "paste" ? code : "",
      createdAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem("quantlint_audit_draft", JSON.stringify(draft));
    } catch {
      // sessionStorage unavailable — proceed anyway
    }

    setSubmitting(true);
    setUploadProgress(inputMethod === "upload" ? 0 : null);
    try {
      let res: { status: number; payload: unknown };

      if (inputMethod === "upload" && file) {
        // Real file upload: multipart with the actual bytes.
        const form = new FormData();
        form.set("strategyName", draft.strategyName);
        form.set("fileName", file.name);
        form.set("framework", framework);
        form.set("analysisDepth", analysisDepth);
        form.set("ruleCategories", JSON.stringify(ruleCategories));
        form.set("file", file, file.name);
        res = await postWithUploadProgress(
          "/api/audits",
          form,
          file.size,
          setUploadProgress,
        );
      } else {
        // Pasted code — unchanged JSON flow.
        const response = await fetch("/api/audits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategyName: draft.strategyName,
            inputType: draft.inputType,
            fileName: draft.fileName,
            framework: draft.framework,
            analysisDepth: draft.analysisDepth,
            ruleCategories: draft.ruleCategories,
            code: draft.code,
          }),
        });
        res = {
          status: response.status,
          payload: await response.json().catch(() => null),
        };
      }

      const payload = res.payload;
      const auditId =
        typeof payload === "object" &&
        payload !== null &&
        "audit" in payload &&
        typeof (payload as { audit?: unknown }).audit === "object" &&
        (payload as { audit?: { id?: unknown } }).audit !== null
          ? (payload as { audit?: { id?: unknown } }).audit?.id
          : undefined;

      if (res.status >= 400 || typeof auditId !== "string") {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Could not start the audit (HTTP ${res.status}).`;
        setToast({ message, visible: true });
        return;
      }

      router.push(
        `/audit/running?jobId=${encodeURIComponent(auditId)}`,
      );
    } catch {
      setToast({
        message: "Network error — could not start the audit.",
        visible: true,
      });
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <>
      <div className="space-y-10">
        {/* Header */}
        <PageHeader
          title="New Audit"
          subtitle="Analyze a quantitative trading strategy for logic errors, hidden biases, risk issues, and validation problems."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "New Audit" },
          ]}
        />

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Main content */}
          <div className="space-y-8">
            {/* Input method tabs */}
            <InputMethodTabs value={inputMethod} onChange={setInputMethod} />

            {/* Strategy input area */}
            {inputMethod === "upload" ? (
              <StrategyUpload
                file={file}
                error={fileError}
                onFileSelect={handleFileSelect}
                onRemove={handleFileRemove}
              />
            ) : (
              <CodeEditor value={code} onChange={setCode} />
            )}

            {/* Strategy name */}
            <div className="space-y-2">
              <label
                htmlFor="strategy-name"
                className="text-sm font-semibold text-foreground"
              >
                Strategy Name
                <span className="ml-1 text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <input
                id="strategy-name"
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="e.g. Mean Reversion Strategy"
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Framework selection */}
            <FrameworkSelector value={framework} onChange={setFramework} />

            {/* Example strategies */}
            <section>
              <SectionHeader
                title="Example Strategies"
                description="Load a demo strategy to try QuantLint."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXAMPLE_STRATEGIES.map((ex) => (
                  <ExampleStrategyCard
                    key={ex.id}
                    example={ex}
                    onLoad={handleLoadExample}
                  />
                ))}
              </div>
            </section>

            {/* Audit configuration */}
            <section>
              <SectionHeader
                title="Audit Configuration"
                description="Configure analysis depth and rule categories."
              />
              <AuditConfiguration
                depth={analysisDepth}
                onDepthChange={setAnalysisDepth}
                rules={ruleCategories}
                onRulesChange={setRuleCategories}
              />
            </section>

            {/* Run Audit CTA — mobile (below main content) */}
            <div className="lg:hidden space-y-4">
              <AuditSummary
                strategyName={strategyName}
                framework={framework}
                depth={analysisDepth}
                rules={ruleCategories}
                hasInput={hasInput}
                inputType={inputMethod}
                fileName={file?.name ?? null}
              />
              <RunAuditButton
                disabled={!hasInput || submitting}
                submitting={submitting}
                uploadProgress={uploadProgress}
                onClick={handleRunAudit}
              />
            </div>
          </div>

          {/* Right sidebar — summary + CTA (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <AuditSummary
                strategyName={strategyName}
                framework={framework}
                depth={analysisDepth}
                rules={ruleCategories}
                hasInput={hasInput}
                inputType={inputMethod}
                fileName={file?.name ?? null}
              />
              <RunAuditButton
                disabled={!hasInput || submitting}
                submitting={submitting}
                uploadProgress={uploadProgress}
                onClick={handleRunAudit}
              />
              <p className="text-center text-[11px] text-muted-foreground">
                No data leaves your browser.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Toast
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}
