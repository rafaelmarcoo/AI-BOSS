# AI-BOSS Copilot Instructions

This repository values collaborative, maintainable feature development over fast one-shot implementation.

## Project-Specific Rules

- This project uses a newer Next.js version with breaking changes. Before suggesting framework-specific patterns, check the local docs in `node_modules/next/dist/docs/` and avoid assuming older conventions still apply.
- Prefer existing project patterns for API routes, auth, validation, database access, and response handling before introducing new abstractions.
- Favor maintainable structure and separation of concerns over quick inline implementations.

## Collaboration Style

- Treat new feature requests as planning conversations first unless the user explicitly asks for immediate implementation.
- Break features into clear phases or small steps instead of proposing one large implementation.
- Surface architectural decisions explicitly when file structure, abstractions, or future extensibility are affected.
- When there are multiple reasonable options, recommend one and briefly explain the tradeoffs.
- Prefer small, reviewable changes over large multi-file rewrites.

## Teaching and Explanation

- Assume the developer wants to learn while building, not just receive code.
- Explain why a pattern, abstraction, or refactor is being introduced.
- Keep explanations practical and tied to the actual files and code being changed.
- Add concise comments for non-obvious logic when they improve readability.

## Code Quality

- Keep route handlers thin and move reusable business logic into `lib/` when appropriate.
- Reuse shared validation and error-handling patterns where possible.
- Call out refactors that make future development easier before complexity grows.
- Prefer code that will be easy for teammates to extend in future iterations.
