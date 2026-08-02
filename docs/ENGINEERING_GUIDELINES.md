# Engineering Guidelines

## General Rules
- **Naming**: `snake_case` for Python, `camelCase` for TypeScript, `PascalCase` for React components.
- **Typing**: Strict typing everywhere. Python must use type hints and Pydantic. TypeScript must have `strict: true`.
- **Formatting**: `black` and `isort` for Python. `prettier` for frontend.
- **Linting**: `flake8`/`ruff` for Python. `eslint` for frontend.
- **Module Boundaries**: Do not import across bounded contexts in the backend unless via explicit service interfaces. For example, `users` should not directly query the `areas` tables.
- **Database Rules**: All schema changes must use Alembic migrations. Never manually modify the production DB schema.
- **Error Handling**: Use standardized HTTP exception responses. Never expose raw stack traces to the frontend.
- **Secrets**: Never hardcode secrets. Use environment variables.
- **Definition of Done**: Code is written, tests pass, documentation is updated, and it has been manually verified locally.

## Rules for AI Coding Agents
Any AI agent working on this repository MUST adhere to the following rules:

1. **Inspect Before Modifying**: Always read existing files, architecture docs, and tests before making changes.
2. **Follow Existing Architecture**: Do not arbitrarily introduce new patterns (e.g., CQRS or Redux) if they don't already exist or aren't explicitly requested.
3. **Avoid Unrelated Refactors**: Only touch code necessary for the current task. Do not reformat the entire codebase just because you prefer a different style.
4. **Justify Dependencies**: Never add a new `pip` or `npm` package unless absolutely necessary and explicitly justified.
5. **Never Silently Weaken Tests**: If a test fails due to your change, fix your change, or explicitly explain why the test needs to be updated. Do not just delete or disable the test.
6. **Never Fabricate Data**: If you are writing a data ingestion script, do not invent dummy coordinates or rent prices and pretend they are real.
7. **Never Hardcode Secrets**: Always use `.env` files and environment variables.
8. **Document Significant Decisions**: If you make a notable architectural choice, log it in the Decision Record in `ARCHITECTURE.md`.
9. **Run Relevant Checks**: Suggest running linters and tests after making changes to verify correctness.
10. **Honest Reporting**: Always report exactly what changed, and be honest about any unresolved issues or limitations in your implementation.
