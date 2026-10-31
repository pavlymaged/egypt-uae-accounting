# Project memory

## Product intent & audience

- **App domain:** Expense management system supporting batch expense creation, line-item editing, payments, fees, projects, clients, item codes, and categories.
- **Framework:** Vite + React (JSX), Tailwind CSS, Lucide React icons. Node.js runtime.
- **i18n:** Bilingual English/Arabic UI; Arabic search must work with and without vowel marks.
- **Audience:** Users entering and managing expense batches in a financial/accounting context.

## Brand personality & voice

- Professional, precise, production-quality finance tool.
- Trustworthy and robust: graceful error handling, clear messaging.

## Visual design & UX direction

- **Line editor layout:** Each expense line is a card at every breakpoint; no horizontal scrolling. Labels above every field. Responsive 12-column grid on wide screens, single-column stack on phones.
  - Row 1: Date, Project, Paying account
  - Row 2: Category, Item code (wide), Amount
  - Row 3: Description (wide), Return checkbox, Exchange rate (conditional), Receipt link
  - Remove and Copy buttons at top-right of each card
- **Error boundary:** Expense editor wrapped in error boundary; shows "Something went wrong in this screen. Please reload the page." + Reload button (localized EN/AR); logs error to console.
- **Missing Arabic name fallback:** Display English name instead of blank for items without Arabic name (editor + batch details).
- **Avoid:** table-based line editors prone to overflow; raw number-to-string coercion bugs in search.

## Decisions, constraints & rationale

- **Search safety:** All search/filter logic must safely handle missing/null/undefined fields before calling string methods (`includes`, `toLowerCase`, `startsWith`). Convert numeric fields to string before text matching.
- **No new packages:** Use only Tailwind, React hooks, Lucide React per `.bolt/prompt`. No UI theme/icon libraries.
- **Bug-fix-only constraint:** This turn restricted changes to bug fixes only—no new features, no database changes.
- **Build verification:** Type check (`tsc`), lint, and production build all pass. 16 pre-existing lint warnings remain.
- **Prompts 4–7 scope:** Prior prompts added search boxes/selects for payments, fees, projects, clients, item codes reference, category list, milestone values—all audited and confirmed safe.

## Open questions & assumptions

- Browser runtime testing not performed; only static checks (type check, lint, build) verified.
- Assumption: item code numeric values may return from persistence/database as numbers and must be coerced to string on load.
- Unresolved: whether other entities beyond item codes (e.g., account numbers, project codes) could have missing localized name fields—currently only item codes known to have gaps.