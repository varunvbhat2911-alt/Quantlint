/* Lightweight, deterministic Python structural analysis.
 *
 * This is NOT a full Python parser — it performs heuristic structural checks
 * (bracket/quote balance, block-header colons, indentation consistency) and
 * extracts imports, functions, and classes with line numbers. Line numbers
 * always refer to the submitted source; snippets are always real source text.
 */

export type PythonImport = {
  module: string;
  names: string[];
  line: number;
};

export type PythonFunction = {
  name: string;
  line: number;
};

export type PythonClass = {
  name: string;
  line: number;
  methodCount: number;
};

export type SyntaxIssue = {
  line: number;
  message: string;
};

export type PythonStructure = {
  lineCount: number;
  codeLineCount: number;
  commentLineCount: number;
  blankLineCount: number;
  imports: PythonImport[];
  functions: PythonFunction[];
  classes: PythonClass[];
  maxIndentLevel: number;
  branchCount: number;
  loopCount: number;
  tryExceptCount: number;
  bareExceptLines: number[];
  issues: SyntaxIssue[];
};

const BLOCK_STARTERS =
  /^\s*(async\s+def|def|class|if|elif|else|for|while|try|except|finally|with|match|case)\b/;

/* Strip a trailing comment from a line, respecting quotes. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") return line.slice(0, i);
  }
  return line;
}

function indentOf(line: string): number {
  const match = line.match(/^[ \t]*/);
  if (!match) return 0;
  const ws = match[0];
  const level = Math.floor((ws.replace(/\t/g, "    ").length || 0) / 4);
  return ws.length === 0 ? 0 : Math.max(1, level);
}

export function parsePythonSource(code: string): PythonStructure {
  const rawLines = code.split(/\r?\n/);
  // Drop the empty artifact produced by a trailing newline
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }
  const issues: SyntaxIssue[] = [];
  const imports: PythonImport[] = [];
  const functions: PythonFunction[] = [];
  const classes: PythonClass[] = [];
  const bareExceptLines: number[] = [];

  let commentLines = 0;
  let blankLines = 0;
  let maxIndent = 0;
  let branches = 0;
  let loops = 0;
  let tryExcept = 0;
  let sawTabIndent = false;
  let sawSpaceIndent = false;

  // Track bracket balance across the file for precise line attribution
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  rawLines.forEach((rawLine, idx) => {
    const lineNumber = idx + 1;
    const withoutComment = stripComment(rawLine);
    const trimmed = withoutComment.trim();
    const rawTrimmed = rawLine.trim();

    if (rawTrimmed === "") {
      blankLines++;
      return;
    }
    if (rawTrimmed.startsWith("#")) {
      commentLines++;
      return;
    }

    // String balance per line (triple quotes are multi-line; treat opening
    // triple quotes as balanced to avoid false positives)
    const singleQuotes = (withoutComment.match(/(?<!\\)'/g) ?? []).length;
    const doubleQuotes = (withoutComment.match(/(?<!\\)"/g) ?? []).length;
    const tripleSingle = (withoutComment.match(/'''/g) ?? []).length;
    const tripleDouble = (withoutComment.match(/"""/g) ?? []).length;
    if (
      (singleQuotes - tripleSingle * 3) % 2 !== 0 ||
      (doubleQuotes - tripleDouble * 3) % 2 !== 0
    ) {
      issues.push({
        line: lineNumber,
        message: "Unterminated string literal.",
      });
    }

    // Bracket balance (skip delimiters inside strings heuristically by
    // reusing the quote-stripped line)
    for (const ch of withoutComment) {
      if (ch === "(" || ch === "[" || ch === "{") {
        stack.push({ ch, line: lineNumber });
      } else if (ch === ")" || ch === "]" || ch === "}") {
        const open = stack.pop();
        if (!open || open.ch !== pairs[ch]) {
          issues.push({
            line: lineNumber,
            message: `Unbalanced '${ch}'.`,
          });
        }
      }
    }

    // Block starters must end with a colon (one-liners contain one already)
    if (
      BLOCK_STARTERS.test(withoutComment) &&
      !trimmed.endsWith(":") &&
      !trimmed.endsWith(",") &&
      !trimmed.endsWith("\\") &&
      !trimmed.endsWith("(") &&
      !trimmed.endsWith("[") &&
      !trimmed.endsWith("{") &&
      !trimmed.includes(":")
    ) {
      issues.push({
        line: lineNumber,
        message: "Block statement is missing a trailing ':'.",
      });
    }

    // Indentation style mixing (Python rejects mixed tab/space indents)
    if (/^\t+\s*\S/.test(rawLine)) sawTabIndent = true;
    if (/^ +\S/.test(rawLine)) sawSpaceIndent = true;

    const indent = indentOf(rawLine);
    if (indent > maxIndent) maxIndent = indent;

    // Imports
    const importFrom = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
    const importPlain = trimmed.match(/^import\s+([\w.,\s]+)$/);
    if (importFrom) {
      imports.push({
        module: importFrom[1],
        names: importFrom[2]
          .replace(/[()]/g, "")
          .split(",")
          .map((n) => n.trim().split(/\s+as\s+/)[0])
          .filter(Boolean),
        line: lineNumber,
      });
    } else if (importPlain) {
      // "import a as x, b" — strip aliases and split comma-separated modules
      const modules = importPlain[1]
        .split(",")
        .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      imports.push({
        module: modules[0],
        names: modules.slice(1),
        line: lineNumber,
      });
    }

    // Definitions
    const defMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (defMatch) functions.push({ name: defMatch[1], line: lineNumber });
    if (classMatch) classes.push({ name: classMatch[1], line: lineNumber, methodCount: 0 });

    // Control flow counts
    if (/^(if|elif)\b/.test(trimmed)) branches++;
    if (/^(for|while)\b/.test(trimmed)) loops++;
    if (/^(try|except|finally)\b/.test(trimmed)) tryExcept++;
    if (/^except\s*:/.test(trimmed)) bareExceptLines.push(lineNumber);
  });

  if (sawTabIndent && sawSpaceIndent) {
    issues.push({
      line: 1,
      message: "Mixed tab and space indentation.",
    });
  }

  // Class method counts (defs indented inside a class block)
  for (const cls of classes) {
    let methodCount = 0;
    let inClass = false;
    rawLines.forEach((rawLine, idx) => {
      const lineNumber = idx + 1;
      if (lineNumber === cls.line) {
        inClass = true;
        return;
      }
      if (inClass) {
        const nextClass = classes.find((c) => c.line === lineNumber);
        if (nextClass) {
          inClass = false;
          return;
        }
        const t = stripComment(rawLine).trim();
        if (t.startsWith("def ") || t.startsWith("async def ")) methodCount++;
      }
    });
    cls.methodCount = methodCount;
  }

  for (const unclosed of stack) {
    issues.push({
      line: unclosed.line,
      message: `Unclosed '${unclosed.ch}'.`,
    });
  }

  return {
    lineCount: rawLines.length,
    codeLineCount: rawLines.length - blankLines - commentLines,
    commentLineCount: commentLines,
    blankLineCount: blankLines,
    imports,
    functions,
    classes,
    maxIndentLevel: maxIndent,
    branchCount: branches,
    loopCount: loops,
    tryExceptCount: tryExcept,
    bareExceptLines,
    issues,
  };
}

/* Real source snippet around a 1-based line number (up to `context` lines
 * either side, max 9 total). Returns null when the line is unknown. */
export function snippetForLine(
  code: string,
  line: number | null,
  context = 2,
): string | null {
  if (line === null || line < 1) return null;
  const lines = code.split(/\r?\n/);
  if (line > lines.length) return null;
  const start = Math.max(0, line - 1 - context);
  const end = Math.min(lines.length, line + context);
  return lines.slice(start, end).join("\n");
}

/* Find all lines matching a regex; returns 1-based line numbers with text. */
export function findMatches(
  code: string,
  re: RegExp,
): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const lines = code.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const withoutComment = stripComment(line);
    if (re.test(withoutComment)) {
      out.push({ line: idx + 1, text: withoutComment.trim() });
    }
  });
  return out;
}

export function hasImport(source: PythonStructure, moduleName: string): boolean {
  return source.imports.some(
    (imp) => imp.module === moduleName || imp.module.startsWith(`${moduleName}.`),
  );
}
