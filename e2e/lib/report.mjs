// Shared PASS/FAIL/WARN collector for the E2E suites.
//
// The entrypoints historically each closed over their own log()/run()/pass/fail/
// warn/allResults. This is the same collector hoisted once, so every suite
// reports identically and the runners (which key off the mjs exit code) can
// trust the counts.

export function createReport(label, title) {
  const allResults = [];
  let pass = 0, fail = 0, warn = 0;

  const log = (cat, name, status, detail) => {
    const line = `[${cat}] ${status} ${name}: ${detail || ''}`;
    allResults.push(line);
    console.log(line);
    if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  };

  const run = async (cat, name, fn) => {
    const res = await fn();
    if (res && res.__error) log(cat, name, 'FAIL', res.__error);
    return res;
  };

  const counts = () => ({ pass, fail, warn, total: pass + fail + warn });

  const summary = () => {
    console.log(`[${label}] ${title}: PASS=${pass}  FAIL=${fail}  WARN=${warn}  TOTAL=${pass + fail + warn}`);
  };

  // Preserve the established contract: 0 clean, 1 warns, 2 any failure.
  const exitCode = () => (fail > 0 ? 2 : (warn > 0 ? 1 : 0));

  return { allResults, log, run, counts, summary, exitCode };
}