import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const reportJsonPath = path.join(rootDir, "data", "report.json");
const reportJsPath = path.join(rootDir, "data", "report.js");
const promptPath = path.join(rootDir, "config", "monitor-prompt.md");

const COVERED_CURRENCIES = ["USD", "EUR", "JPY", "NZD", "AUD", "CHF", "CAD", "GBP"];
const VALID_TONES = new Set(["Hawkish", "Neutral", "Dovish"]);
const VALID_STATUSES = new Set(["Scheduled", "Live", "Published"]);
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 180000);
const RETRY_TIMEOUT_MS = Number(process.env.OPENAI_RETRY_TIMEOUT_MS || 90000);

const timezone = process.env.OPENAI_TIMEZONE || "America/Toronto";
const model = process.env.OPENAI_MODEL || "gpt-5.4";
const requestedReasoningEffort = process.env.OPENAI_REASONING_EFFORT || "high";

function resolveReasoningEffort(modelName, effort) {
  const normalizedModel = (modelName || "").toLowerCase();
  const normalizedEffort = (effort || "").toLowerCase();

  if (normalizedModel.includes("chat-latest") && (normalizedEffort === "high" || normalizedEffort === "xhigh")) {
    return "medium";
  }

  return effort;
}

const reasoningEffort = resolveReasoningEffort(model, requestedReasoningEffort);
const GLOBAL_RESEARCH_SCOPE = [
  "Cover USD / Federal Reserve including the Board and all regional Fed banks.",
  "Cover EUR / ECB including the Governing Council and Eurosystem speakers.",
  "Cover JPY / Bank of Japan including Reuters-reported remarks and official BOJ publications.",
  "Cover NZD / Reserve Bank of New Zealand.",
  "Cover AUD / Reserve Bank of Australia including Assistant Governors.",
  "Cover CHF / Swiss National Bank.",
  "Cover CAD / Bank of Canada.",
  "Cover GBP / Bank of England including MPC members."
].join(" ");

function getTargetDate(timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

async function readJson(filePath, fallbackValue) {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch {
    return fallbackValue;
  }
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function normalizeEntry(entry, fallbackDate) {
  const normalizedTone = VALID_TONES.has(entry?.tone) ? entry.tone : "";
  const normalizedStatus = VALID_STATUSES.has(entry?.status) ? entry.status : "Published";

  return {
    date: normalizeText(entry?.date, fallbackDate),
    currency: normalizeText(entry?.currency).toUpperCase(),
    bank: normalizeText(entry?.bank),
    member: normalizeText(entry?.member),
    roleTitle: normalizeText(entry?.roleTitle),
    communicationType: normalizeText(entry?.communicationType),
    status: normalizedStatus,
    tone: normalizedTone,
    quoteSummary: normalizeText(entry?.quoteSummary),
    interpretation: normalizeText(entry?.interpretation),
    expectedImpact: normalizeText(entry?.expectedImpact),
    sourceLabel: normalizeText(entry?.sourceLabel),
    sourceUrl: normalizeText(entry?.sourceUrl)
  };
}

function isEntryComplete(entry) {
  return [
    entry.date,
    entry.currency,
    entry.bank,
    entry.member,
    entry.roleTitle,
    entry.communicationType,
    entry.status,
    entry.tone,
    entry.quoteSummary,
    entry.interpretation,
    entry.expectedImpact,
    entry.sourceLabel,
    entry.sourceUrl
  ].every(Boolean);
}

function dedupeEntries(entries) {
  const map = new Map();

  for (const entry of entries) {
    const key = [
      entry.date,
      entry.currency,
      entry.member,
      entry.communicationType,
      entry.status
    ]
      .join("::")
      .toLowerCase();

    map.set(key, entry);
  }

  return [...map.values()].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    if (left.currency !== right.currency) {
      return left.currency.localeCompare(right.currency);
    }
    if (left.member !== right.member) {
      return left.member.localeCompare(right.member);
    }
    return left.communicationType.localeCompare(right.communicationType);
  });
}

function dedupeSources(sources) {
  const map = new Map();

  for (const source of sources) {
    if (!source?.url) {
      continue;
    }

    map.set(source.url, {
      label: normalizeText(source.label),
      url: normalizeText(source.url),
      note: normalizeText(source.note)
    });
  }

  return [...map.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function extractOutputText(responseBody) {
  if (typeof responseBody?.output_text === "string" && responseBody.output_text.trim()) {
    return responseBody.output_text.trim();
  }

  const message = responseBody?.output?.find((item) => item.type === "message");
  const textBlock = message?.content?.find((item) => item.type === "output_text" && typeof item.text === "string");

  if (textBlock?.text) {
    return textBlock.text.trim();
  }

  throw new Error("OpenAI response did not include parseable output text.");
}

function buildSchema(currencyEnum = COVERED_CURRENCIES) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["entries", "sources"],
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "date",
            "currency",
            "bank",
            "member",
            "roleTitle",
            "communicationType",
            "status",
            "tone",
            "quoteSummary",
            "interpretation",
            "expectedImpact",
            "sourceLabel",
            "sourceUrl"
          ],
          properties: {
            date: { type: "string" },
            currency: { type: "string", enum: currencyEnum },
            bank: { type: "string" },
            member: { type: "string" },
            roleTitle: { type: "string" },
            communicationType: { type: "string" },
            status: { type: "string", enum: ["Scheduled", "Live", "Published"] },
            tone: { type: "string", enum: ["Hawkish", "Neutral", "Dovish"] },
            quoteSummary: { type: "string" },
            interpretation: { type: "string" },
            expectedImpact: { type: "string" },
            sourceLabel: { type: "string" },
            sourceUrl: { type: "string" }
          }
        }
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "url", "note"],
          properties: {
            label: { type: "string" },
            url: { type: "string" },
            note: { type: "string" }
          }
        }
      }
    }
  };
}

async function fetchDailySnapshot(prompt, targetDate, existingEntriesForToday, effort = reasoningEffort, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const systemPrompt = [
    "You are a senior macro and FX central bank communication analyst.",
    "Your job is to build a trader-grade, same-day communication map that is as complete as possible across all covered central banks.",
    "Use live newswire flow first, official central bank sources second, and event schedules third.",
    "Return only JSON matching the provided schema.",
    "Do not invent communications or quotes.",
    "If a communication is only scheduled or there is not enough wording to defend a Hawkish, Neutral, or Dovish read, omit it from the output.",
    "Merge duplicate coverage into one best entry and keep the most complete source wording available.",
    "Prefer direct official URLs or original article URLs for sourceUrl.",
    GLOBAL_RESEARCH_SCOPE,
    "Err on the side of completeness for same-day market-relevant remarks."
  ].join(" ");

  const userPrompt = [
    `Today means ${targetDate} in ${timezone}.`,
    `Research all covered central banks for ${targetDate}.`,
    "",
    "Use this research prompt verbatim as the operating policy:",
    prompt,
    "",
    "Existing entries already stored for this same date are below. Update or replace them if you find better or more complete information, but do not duplicate the same communication.",
    JSON.stringify(existingEntriesForToday, null, 2),
    "",
    "Return only the structured JSON object with entries and sources."
  ].join("\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        reasoning: { effort },
        tools: [
          {
            type: "web_search",
            user_location: {
              type: "approximate",
              country: process.env.OPENAI_COUNTRY || "CA",
              city: process.env.OPENAI_CITY || "Toronto",
              region: process.env.OPENAI_REGION || "Ontario",
              timezone
            }
          }
        ],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        text: {
          format: {
            type: "json_schema",
            name: "central_bank_signal_day_all",
            strict: true,
            schema: buildSchema()
          }
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`OpenAI request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const responseBody = await response.json();

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${JSON.stringify(responseBody)}`);
  }

  const outputText = extractOutputText(responseBody);
  return JSON.parse(outputText);
}

async function fetchSnapshotWithRetry(prompt, targetDate, existingEntriesForToday) {
  try {
    return await fetchDailySnapshot(prompt, targetDate, existingEntriesForToday, reasoningEffort, REQUEST_TIMEOUT_MS);
  } catch (error) {
    const isTimeout = String(error?.message || "").includes("timed out");
    const shouldRetryWithMedium = isTimeout && reasoningEffort !== "medium";

    if (shouldRetryWithMedium) {
      try {
        console.warn("Retrying refresh with medium reasoning after timeout.");
        return await fetchDailySnapshot(prompt, targetDate, existingEntriesForToday, "medium", RETRY_TIMEOUT_MS);
      } catch (retryError) {
        console.warn(`Refresh failed after retry: ${retryError.message}`);
        return {
          entries: [],
          sources: [],
          warning: `Daily refresh skipped after retry failure: ${retryError.message}`
        };
      }
    }

    console.warn(`Daily refresh failed: ${error.message}`);
    return {
      entries: [],
      sources: [],
      warning: `Daily refresh skipped: ${error.message}`
    };
  }
}

async function main() {
  const prompt = await readFile(promptPath, "utf8");
  const existingReport = await readJson(reportJsonPath, {
    targetDate: "",
    timezone,
    generatedAt: "",
    runStatus: "No report generated yet",
    schedule: {
      label: "Daily at 6:30 PM ET",
      timezone
    },
    coverageSummary: {
      checked: COVERED_CURRENCIES,
      note: "Only currencies with same-day market-relevant communication are surfaced in the board."
    },
    prompt,
    entries: [],
    sources: []
  });

  const targetDate = getTargetDate(timezone);
  const existingEntriesForToday = (existingReport.entries || []).filter((entry) => entry.date === targetDate);
  const snapshot = await fetchSnapshotWithRetry(prompt, targetDate, existingEntriesForToday);
  const snapshots = [snapshot];

  const normalizedNewEntries = snapshots
    .flatMap((snapshot) => snapshot.entries || [])
    .map((entry) => normalizeEntry(entry, targetDate))
    .filter((entry) => entry.date === targetDate)
    .filter((entry) => COVERED_CURRENCIES.includes(entry.currency))
    .filter((entry) => entry.tone !== "Unknown")
    .filter(isEntryComplete);

  const historicalEntries = (existingReport.entries || []).filter((entry) => entry.date !== targetDate);
  const entries = dedupeEntries([...historicalEntries, ...normalizedNewEntries]);
  const referencedSourceUrls = new Set(entries.map((entry) => entry.sourceUrl));
  const sources = dedupeSources([
    ...(existingReport.sources || []),
    ...snapshots.flatMap((snapshot) => snapshot.sources || [])
  ])
    .filter((source) => referencedSourceUrls.has(source.url));
  const warnings = snapshots
    .map((snapshot) => snapshot.warning)
    .filter(Boolean);

  const report = {
    targetDate,
    timezone,
    generatedAt: new Date().toISOString(),
    runStatus: warnings.length
      ? `Automated refresh completed via OpenAI Responses API using ${model} with warnings: ${warnings.join(" | ")}`
      : `Automated refresh completed via OpenAI Responses API using ${model}`,
    schedule: {
      label: "Daily at 6:30 PM ET",
      timezone
    },
    coverageSummary: {
      checked: COVERED_CURRENCIES,
      note: "Only currencies with same-day market-relevant communication are surfaced in the board."
    },
    prompt,
    entries,
    sources
  };

  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportJsPath, `window.CENTRAL_BANK_MONITOR_DATA = ${JSON.stringify(report, null, 2)};\n`, "utf8");

  console.log(`Updated report for ${targetDate} with ${normalizedNewEntries.length} entry${normalizedNewEntries.length === 1 ? "" : "ies"} using ${model}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
