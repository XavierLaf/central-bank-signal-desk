# Daily refresh spec

Use this file when updating the dashboard data.

## Goal

Refresh `data/report.json` and `data/report.js` with a same-day central bank communication snapshot for:

- USD / Fed
- EUR / ECB
- JPY / BoJ
- NZD / RBNZ
- AUD / RBA
- CHF / SNB
- CAD / BoC
- GBP / BoE

## Inputs

- Read the research prompt in `config/monitor-prompt.md`
- Use same-day official central bank sources and real-time news flow where available

## Output file

- Update `data/report.json`
- Regenerate `data/report.js` from the same data
- Keep the global object name as `window.CENTRAL_BANK_MONITOR_DATA`
- Preserve historical entries already in the file so the tone chart can show drift over time

## Required fields

- `targetDate`
- `timezone`
- `generatedAt`
- `runStatus`
- `schedule`
- `coverageSummary`
- `prompt`
- `entries`
- `sources`

## Entry schema

Each object in `entries` must include:

- `date`
- `currency`
- `bank`
- `member`
- `roleTitle`
- `communicationType`
- `status`
- `tone`
- `quoteSummary`
- `interpretation`
- `expectedImpact`
- `sourceLabel`
- `sourceUrl`

## Rules

- Only add market-relevant same-day communication
- Merge duplicate reporting into one entry
- Use `Unknown` tone when an event is only scheduled and no wording is available
- Keep all strings readable in the dashboard
- Use real URLs in `sources` and `sourceUrl`
- Upsert by same-day identity rather than duplicating prior rows
- Preserve older entries so the tone chart can accumulate a timeline
- If no qualifying items exist for the new date, keep prior history and still update the report metadata
- Prefer the OpenAI Responses API with native `web_search`
