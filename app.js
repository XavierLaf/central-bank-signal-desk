(function () {
  const state = {
    currency: "USD",
    search: "",
    timezone: "America/Toronto",
    chartWindowSelections: {}
  };

  const summaryGrid = document.getElementById("summary-grid");
  const nextRefresh = document.getElementById("next-refresh");
  const lastRun = document.getElementById("last-run");
  const tableBody = document.getElementById("table-body");
  const chartMeta = document.getElementById("chart-meta");
  const chartWindowSelect = document.getElementById("chart-window-select");
  const policyMetaGrid = document.getElementById("policy-meta-grid");
  const toneChart = document.getElementById("tone-chart");
  const sourceList = document.getElementById("source-list");
  const searchInput = document.getElementById("search-input");
  const timezoneOptions = [
    "America/Toronto",
    "America/New_York",
    "UTC",
    "Europe/London",
    "Europe/Zurich",
    "Europe/Frankfurt",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland"
  ];
  const toneScoreMap = {
    Dovish: -1,
    Neutral: 0,
    Hawkish: 1
  };

  const currencyColorMap = {
    USD: "#d4af37",
    EUR: "#c0c0c0",
    JPY: "#f0d58a",
    NZD: "#8e95a3",
    AUD: "#b8922f",
    CHF: "#e3e3e3",
    CAD: "#9c8b58",
    GBP: "#b6a06a"
  };

  const policyWindowMap = {
    USD: [
      {
        id: "2026-03-18",
        previousDecisionDate: "2026-03-18",
        nextDecisionDate: "2026-04-29",
        rateDisplay: "3.50%-3.75%",
        moveSummary: "Stayed at 3.50%-3.75%"
      },
      {
        id: "2026-01-28",
        previousDecisionDate: "2026-01-28",
        nextDecisionDate: "2026-03-18",
        rateDisplay: "3.50%-3.75%",
        moveSummary: "Stayed at 3.50%-3.75%"
      }
    ],
    EUR: [
      {
        id: "2026-03-19",
        previousDecisionDate: "2026-03-19",
        nextDecisionDate: "2026-04-30",
        rateDisplay: "2.00%",
        moveSummary: "Stayed at 2.00%"
      },
      {
        id: "2026-02-05",
        previousDecisionDate: "2026-02-05",
        nextDecisionDate: "2026-03-19",
        rateDisplay: "2.00%",
        moveSummary: "Stayed at 2.00%"
      }
    ],
    JPY: [
      {
        id: "2026-03-19",
        previousDecisionDate: "2026-03-19",
        nextDecisionDate: "2026-04-28",
        rateDisplay: "0.75%",
        moveSummary: "Stayed at 0.75%"
      },
      {
        id: "2026-01-23",
        previousDecisionDate: "2026-01-23",
        nextDecisionDate: "2026-03-19",
        rateDisplay: "0.75%",
        moveSummary: "Stayed at 0.75%"
      }
    ],
    NZD: [
      {
        id: "2026-02-18",
        previousDecisionDate: "2026-02-18",
        nextDecisionDate: "2026-04-08",
        rateDisplay: "2.25%",
        moveSummary: "Stayed at 2.25%"
      },
      {
        id: "2025-11-26",
        previousDecisionDate: "2025-11-26",
        nextDecisionDate: "2026-02-18",
        rateDisplay: "2.25%",
        moveSummary: "Down from 2.50% to 2.25%"
      }
    ],
    AUD: [
      {
        id: "2026-03-17",
        previousDecisionDate: "2026-03-17",
        nextDecisionDate: "2026-05-05",
        rateDisplay: "4.10%",
        moveSummary: "Up from 3.85% to 4.10%"
      },
      {
        id: "2026-02-03",
        previousDecisionDate: "2026-02-03",
        nextDecisionDate: "2026-03-17",
        rateDisplay: "3.85%",
        moveSummary: "Up from 3.60% to 3.85%"
      }
    ],
    CHF: [
      {
        id: "2026-03-19",
        previousDecisionDate: "2026-03-19",
        nextDecisionDate: "2026-06-18",
        rateDisplay: "0.00%",
        moveSummary: "Stayed at 0.00%"
      },
      {
        id: "2025-12-11",
        previousDecisionDate: "2025-12-11",
        nextDecisionDate: "2026-03-19",
        rateDisplay: "0.00%",
        moveSummary: "Stayed at 0.00%"
      }
    ],
    CAD: [
      {
        id: "2026-03-18",
        previousDecisionDate: "2026-03-18",
        nextDecisionDate: "2026-04-29",
        rateDisplay: "2.25%",
        moveSummary: "Stayed at 2.25%"
      },
      {
        id: "2026-01-28",
        previousDecisionDate: "2026-01-28",
        nextDecisionDate: "2026-03-18",
        rateDisplay: "2.25%",
        moveSummary: "Stayed at 2.25%"
      }
    ],
    GBP: [
      {
        id: "2026-03-19",
        previousDecisionDate: "2026-03-19",
        nextDecisionDate: "2026-04-30",
        rateDisplay: "3.75%",
        moveSummary: "Stayed at 3.75%"
      },
      {
        id: "2026-02-05",
        previousDecisionDate: "2026-02-05",
        nextDecisionDate: "2026-03-19",
        rateDisplay: "3.75%",
        moveSummary: "Stayed at 3.75%"
      }
    ]
  };

  let data = null;

  const buildEntryKey = (entry) =>
    [
      entry.date,
      entry.currency,
      entry.member,
      entry.communicationType,
      entry.status
    ]
      .join("::")
      .toLowerCase();

  const parseEntryDate = (value) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

  const startOfWeek = (date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return start;
  };

  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  };

  const endOfDay = (date) => {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  };

  const mergeDataSets = (baseData, historyData) => {
    const actionableBaseEntries = (baseData.entries || []).filter((entry) => entry.tone !== "Unknown");
    const actionableHistoryEntries = (historyData?.entries || []).filter((entry) => entry.tone !== "Unknown");

    if (!historyData?.entries?.length) {
      return { ...baseData, entries: actionableBaseEntries, importedHistoryCount: 0 };
    }

    const entryMap = new Map();
    actionableHistoryEntries.forEach((entry) => {
      entryMap.set(buildEntryKey(entry), entry);
    });
    actionableBaseEntries.forEach((entry) => {
      entryMap.set(buildEntryKey(entry), entry);
    });

    const sourceMap = new Map();
    [...(historyData.sources || []), ...(baseData.sources || [])].forEach((source) => {
      if (!source?.url) {
        return;
      }

      sourceMap.set(source.url, source);
    });

    const entries = [...entryMap.values()].sort((left, right) => {
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

    const sources = [...sourceMap.values()].sort((left, right) => left.label.localeCompare(right.label));

    return {
      ...baseData,
      entries,
      sources,
      importedHistoryCount: actionableHistoryEntries.length
    };
  };

  const readImportedHistory = async () => {
    if (window.CENTRAL_BANK_MONITOR_HISTORY_READY) {
      await window.CENTRAL_BANK_MONITOR_HISTORY_READY;
    }

    return window.CENTRAL_BANK_MONITOR_HISTORY;
  };

  const showFatalState = (message) => {
    document.body.innerHTML = `<main class="page-shell"><div class="empty-state">${message}</div></main>`;
  };

  const resolveInitialTimezone = () => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimezone) {
      return browserTimezone;
    }

    return data?.timezone || "America/Toronto";
  };

  const formatTimezoneLabel = (timezone) =>
    timezone
      .replaceAll("_", " ")
      .split("/")
      .join(" / ");

  const formatDateTime = (value) => {
    if (!value) {
      return "Unknown";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: state.timezone || data?.timezone || "America/Toronto"
    }).format(parsed);
  };

  const formatCalendarDate = (value) => {
    const parsed = parseEntryDate(value);
    if (!parsed) {
      return value;
    }

    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(parsed);
  };

  const getPolicyWindowsForCurrency = (currency) => policyWindowMap[currency] || [];

  const ensureChartWindowSelection = (currency) => {
    const windows = getPolicyWindowsForCurrency(currency);
    if (!windows.length) {
      delete state.chartWindowSelections[currency];
      return null;
    }

    const selectedId = state.chartWindowSelections[currency];
    const matchedWindow = windows.find((window) => window.id === selectedId);
    if (matchedWindow) {
      return matchedWindow;
    }

    state.chartWindowSelections[currency] = windows[0].id;
    return windows[0];
  };

  const getSelectedChartWindow = () => ensureChartWindowSelection(state.currency);

  const getChartEntries = () => {
    const selectedWindow = getSelectedChartWindow();
    if (!selectedWindow) {
      return [];
    }

    return data.entries
      .filter((entry) => entry.currency === state.currency)
      .filter((entry) => {
        const entryDate = parseEntryDate(entry.date);
        const startDate = parseEntryDate(selectedWindow.previousDecisionDate);
        const endDate = parseEntryDate(selectedWindow.nextDecisionDate);

        if (!entryDate || !startDate || !endDate) {
          return false;
        }

        return entryDate >= startDate && entryDate <= endDate;
      })
      .sort((left, right) => {
        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }

        return left.member.localeCompare(right.member);
      });
  };

  const formatChartWindowLabel = (window) =>
    `${formatCalendarDate(window.previousDecisionDate)} to ${formatCalendarDate(window.nextDecisionDate)} | ${window.moveSummary}`;

  const renderChartWindowControls = (selectedWindow) => {
    const windows = getPolicyWindowsForCurrency(state.currency);
    chartWindowSelect.innerHTML = windows
      .map(
        (window) =>
          `<option value="${window.id}"${window.id === selectedWindow?.id ? " selected" : ""}>${formatChartWindowLabel(window)}</option>`
      )
      .join("");
  };

  const renderPolicyMeta = (selectedWindow) => {
    if (!selectedWindow) {
      policyMetaGrid.innerHTML = "<div class='empty-state'>No policy decision range is configured for this currency yet.</div>";
      return;
    }

    const cards = [
      {
        title: "Previous decision",
        value: formatCalendarDate(selectedWindow.previousDecisionDate),
        subtext: "Most recent rate-setting meeting for the selected window."
      },
      {
        title: "Rate decided",
        value: selectedWindow.rateDisplay,
        subtext: selectedWindow.moveSummary
      },
      {
        title: "Next decision",
        value: formatCalendarDate(selectedWindow.nextDecisionDate),
        subtext: "Next scheduled policy decision date."
      }
    ];

    policyMetaGrid.innerHTML = cards
      .map(
        (card) => `
          <article class="policy-card">
            <div class="summary-title">${card.title}</div>
            <div class="policy-value">${card.value}</div>
            <div class="policy-subtext">${card.subtext}</div>
          </article>
        `
      )
      .join("");
  };

  const renderHeaderMeta = () => {
    nextRefresh.textContent = data.schedule?.label || "Schedule unavailable";
    lastRun.textContent = `Last generated ${formatDateTime(data.generatedAt)} | ${formatTimezoneLabel(
      state.timezone
    )} | ${data.runStatus || "No status available"}${data.importedHistoryCount ? ` | ${data.importedHistoryCount} Notion history rows merged` : ""}`;
  };

  const makeChip = (label, value, group, currentValue) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${currentValue === value ? " active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      state[group] = value;
      if (group === "currency") {
        ensureChartWindowSelection(value);
      }
      render();
    });
    return button;
  };

  const renderFilterRow = (containerId, values, group, options = {}) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (options.includeAll !== false) {
      container.appendChild(makeChip(options.allLabel || "All", "ALL", group, state[group]));
    }
    values.forEach((value) => {
      if (typeof value === "string") {
        container.appendChild(makeChip(value, value, group, state[group]));
        return;
      }

      container.appendChild(
        makeChip(value.label, value.value, group, state[group])
      );
    });
  };

  const filteredEntries = () => {
    const search = state.search.trim().toLowerCase();
    const selectedWindow = getSelectedChartWindow();
    const startDate = parseEntryDate(selectedWindow?.previousDecisionDate);
    const endDate = parseEntryDate(selectedWindow?.nextDecisionDate);

    return data.entries.filter((entry) => {
      const entryDate = parseEntryDate(entry.date);
      const matchesWindow =
        !startDate ||
        !endDate ||
        !entryDate ||
        (entryDate >= startDate && entryDate <= endDate);
      const matchesCurrency = entry.currency === state.currency;
      const haystack = [
        entry.currency,
        entry.bank,
        entry.member,
        entry.roleTitle,
        entry.communicationType,
        entry.quoteSummary,
        entry.interpretation,
        entry.expectedImpact,
        entry.sourceLabel
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      return matchesWindow && matchesCurrency && matchesSearch;
    });
  };

  const renderSummary = () => {
    const selectedWindow = getSelectedChartWindow();
    const rangeLabel = selectedWindow
      ? `${formatCalendarDate(selectedWindow.previousDecisionDate)} to ${formatCalendarDate(selectedWindow.nextDecisionDate)}`
      : "No policy window selected";
    const todaysCurrencies = [...new Set(
      data.entries
        .filter((entry) => entry.date === data.targetDate)
        .filter((entry) => entry.tone !== "Unknown")
        .map((entry) => entry.currency)
    )].sort();
    const cards = [
      {
        title: "Policy window",
        value: rangeLabel,
        subtext: selectedWindow ? selectedWindow.moveSummary : `Anchored to ${data.targetDate} in ${data.timezone}`
      },
      {
        title: "New today",
        subtext: todaysCurrencies.length
          ? `${todaysCurrencies.length} currencies with fresh communication on ${data.targetDate}`
          : `No fresh communication captured on ${data.targetDate}`,
        currencies: todaysCurrencies
      },
      {
        title: "Coverage sweep",
        value: `${data.coverageSummary.checked.length} banks checked`,
        subtext: data.coverageSummary.note
      },
      {
        title: "Display timezone",
        value: formatTimezoneLabel(state.timezone),
        subtext: "Choose how timestamps are shown across the dashboard.",
        isTimezoneControl: true
      }
    ];

    summaryGrid.innerHTML = "";
    cards.forEach((card) => {
      const article = document.createElement("article");
      article.className = `summary-card${card.isTimezoneControl ? " summary-card-control" : ""}`;
      if (card.isTimezoneControl) {
        article.innerHTML = `
          <div class="summary-title">${card.title}</div>
          <label class="summary-select-field">
            <span class="summary-select-label">${card.subtext}</span>
            <select class="summary-select" id="timezone-select">
              ${timezoneOptions
                .map(
                  (timezone) =>
                    `<option value="${timezone}"${timezone === state.timezone ? " selected" : ""}>${formatTimezoneLabel(timezone)}</option>`
                )
                .join("")}
            </select>
          </label>
        `;
      } else if (card.currencies) {
        article.innerHTML = `
          <div class="summary-title">${card.title}</div>
          <div class="summary-subtext">${card.subtext}</div>
          <div class="summary-currency-list">
            ${card.currencies.length
              ? card.currencies
                  .map((currency) => `<span class="summary-currency-chip">${currency}</span>`)
                  .join("") 
              : "<span class=\"summary-currency-empty\">No new central bank communication today.</span>"}
          </div>
        `;
      } else {
        article.innerHTML = `
          <div class="summary-title">${card.title}</div>
          <div class="summary-value">${card.value}</div>
          <div class="summary-subtext">${card.subtext}</div>
        `;
      }
      summaryGrid.appendChild(article);
    });

    const timezoneSelect = document.getElementById("timezone-select");
    if (timezoneSelect) {
      timezoneSelect.addEventListener("change", (event) => {
        state.timezone = event.target.value;
        renderHeaderMeta();
        renderSummary();
      });
    }
  };

  const renderChart = () => {
    const selectedWindow = getSelectedChartWindow();
    const entries = getChartEntries();
    toneChart.innerHTML = "";
    renderChartWindowControls(selectedWindow);
    renderPolicyMeta(selectedWindow);

    if (!selectedWindow) {
      chartMeta.textContent = "No policy window is configured for this currency";
      toneChart.innerHTML = "<div class='empty-state'>Add a policy decision range to display the tone path for this currency.</div>";
      return;
    }

    chartMeta.textContent = `${selectedWindow.moveSummary} | Previous decision ${formatCalendarDate(
      selectedWindow.previousDecisionDate
    )} | Next decision ${formatCalendarDate(selectedWindow.nextDecisionDate)}`;

    if (!entries.length) {
      toneChart.innerHTML = `<div class='empty-state'>No communication has been captured for ${state.currency} in this policy-decision window yet.</div>`;
      return;
    }

    const width = 1040;
    const height = 360;
    const margin = { top: 26, right: 28, bottom: 58, left: 78 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const entryDates = [...new Set(entries.map((entry) => entry.date))];
    const axisDates = [...new Set([
      selectedWindow.previousDecisionDate,
      ...entryDates,
      selectedWindow.nextDecisionDate
    ])].sort((left, right) => left.localeCompare(right));
    const dateGroups = entryDates.map((date) => ({
      date,
      entries: entries.filter((entry) => entry.date === date)
    }));

    const getDateCenterX = (index) => {
      if (axisDates.length === 1) {
        return margin.left + innerWidth / 2;
      }
      return margin.left + (innerWidth * index) / (axisDates.length - 1);
    };

    const positionedEntries = [];
    dateGroups.forEach((group, groupIndex) => {
      const baseX = getDateCenterX(axisDates.indexOf(group.date));
      const spacing = 18;
      const totalWidth = (group.entries.length - 1) * spacing;
      group.entries.forEach((entry, entryIndex) => {
        const offset = entryIndex * spacing - totalWidth / 2;
        positionedEntries.push({
          ...entry,
          score: toneScoreMap[entry.tone] ?? 0,
          x: baseX + offset
        });
      });
    });

    const yForScore = (score) => {
      const normalized = (1 - score) / 2;
      return margin.top + normalized * innerHeight;
    };

    const lineColor = currencyColorMap[state.currency] || "#d4af37";
    const linePoints = positionedEntries.slice().sort((left, right) => left.x - right.x);

    const bandHeight = innerHeight / 3;
    const bandTop = margin.top;
    const neutralTop = bandTop + bandHeight;
    const dovishTop = bandTop + bandHeight * 2;

    const bandMarkup = `
      <rect class="chart-band-hawkish" x="${margin.left}" y="${bandTop}" width="${innerWidth}" height="${bandHeight}"></rect>
      <rect class="chart-band-neutral" x="${margin.left}" y="${neutralTop}" width="${innerWidth}" height="${bandHeight}"></rect>
      <rect class="chart-band-dovish" x="${margin.left}" y="${dovishTop}" width="${innerWidth}" height="${bandHeight}"></rect>
    `;

    const yAxisLines = [
      { label: "Hawkish", score: 1 },
      { label: "Neutral", score: 0 },
      { label: "Dovish", score: -1 }
    ]
      .map(({ label, score }) => {
        const y = yForScore(score);
        return `
          <line class="chart-grid-line" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
          <text class="chart-axis-label" x="${margin.left - 12}" y="${y + 4}" text-anchor="end">${label}</text>
        `;
      })
      .join("");

    const dateTicks = axisDates
      .map((date, index) => {
        const x = getDateCenterX(index);
        return `
          <line class="chart-date-tick" x1="${x}" y1="${height - margin.bottom + 4}" x2="${x}" y2="${height - margin.bottom + 12}"></line>
          <text class="chart-date-label" x="${x}" y="${height - 18}" text-anchor="middle">${date}</text>
        `;
      })
      .join("");

    const lineMarkup =
      linePoints.length > 1
        ? `<polyline class="chart-line" stroke="${lineColor}" points="${linePoints
            .map((point) => `${point.x},${yForScore(point.score)}`)
            .join(" ")}"></polyline>`
        : "";

    const pointMarkup = positionedEntries
      .map((entry) => {
        const y = yForScore(entry.score);
        const color = lineColor;
        const title = [
          `${entry.date} | ${entry.currency}`,
          `${entry.member} | ${entry.tone}`,
          entry.communicationType,
          entry.expectedImpact
        ].join("\n");

        return `
          <circle cx="${entry.x}" cy="${y}" r="7" fill="${color}" stroke="${color}" stroke-width="2">
            <title>${title}</title>
          </circle>
        `;
      })
      .join("");

    const startX = getDateCenterX(axisDates.indexOf(selectedWindow.previousDecisionDate));
    const endX = getDateCenterX(axisDates.indexOf(selectedWindow.nextDecisionDate));
    const boundaryMarkup = `
      <line class="chart-boundary-line" x1="${startX}" y1="${margin.top}" x2="${startX}" y2="${height - margin.bottom}"></line>
      <line class="chart-boundary-line" x1="${endX}" y1="${margin.top}" x2="${endX}" y2="${height - margin.bottom}"></line>
      <text class="chart-boundary-label" x="${startX}" y="${margin.top - 8}" text-anchor="middle">Previous decision</text>
      <text class="chart-boundary-label" x="${endX}" y="${margin.top - 8}" text-anchor="middle">Next decision</text>
    `;

    toneChart.innerHTML = `
      <div class="chart-caption">${state.currency} communication is traced from the selected rate decision through the next scheduled decision, so the full policy window stays visible in one view.</div>
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tone over time chart">
        ${bandMarkup}
        ${yAxisLines}
        ${boundaryMarkup}
        ${dateTicks}
        ${lineMarkup}
        ${pointMarkup}
      </svg>
    `;
  };

  const renderTable = () => {
    const entries = filteredEntries();
    tableBody.innerHTML = "";

    if (!entries.length) {
      tableBody.innerHTML = "<tr><td colspan='10'>No rows match the current currency, policy window, and search filter.</td></tr>";
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.currency}</td>
        <td>${entry.member}</td>
        <td>${entry.roleTitle}</td>
        <td>${entry.communicationType}</td>
        <td>${entry.status}</td>
        <td>${entry.tone}</td>
        <td>${entry.quoteSummary}</td>
        <td>${entry.interpretation}</td>
        <td>${entry.expectedImpact}</td>
      `;
      tableBody.appendChild(row);
    });
  };

  const renderSources = () => {
    sourceList.innerHTML = "";
    data.sources.forEach((source) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <div class="source-label"><a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a></div>
        <div class="source-note">${source.note}</div>
      `;
      sourceList.appendChild(item);
    });
  };

  const render = () => {
    renderSummary();
    renderChart();
    renderTable();
  };

  const initializeFilters = () => {
    const currencyValues = [...new Set(data.entries.map((entry) => entry.currency))].sort();
    renderFilterRow("currency-filters", currencyValues, "currency", { includeAll: false });
  };

  const loadData = async () => {
    const historyData = await readImportedHistory();

    if (window.CENTRAL_BANK_MONITOR_DATA) {
      data = mergeDataSets(window.CENTRAL_BANK_MONITOR_DATA, historyData);
      state.currency = data.entries.some((entry) => entry.currency === "USD")
        ? "USD"
        : [...new Set(data.entries.map((entry) => entry.currency))].sort()[0];
      ensureChartWindowSelection(state.currency);
      state.timezone = resolveInitialTimezone();
      renderHeaderMeta();
      initializeFilters();
      renderSources();
      render();
      return;
    }

    try {
      const response = await fetch("./data/report.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      showFatalState(`Unable to load report data. Check <code>data/report.json</code>. ${error.message}`);
      return;
    }

    data = mergeDataSets(data, historyData);
    state.currency = data.entries.some((entry) => entry.currency === "USD")
      ? "USD"
      : [...new Set(data.entries.map((entry) => entry.currency))].sort()[0];
    ensureChartWindowSelection(state.currency);
    state.timezone = resolveInitialTimezone();

    renderHeaderMeta();

    initializeFilters();
    renderSources();
    render();
  };

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  chartWindowSelect.addEventListener("change", (event) => {
    state.chartWindowSelections[state.currency] = event.target.value;
    render();
  });

  loadData();
})();
