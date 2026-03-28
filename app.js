(function () {
  const state = {
    currency: "ALL",
    tone: "ALL",
    status: "ALL",
    search: ""
  };

  const summaryGrid = document.getElementById("summary-grid");
  const promptText = document.getElementById("prompt-text");
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
      timeZone: data?.timezone || "America/Toronto"
    }).format(parsed);
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

  const renderFilterRow = (containerId, values, group) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    container.appendChild(makeChip("All", "ALL", group, state[group]));
    values.forEach((value) => {
      container.appendChild(makeChip(value, value, group, state[group]));
    });
  };

  const filteredEntries = () => {
    const search = state.search.trim().toLowerCase();
    return data.entries.filter((entry) => {
      const matchesCurrency = state.currency === "ALL" || entry.currency === state.currency;
      const matchesTone = state.tone === "ALL" || entry.tone === state.tone;
      const matchesStatus = state.status === "ALL" || entry.status === state.status;
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
      return matchesCurrency && matchesTone && matchesStatus && matchesSearch;
    });
  };

  const renderSummary = () => {
    const currenciesWithSignal = new Set(data.entries.map((entry) => entry.currency)).size;
    const cards = [
      {
        title: "Snapshot date",
        value: data.targetDate,
        subtext: `Evaluated in ${data.timezone}`
      },
      {
        title: "Qualified communications",
        value: String(data.entries.length),
        subtext: `${currenciesWithSignal} currencies with signal`
      },
      {
        title: "Coverage sweep",
        value: `${data.coverageSummary.checked.length} banks checked`,
        subtext: data.coverageSummary.note
      },
      {
        title: "Daily cadence",
        value: data.schedule.label,
        subtext: `Target run: ${data.schedule.timezone}`
      }
    ];

    summaryGrid.innerHTML = "";
    cards.forEach((card) => {
      const article = document.createElement("article");
      article.className = "summary-card";
      article.innerHTML = `
        <div class="summary-title">${card.title}</div>
        <div class="summary-value">${card.value}</div>
        <div class="summary-subtext">${card.subtext}</div>
      `;
      summaryGrid.appendChild(article);
    });
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
    boardTitle.textContent = state.currency === "ALL" ? "Daily flow" : `${state.currency} flow`;
    boardMeta.textContent = `${entries.length} item${entries.length === 1 ? "" : "s"} after filters`;
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
    const toneValues = [...new Set(data.entries.map((entry) => entry.tone))];
    const statusValues = [...new Set(data.entries.map((entry) => entry.status))];

    renderFilterRow("currency-filters", currencyValues, "currency");
    renderFilterRow("tone-filters", toneValues, "tone");
    renderFilterRow("status-filters", statusValues, "status");
  };

  const loadData = async () => {
    const historyData = await readImportedHistory();

    if (window.CENTRAL_BANK_MONITOR_DATA) {
      data = mergeDataSets(window.CENTRAL_BANK_MONITOR_DATA, historyData);
      promptText.textContent = data.prompt || "Prompt unavailable";
      nextRefresh.textContent = data.schedule?.label || "Schedule unavailable";
      lastRun.textContent = `Last generated ${formatDateTime(data.generatedAt)} | ${data.runStatus || "No status available"}${data.importedHistoryCount ? ` | ${data.importedHistoryCount} Notion history rows merged` : ""}`;
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

    promptText.textContent = data.prompt || "Prompt unavailable";
    nextRefresh.textContent = data.schedule?.label || "Schedule unavailable";
    lastRun.textContent = `Last generated ${formatDateTime(data.generatedAt)} | ${data.runStatus || "No status available"}${data.importedHistoryCount ? ` | ${data.importedHistoryCount} Notion history rows merged` : ""}`;

    initializeFilters();
    renderSources();
    render();
  };

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  loadData();
})();
