import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const reportJsonPath = path.join(rootDir, "data", "report.json");
const reportJsPath = path.join(rootDir, "data", "report.js");
const promptPath = path.join(rootDir, "config", "monitor-prompt.md");

const COVERED_CURRENCIES = ["USD", "EUR", "JPY", "NZD", "AUD", "CHF", "CAD", "GBP"];
const VALID_TONES = new Set(["Hawkish", "Neutral", "Dovish", "Unknown"]);
const VALID_STATUSES = new Set(["Scheduled", "Live", "Published"]);

const timezone = process.env.OPENAI_TIMEZONE || "America/Toronto";
const model = process.env.OPENAI_MODEL || "gpt-5.4";
const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "high";

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
  const normalizedTone = VALID_TONES.has(entry?.tone) ? entry.tone : "Unknown";
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

function buildSchema() {
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
            currency: { type: "string", enum: COVERED_CURRENCIES },
            bank: { type: "string" },
            member: { type: "string" },
            roleTitle: { type: "string" },
            communicationType: { type: "string" },
            status: { type: "string", enum: ["Scheduled", "Live", "Published"] },
            tone: { type: "string", enum: ["Hawkish", "Neutral", "Dovish", "Unknown"] },
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

async function fetchDailySnapshot(prompt, targetDate, existingEntriesForToday) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const systemPrompt = [
    "You are a senior macro and FX central bank communication analyst.",
    "Your job is to build a trader-grade, same-day communication map that is as complete as possible.",
    "Use live newswire flow first, official central bank sources second, and event schedules third.",
    "Return only JSON matching the provided schema.",
    "Do not invent communications or quotes.",
    "If a communication is only scheduled and no wording exists yet, keep status as Scheduled and tone as Unknown.",
    "Merge duplicate coverage into one best entry and keep the most complete source wording available.",
    "Prefer direct official URLs or original article URLs for sourceUrl."
  ].join(" ");

  const userPrompt = [
    `Today means ${targetDate} in ${timezone}.`,
    "",
    "Use this research prompt verbatim as the operating policy:",
    prompt,
    "",
    "Existing entries already stored for this same date are below. Update or replace them if you find better or more complete information, but do not duplicate the same communication.",
    JSON.stringify(existingEntriesForToday, null, 2),
    "",
    "Return only the structured JSON object with entries and sources."
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: reasoningEffort },
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
          name: "central_bank_signal_day",
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

  const responseBody = await response.json();

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${JSON.stringify(responseBody)}`);
  }

  const outputText = extractOutputText(responseBody);
  return JSON.parse(outputText);
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
  const snapshot = await fetchDailySnapshot(prompt, targetDate, existingEntriesForToday);

  const normalizedNewEntries = (snapshot.entries || [])
    .map((entry) => normalizeEntry(entry, targetDate))
    .filter((entry) => entry.date === targetDate)
    .filter((entry) => COVERED_CURRENCIES.includes(entry.currency))
    .filter(isEntryComplete);

  const historicalEntries = (existingReport.entries || []).filter((entry) => entry.date !== targetDate);
  const entries = dedupeEntries([...historicalEntries, ...normalizedNewEntries]);
  const sources = dedupeSources([...(existingReport.sources || []), ...(snapshot.sources || [])]);

  const report = {
    targetDate,
    timezone,
    generatedAt: new Date().toISOString(),
    runStatus: `Automated refresh completed via OpenAI Responses API using ${model}`,
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
