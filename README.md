# Central Bank Signal Desk

This is a deployable static webapp for tracking daily central bank communication across:

- USD / Fed
- EUR / ECB
- JPY / BoJ
- NZD / RBNZ
- AUD / RBA
- CHF / SNB
- CAD / BoC
- GBP / BoE

## Files

- `index.html` - main dashboard
- `styles.css` - UI styling
- `app.js` - rendering and filtering logic
- `data/report.json` - canonical rolling communication archive plus latest snapshot metadata
- `data/report.js` - browser-friendly mirror of the same report data
- `config/monitor-prompt.md` - the exact prompt used for daily updates
- `scripts/update-report.mjs` - scheduled OpenAI refresh script
- `.github/workflows/daily-refresh.yml` - daily GitHub Actions refresh job
- `.github/workflows/deploy-pages.yml` - GitHub Pages deployment workflow

## Live architecture

- GitHub Pages serves the frontend publicly
- GitHub Actions runs `scripts/update-report.mjs` once per day
- The refresh script calls the OpenAI Responses API with native web search
- The workflow commits updated report files back into the repo
- A push then redeploys the live site automatically

## Why this version is better

- your OpenAI API key stays server-side in GitHub secrets
- the site is live on the web instead of tied to a local Codex session
- the history file keeps accumulating, so the tone chart improves over time
- the refresh uses the OpenAI Responses API with `web_search`, which is closer to the ChatGPT-style retrieval flow than the earlier local-only setup

## One-time setup

1. Push this project to a GitHub repository.
2. In GitHub, enable Pages for the repository and select `GitHub Actions` as the source.
3. Add a repository secret named `OPENAI_API_KEY`.
4. Optionally add repository variables:
   - `OPENAI_MODEL`
   - `OPENAI_REASONING_EFFORT`
   - `OPENAI_TIMEZONE`
   - `OPENAI_COUNTRY`
   - `OPENAI_CITY`
   - `OPENAI_REGION`
5. Run the `Deploy Pages` workflow once.
6. Run the `Daily Refresh` workflow once to verify the data pipeline.

## Recommended variables

- `OPENAI_MODEL=gpt-5.4`
- `OPENAI_REASONING_EFFORT=high`
- `OPENAI_TIMEZONE=America/Toronto`
- `OPENAI_COUNTRY=CA`
- `OPENAI_CITY=Toronto`
- `OPENAI_REGION=Ontario`

If you want to experiment with a ChatGPT-adjacent behavior, try `OPENAI_MODEL=gpt-5.2-chat-latest`.

## Viewing the app

- Live: open the GitHub Pages URL after deployment
- Local: open `index.html` in a browser

## Updating the data manually

1. Set `OPENAI_API_KEY` in your shell.
2. Run `node scripts/update-report.mjs`.
3. Refresh the page.

## Notes

- The scheduled workflow runs at `23:35 UTC`, which is close to the North American evening close. Adjust the cron if you want a different publish time.
- Bloomberg and WSJ style coverage can still depend on what the web tool can reach, but this setup is materially stronger than the earlier Codex-only local prompt flow because it is using the OpenAI API with native web search.
