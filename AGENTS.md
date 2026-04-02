<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Collaboration Preferences

- When I bring up a new feature, start by discussing the feature and planning the implementation before writing substantial code.
- Treat early feature conversations as planning sessions unless I explicitly ask you to jump straight into implementation.
- Help break features into clear phases or steps so we can make decisions intentionally.
- Build features step by step unless I explicitly ask for an end-to-end implementation.
- Do not complete an entire card in one pass by default.
- Before making a substantial change, explain the next step in plain English.
- Before implementing a feature, discuss architecture and file structure when those decisions matter.
- Surface important architectural decisions explicitly instead of making them silently.
- When there are tradeoffs, recommend an option but explain why it is the better fit.
- After each step, summarize what changed, why it was done, and what the next logical step is.
- Prefer small, reviewable changes over large multi-part implementations.
- When writing code, explain it in clear blocks tied to the actual files being changed.
- Assume I want to understand the code, not just receive the final implementation.
- Optimize for helping me learn, not just for finishing the task quickly.
- Explain why a pattern, abstraction, or structure is being introduced so I can learn the reasoning behind it.
- Include architectural reasoning when suggesting refactors, module boundaries, or data-flow decisions.
- Call out when a decision is temporary, scalable, or likely to need revisiting later.
- If there are multiple reasonable implementation options, briefly explain the tradeoffs before choosing.
- Call out refactors that would make future development easier, especially before complexity grows.
- Keep momentum, but pause at natural checkpoints so we can discuss direction before continuing.
- Pause for confirmation at major decision points when the choice affects architecture, maintainability, or future extensibility.
- Add concise comments for non-obvious logic when they help readability.
- Favor maintainable structure and separation of concerns over quick inline implementations.

## Database Change Standard

- When changing the database schema, always update the migration files, [`docs/database-schema.md`](/Users/rafaelmarco/Repositories/ai-boss/docs/database-schema.md), and [`types/database.ts`](/Users/rafaelmarco/Repositories/ai-boss/types/database.ts) in the same piece of work.
- Treat migration SQL as the database source of truth, and keep [`types/database.ts`](/Users/rafaelmarco/Repositories/ai-boss/types/database.ts) in sync so application code can rely on typed row shapes.
- When reading or writing database-backed app code, refer to [`types/database.ts`](/Users/rafaelmarco/Repositories/ai-boss/types/database.ts) instead of re-declaring duplicate table interfaces in feature files unless there is a strong reason not to.
- When implementing features that touch database-backed data, use [`types/database.ts`](/Users/rafaelmarco/Repositories/ai-boss/types/database.ts) as the application source of truth for row and entity shapes, and only create feature-local types when they represent view models or transformed data rather than raw database records.
