(function () {
  const state = {
    week: "THIS_WEEK",
    currency: "USD",
    search: "",
    timezone: "America/Toronto"
  };

  const summaryGrid = document.getElementById("summary-grid");
  const nextRefresh = document.getElementById("next-refresh");
  const lastRun = document.getElementById("last-run");
  const cardsGrid = document.getElementById("cards-grid");
  const tableBody = document.getElementById("table-body");
  const boardTitle = document.getElementById("board-title");
  const boardMeta = document.getElementById("board-meta");
  const chartMeta = document.getElementById("chart-meta");
  const chartLegend = document.getElementById("chart-legend");
  const toneChart = document.getElementById("tone-chart");
  const sourceList = document.getElementById("source-list");
  const searchInput = document.getElementById("search-input");
  const weekSelect = document.getElementById("week-select");
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
    Hawkish: 1,
    Unknown: 0
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

  const getWeekKey = (date) => {
    const weekStart = startOfWeek(date);
    return weekStart.toISOString().slice(0, 10);
  };

  const getReferenceWeekKey = () => getWeekKey(parseEntryDate(data?.targetDate) || new Date());

  const formatWeekLabel = (weekStartValue, referenceWeekKey) => {
    const weekStart = parseEntryDate(weekStartValue);
    if (!weekStart) {
      return weekStartValue;
    }

    const weekEnd = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    const startMonth = new Intl.DateTimeFormat("en-CA", { month: "short" }).format(weekStart);
    const endMonth = new Intl.DateTimeFormat("en-CA", { month: "short" }).format(weekEnd);
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    const year = weekEnd.getFullYear();
    const rangeLabel = sameMonth
      ? `${startMonth} ${startDay}-${endDay}, ${year}`
      : `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;

    if (weekStartValue === referenceWeekKey) {
      return `This week | ${rangeLabel}`;
    }

    return rangeLabel;
  };

  const buildWeekOptions = () => {
    const referenceWeekKey = getReferenceWeekKey();
    const weekKeys = [...new Set(data.entries.map((entry) => getWeekKey(parseEntryDate(entry.date) || new Date())))]
      .sort((left, right) => right.localeCompare(left));

    if (!weekKeys.includes(referenceWeekKey)) {
      weekKeys.unshift(referenceWeekKey);
    }

    return [
      ...weekKeys.map((weekKey) => ({
        value: weekKey,
        label: formatWeekLabel(weekKey, referenceWeekKey)
      })),
      { value: "ALL_TIME", label: "All history" }
    ];
  };

  const createDateRange = () => {
    if (state.week === "ALL_TIME") {
      return {
        start: null,
        end: null,
        label: "All history"
      };
    }

    const weekStart = parseEntryDate(state.week) || startOfWeek(parseEntryDate(data?.targetDate) || new Date());

    return {
      start: weekStart,
      end: endOfDay(addDays(weekStart, 6)),
      label: formatWeekLabel(getWeekKey(weekStart), getReferenceWeekKey())
    };
  };

  const getViewCopy = () => {
    if (state.week === "ALL_TIME") {
      return {
        title: "Archive flow",
        meta: "all history"
      };
    }

    const weekLabel = createDateRange().label.replace("This week | ", "");
    if (state.week === getReferenceWeekKey()) {
      return {
        title: "This week flow",
        meta: "this week"
      };
    }

    return {
      title: `Week of ${weekLabel}`,
      meta: `week of ${weekLabel}`
    };
  };

  const mergeDataSets = (baseData, historyData) => {
    if (!historyData?.entries?.length) {
      return { ...baseData, importedHistoryCount: 0 };
    }

    const entryMap = new Map();
    historyData.entries.forEach((entry) => {
      entryMap.set(buildEntryKey(entry), entry);
    });
    baseData.entries.forEach((entry) => {
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
      importedHistoryCount: historyData.entries.length
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
    const dateRange = createDateRange();

    return data.entries.filter((entry) => {
      const entryDate = parseEntryDate(entry.date);
      const matchesWeek =
        !dateRange.start ||
        !entryDate ||
        (entryDate >= dateRange.start && entryDate <= dateRange.end);
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
      return matchesWeek && matchesCurrency && matchesSearch;
    });
  };

  const renderSummary = () => {
    const entries = filteredEntries();
    const rangeLabel = createDateRange().label;
    const todaysCurrencies = [...new Set(
      data.entries
        .filter((entry) => entry.date === data.targetDate)
        .map((entry) => entry.currency)
    )].sort();
    const cards = [
      {
        title: "View window",
        value: rangeLabel,
        subtext: `Anchored to ${data.targetDate} in ${data.timezone}`
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
    const entries = filteredEntries().slice().sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      if (left.currency !== right.currency) {
        return left.currency.localeCompare(right.currency);
      }
      return left.member.localeCompare(right.member);
    });

    chartLegend.innerHTML = "";
    toneChart.innerHTML = "";

    if (!entries.length) {
      chartMeta.textContent = "No chartable entries after filters";
      toneChart.innerHTML = "<div class='empty-state'>No tone history is available for the current filter set.</div>";
      return;
    }

    chartMeta.textContent = "Scale runs from Dovish (-1) to Hawkish (+1). Hollow markers indicate Unknown tone.";

    const currencies = [...new Set(entries.map((entry) => entry.currency))];
    currencies.forEach((currency) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-swatch" style="background:${currencyColorMap[currency] || "#1e2430"}"></span>
        <span>${currency}</span>
      `;
      chartLegend.appendChild(item);
    });

    const width = 1040;
    const height = 360;
    const margin = { top: 26, right: 28, bottom: 58, left: 78 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const uniqueDates = [...new Set(entries.map((entry) => entry.date))];
    const dateGroups = uniqueDates.map((date) => ({
      date,
      entries: entries.filter((entry) => entry.date === date)
    }));

    const getDateCenterX = (index) => {
      if (uniqueDates.length === 1) {
        return margin.left + innerWidth / 2;
      }
      return margin.left + (innerWidth * index) / (uniqueDates.length - 1);
    };

    const positionedEntries = [];
    dateGroups.forEach((group, groupIndex) => {
      const baseX = getDateCenterX(groupIndex);
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

    const linesByCurrency = currencies.map((currency) => ({
      currency,
      color: currencyColorMap[currency] || "#1e2430",
      points: positionedEntries
        .filter((entry) => entry.currency === currency)
        .sort((left, right) => left.x - right.x)
    }));

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

    const dateTicks = uniqueDates
      .map((date, index) => {
        const x = getDateCenterX(index);
        return `
          <line class="chart-date-tick" x1="${x}" y1="${height - margin.bottom + 4}" x2="${x}" y2="${height - margin.bottom + 12}"></line>
          <text class="chart-date-label" x="${x}" y="${height - 18}" text-anchor="middle">${date}</text>
        `;
      })
      .join("");

    const lineMarkup = linesByCurrency
      .filter((line) => line.points.length > 1)
      .map((line) => {
        const points = line.points.map((point) => `${point.x},${yForScore(point.score)}`).join(" ");
        return `<polyline class="chart-line" stroke="${line.color}" points="${points}"></polyline>`;
      })
      .join("");

    const pointMarkup = positionedEntries
      .map((entry) => {
        const isUnknown = entry.tone === "Unknown";
        const y = yForScore(entry.score);
        const color = currencyColorMap[entry.currency] || "#1e2430";
        const fill = isUnknown ? "#fffaf4" : color;
        const strokeWidth = isUnknown ? 3 : 2;
        const title = [
          `${entry.date} | ${entry.currency}`,
          `${entry.member} | ${entry.tone}`,
          entry.communicationType,
          entry.expectedImpact
        ].join("\n");

        return `
          <circle cx="${entry.x}" cy="${y}" r="7" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}">
            <title>${title}</title>
          </circle>
        `;
      })
      .join("");

    toneChart.innerHTML = `
      <div class="chart-caption">This chart reads each communication on a tone scale from dovish to hawkish and traces it through time using the same filtered dataset as the board below.</div>
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tone over time chart">
        ${bandMarkup}
        ${yAxisLines}
        ${dateTicks}
        ${lineMarkup}
        ${pointMarkup}
      </svg>
    `;
  };

  const renderBoard = () => {
    const entries = filteredEntries();
    const viewCopy = getViewCopy();
    boardTitle.textContent = `${state.currency} ${viewCopy.title.toLowerCase()}`;
    boardMeta.textContent = `${entries.length} item${entries.length === 1 ? "" : "s"} in ${viewCopy.meta} after filters`;
    cardsGrid.innerHTML = "";

    if (!entries.length) {
      cardsGrid.innerHTML = "<div class='empty-state'>No communication matches the current filters.</div>";
      return;
    }

    entries.forEach((entry) => {
      const article = document.createElement("article");
      article.className = "signal-card";
      article.innerHTML = `
        <div class="signal-header">
          <div class="signal-title">
            <div class="signal-currency">${entry.currency} / ${entry.member}</div>
            <div class="signal-role">${entry.roleTitle} / ${entry.bank}</div>
          </div>
          <div class="tag-stack">
            <span class="tag ${entry.tone.toLowerCase()}">${entry.tone}</span>
            <span class="tag">${entry.status}</span>
          </div>
        </div>
        <div class="signal-copy">
          <p><strong>${entry.communicationType}</strong></p>
          <p>${entry.quoteSummary}</p>
          <p><strong>Interpretation:</strong> ${entry.interpretation}</p>
          <p><strong>Expected impact:</strong> ${entry.expectedImpact}</p>
        </div>
        <div class="signal-foot">
          <span>${entry.date}</span>
          <a href="${entry.sourceUrl}" target="_blank" rel="noreferrer">${entry.sourceLabel}</a>
        </div>
      `;
      cardsGrid.appendChild(article);
    });
  };

  const renderTable = () => {
    const entries = filteredEntries();
    tableBody.innerHTML = "";

    if (!entries.length) {
      tableBody.innerHTML = "<tr><td colspan='10'>No rows match the current filters.</td></tr>";
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
    renderBoard();
    renderTable();
  };

  const initializeFilters = () => {
    const currencyValues = [...new Set(data.entries.map((entry) => entry.currency))].sort();
    const weekOptions = buildWeekOptions();

    weekSelect.innerHTML = weekOptions
      .map((option) => `<option value="${option.value}">${option.label}</option>`)
      .join("");
    weekSelect.value = state.week;
    renderFilterRow("currency-filters", currencyValues, "currency", { includeAll: false });
  };

  const loadData = async () => {
    const historyData = await readImportedHistory();

    if (window.CENTRAL_BANK_MONITOR_DATA) {
      data = mergeDataSets(window.CENTRAL_BANK_MONITOR_DATA, historyData);
      state.week = getReferenceWeekKey();
      state.currency = data.entries.some((entry) => entry.currency === "USD")
        ? "USD"
        : [...new Set(data.entries.map((entry) => entry.currency))].sort()[0];
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
    state.week = getReferenceWeekKey();
    state.currency = data.entries.some((entry) => entry.currency === "USD")
      ? "USD"
      : [...new Set(data.entries.map((entry) => entry.currency))].sort()[0];
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

  weekSelect.addEventListener("change", (event) => {
    state.week = event.target.value;
    render();
  });

  loadData();
})();
