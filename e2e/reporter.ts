import { coverageStats, DISCOVERED_ROUTES, kindStats, type ControlKind } from "./inventory";
import { mkdirSync, writeFileSync } from "node:fs";
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";

type Row = {
  suite: string;
  title: string;
  status: "PASS" | "FAIL" | "NOT RUN";
  file: string;
  error?: string;
};

const FILE_SUITE: Record<string, string> = {
  "routes.spec.ts": "ROUTES / NAVIGATION",
  "interactions.spec.ts": "CORE INTERACTIONS",
  "today.spec.ts": "TODAY",
  "people.spec.ts": "PEOPLE",
  "plan.spec.ts": "PLAN",
  "money.spec.ts": "MONEY",
  "more.spec.ts": "MORE",
  "data.spec.ts": "DATA INTEGRITY",
  "day-of.spec.ts": "DAY OF",
  "offline.spec.ts": "OFFLINE",
  "print.spec.ts": "PRINT CENTER",
  "permissions.spec.ts": "PERMISSIONS",
  "mobile.spec.ts": "MOBILE",
  "writes.spec.ts": "CREATE / EDIT / SAVE / CANCEL / DELETE",
  "crawl.spec.ts": "INVENTORY CRAWL",
};

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

class CertificationReporter implements Reporter {
  private rows: Row[] = [];
  private started = Date.now();
  private workers = 0;

  onBegin(config: FullConfig, _suite: Suite) {
    this.workers = config.workers;
    this.started = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const notRun = result.status === "skipped" || test.annotations.some((row) => row.type === "not-run");
    const status: Row["status"] =
      notRun ? "NOT RUN" : result.status === "passed" ? "PASS" : "FAIL";
    this.rows.push({
      suite: FILE_SUITE[fileName(test.location.file)] || "OTHER",
      title: test.title,
      status,
      file: fileName(test.location.file),
      error: result.errors[0]?.message?.replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0],
    });
  }

  onEnd(result: FullResult) {
    const elapsedMs = Date.now() - this.started;
    const passed = this.rows.filter((row) => row.status === "PASS").length;
    const failed = this.rows.filter((row) => row.status === "FAIL").length;
    const notRun = this.rows.filter((row) => row.status === "NOT RUN").length;
    const suites = [...new Set(this.rows.map((row) => row.suite))];
    const suiteLines = suites.map((suite) => {
      const items = this.rows.filter((row) => row.suite === suite);
      const ok = items.filter((row) => row.status === "PASS").length;
      const bad = items.filter((row) => row.status === "FAIL").length;
      const skip = items.filter((row) => row.status === "NOT RUN").length;
      const label = bad ? "FAIL" : ok ? "PASS" : "NOT RUN";
      return `${suite}\n${label} ${ok}/${items.length}${skip ? ` (${skip} not run)` : ""}`;
    });
    const kinds: ControlKind[] = [
      "route",
      "navigation",
      "create",
      "edit",
      "save",
      "cancel",
      "delete",
      "filter",
      "dialog",
      "day",
      "people",
      "plan",
      "money",
      "more",
      "print",
      "offline",
      "permissions",
      "mobile",
    ];
    const coverage = coverageStats();
    const kindLines = kinds.map((kind) => {
      const row = kindStats(kind);
      return `${kind.toUpperCase()}\n${row.automated}/${row.total}`;
    });
    const report = {
      status: result.status,
      workers: this.workers,
      elapsedMs,
      passed,
      failed,
      notRun,
      total: this.rows.length,
      fullReleaseCertification: failed === 0 && passed > 0 ? "PASS" : "FAIL",
      interactionCoverage: {
        percent: coverage.percent,
        automated: coverage.automated,
        notCovered: coverage.notCovered,
        total: coverage.total,
        routesDiscovered: DISCOVERED_ROUTES.length,
      },
      rows: this.rows,
    };
    mkdirSync("test-artifacts", { recursive: true });
    writeFileSync("test-artifacts/certification-report.json", JSON.stringify(report, null, 2));
    const md = [
      "# Certification run",
      "",
      `FULL RELEASE CERTIFICATION: **${report.fullReleaseCertification}**`,
      "",
      `Workers: ${this.workers}`,
      `Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
      `Passed ${passed} / failed ${failed} / not-run ${notRun} / total ${this.rows.length}`,
      "",
      `INTERACTION COVERAGE: ${coverage.percent}% (${coverage.automated}/${coverage.total} controls)`,
      "",
      ...kindLines.flatMap((line) => [line, ""]),
      ...suiteLines.flatMap((line) => [line, ""]),
      "## Items",
      "",
      ...this.rows.map(
        (row) => `- **${row.status}** [${row.suite}] ${row.title}${row.error ? ` — ${row.error}` : ""}`,
      ),
      "",
    ].join("\n");
    writeFileSync("test-artifacts/certification-report.md", md);
  }
}

export default CertificationReporter;
