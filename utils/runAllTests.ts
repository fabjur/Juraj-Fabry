import { runAuditMetricsTestSuite } from './auditMetrics.test.ts';
import { runPriceIntegrityTestSuite } from './priceIntegrity.test.ts';
import { runBoundingBoxTestSuite } from './boundingBox.test.ts';
import { runDataAndSearchTestSuite } from './dataAndSearch.test.ts';
import { runExportTestSuite } from './export.test.ts';
import { runAuditWorkflowTestSuite } from './auditWorkflow.test.ts';

export interface SuiteSummary {
  name: string;
  passed: boolean;
  assertions: number;
  durationMs: number;
  results: string[];
}

export interface FullTestReport {
  timestamp: string;
  allPassed: boolean;
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  totalAssertions: number;
  totalDurationMs: number;
  suites: SuiteSummary[];
}

/**
 * Runs all functional test suites for Salesapp Vision.
 * Can be invoked from CLI (npx tsx utils/runAllTests.ts) or inside the React UI.
 */
export function executeAllAppTests(): FullTestReport {
  const startTime = performance.now();
  const suites: SuiteSummary[] = [];

  const runSuite = (name: string, fn: () => { passed: boolean; results: string[]; assertions?: number }): SuiteSummary => {
    const suiteStart = performance.now();
    try {
      const res = fn();
      const durationMs = Math.round((performance.now() - suiteStart) * 100) / 100;
      return {
        name,
        passed: res.passed,
        assertions: res.assertions ?? res.results.length,
        durationMs,
        results: res.results
      };
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - suiteStart) * 100) / 100;
      return {
        name,
        passed: false,
        assertions: 1,
        durationMs,
        results: [`ERROR: Exception in suite ${name}: ${err?.message || String(err)}`]
      };
    }
  };

  suites.push(runSuite('1. Metriky auditu a regálové počty (Audit Metrics)', runAuditMetricsTestSuite));
  suites.push(runSuite('2. Cenová integrita a OCR normalizácia (Price Integrity)', runPriceIntegrityTestSuite));
  suites.push(runSuite('3. Geometria a Bounding Boxy (IoU & Geometry)', runBoundingBoxTestSuite));
  suites.push(runSuite('4. Katalóg a textové párovanie (Search & Matching)', runDataAndSearchTestSuite));
  suites.push(runSuite('5. Export dát (CSV, XLS a sanitizácia)', runExportTestSuite));
  suites.push(runSuite('6. Priebeh auditu a verifikácia (Workflow & Triage)', runAuditWorkflowTestSuite));

  const totalDurationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const passedSuites = suites.filter(s => s.passed).length;
  const failedSuites = suites.filter(s => !s.passed).length;
  const allPassed = failedSuites === 0;
  const totalAssertions = suites.reduce((acc, s) => acc + s.assertions, 0);

  return {
    timestamp: new Date().toISOString(),
    allPassed,
    totalSuites: suites.length,
    passedSuites,
    failedSuites,
    totalAssertions,
    totalDurationMs,
    suites
  };
}

// CLI execution entry point
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('runAllTests')) {
  console.log(`========================================================`);
  console.log(`  SALESAPP VISION - KOMPLETNÝ TEST FUNKČNOSTI APLIKÁCIE `);
  console.log(`========================================================\n`);

  const report = executeAllAppTests();

  report.suites.forEach((suite, idx) => {
    const statusIcon = suite.passed ? '✓' : '✗';
    console.log(`[${idx + 1}/${report.totalSuites}] ${statusIcon} ${suite.name} (${suite.assertions} testov, ${suite.durationMs}ms)`);
    suite.results.forEach(line => {
      const isPass = line.startsWith('PASS:');
      console.log(`    ${isPass ? '✔' : '✖'} ${line}`);
    });
    console.log('');
  });

  console.log(`--------------------------------------------------------`);
  console.log(`SUMÁR TESTOV:`);
  console.log(`- Celkový stav:       ${report.allPassed ? 'VŠETKY TESTY ÚSPEŠNÉ ✓' : 'NIEKTORÉ TESTY ZLYHALI ✗'}`);
  console.log(`- Úspešné sady:       ${report.passedSuites} / ${report.totalSuites}`);
  console.log(`- Počet overení:      ${report.totalAssertions} overení`);
  console.log(`- Celkový čas behu:   ${report.totalDurationMs} ms`);
  console.log(`--------------------------------------------------------\n`);

  if (!report.allPassed) {
    process.exit(1);
  }
}
