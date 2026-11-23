/**
 * The load budgets, in one place, because the site quotes them: How I work
 * promises "a 2.5-second load budget measured on a CPU slowed four times"
 * (src/content/practice.yaml). tests/budgets/vitals.spec.ts holds the site to
 * these, and tests/e2e/claims.spec.ts fails when the copy says otherwise.
 */

/** CLAUDE.md budget, held against the throttled run, the harder one. */
export const LCP_BUDGET = 2500;
export const CLS_BUDGET = 0.1;

/**
 * The CPU slowdown the budgets are measured under. This is a portfolio about
 * software that runs on hardware you do not get to choose.
 */
export const CPU_THROTTLE = 4;
