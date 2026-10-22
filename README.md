# Notara

**Live:** https://notara-rose.vercel.app

An AI research notebook in the style of NotebookLM. It runs on **Groq** (free, `openai/gpt-oss-120b`) or **Claude** (`claude-opus-5-5`).

## AI providers

| Key | Provider | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Opus 5.5 | Reads whole sources (up to ~1M tokens) with native citations. Used whenever it is set. |
| `GROQ_API_KEY` | Groq `openai/gpt-oss-120b` | Free. The free plan allows ~8,000 tokens per minute, so Notara sends the most relevant passages instead of whole files. Images are read with `qwen/qwen3.8-27b`; Discover uses Groq browser search. |

Visitors can also paste their own `sk-ant-…` or `gsk_…` key in **Settings**. Optional Groq tuning: `GROQ_MODEL`, `GROQ_VISION_MODEL`, `GROQ_CONTEXT_CHARS` (default 12000), `GROQ_MAX_OUTPUT` (default 3000); raise the last two on a paid Groq plan.

## Features

**Sources**
- Upload PDF, Word (.docx), TXT, Markdown, CSV, HTML and subtitle files
- Images (photos of notes, screenshots, scans) are transcribed by Claude
- Import websites (clean article text) and YouTube videos (from captions)
- **Discover**: Claude searches the web for sources on a topic; you pick which to import
- Paste text, or turn any note into a source
- An automatic source guide for each source (summary, key topics) and a notebook overview with suggested questions
- Pick which sources the chat and Studio use

**Chat**
- Answers grounded in your sources, with numbered citations. Hover a citation to see the quote; click it to open the source with the passage highlighted.
- Answer styles: Balanced, Learning guide, Concise, Detailed, Explain like I'm 10
- 16 output languages, including Urdu and Roman Urdu
- Voice input, read aloud, copy, save to note, download any answer

**Studio**: Audio Overview (two-host podcast with transcript and voice picker), Mind Map (interactive, collapsible), Study Guide, Briefing Doc, FAQ, Timeline, Flashcards (study mode), Quiz (scored), Slide Deck, Data Table (sortable), Blog Post, Custom Report. Each one can be customised by length, difficulty, count, focus and language.

**Downloads**
| What | Formats |
|---|---|
| Reports, notes, chat, answers | PDF, Word, Markdown, TXT, HTML |
| Slide deck | PowerPoint (.pptx) |
| Mind map | PNG, SVG |
| Flashcards | CSV that imports into Anki or Quizlet |
| Quiz, data table | CSV |
| Whole notebook | ZIP (sources, notes, studio outputs, chat) or a JSON backup you can restore |

Notebooks are stored in the browser (IndexedDB), with no account or database.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add GROQ_API_KEY and/or ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this folder to GitHub and import it in Vercel (or run `vercel`).
2. Add the `GROQ_API_KEY` and/or `ANTHROPIC_API_KEY` environment variables.
3. Deploy. The API routes need up to 300 seconds for large Studio outputs, so a plan that allows long function durations is recommended.


---
Designed & developed by Muhammad Talha Khan.
