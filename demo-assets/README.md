# AI-BOSS Demo Assets

Use these files for the stakeholder demo.

- `ai-boss-demo-full-metrics.csv` - baseline structured metric upload.
- `ai-boss-demo-updated-month.csv` - partial upload that proves latest values can mix with older missing metrics.
- `ai-boss-demo-risky-month.csv` - lower-runway scenario for urgent-risk questions.
- `ai-boss-demo-board-report.pdf` - PDF-only board report for RAG evidence, not dashboard calculations.

Suggested order:

1. Upload `ai-boss-demo-full-metrics.csv`.
2. Ask chat: `What is my runway and what source did you use?`
3. Upload `ai-boss-demo-board-report.pdf`.
4. Ask chat: `What does the uploaded board report say about cash risk and next actions?`
5. Upload `ai-boss-demo-updated-month.csv`.
6. Ask chat: `What changed after the newer upload, and which metrics are still coming from an older source?`
