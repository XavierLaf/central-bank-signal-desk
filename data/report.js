window.CENTRAL_BANK_MONITOR_DATA = {
  "targetDate": "2026-03-27",
  "timezone": "America/Toronto",
  "generatedAt": "2026-03-27T23:22:28.377Z",
  "runStatus": "Automated refresh completed via OpenAI Responses API using gpt-5.4",
  "schedule": {
    "label": "Daily at 6:30 PM ET",
    "timezone": "America/Toronto"
  },
  "coverageSummary": {
    "checked": [
      "USD",
      "EUR",
      "JPY",
      "NZD",
      "AUD",
      "CHF",
      "CAD",
      "GBP"
    ],
    "note": "Only currencies with same-day market-relevant communication are surfaced in the board."
  },
  "prompt": "# Daily central bank monitoring prompt\n\nYou are a macro & FX trading analyst specialized in real-time central bank communication tracking.\n\nYour task is to identify ALL central bank communications TODAY (including live flow) for:\nUSD / Fed, EUR / ECB, JPY / BOJ, NZD / RBNZ, AUD / RBA, CHF / SNB, CAD / BoC, GBP / BoE\n\nPRIMARY OBJECTIVE\nCapture ALL MARKET-RELEVANT CENTRAL BANK FLOW, including:\n- Speeches\n- Interviews\n- Panel discussions\n- Q&A appearances\n- Testimonies\n- Meeting minutes / summaries\n- Official statements\n- Media appearances\n- Press conferences\n- Unscheduled remarks reported by news wires\n\nCRITICAL: SEARCH PRIORITY (MANDATORY ORDER)\n1. REAL-TIME NEWS FLOW (HIGHEST PRIORITY)\nSearch FIRST for same-day central bank remarks from:\n- Reuters\n- Bloomberg\n- Financial Times\n- Wall Street Journal\n- Major market terminals / summaries\n\nUse keyword detection:\n- \"said\"\n- \"told reporters\"\n- \"in interview\"\n- \"speaking at\"\n- \"panel\"\n- \"Q&A\"\n- \"conference\"\n- \"according to\"\n\nTreat these as valid communications even if:\n- not on official calendars\n- no transcript exists\n- only summarized\n\n2. OFFICIAL CENTRAL BANK SOURCES\nThen check:\n- Official calendars (Board + regional banks)\n- Official speeches / press releases / transcripts\n- Minutes / summaries of opinions\n\nInclude:\n- Federal Reserve Board + ALL regional Fed banks\n- ECB + national central bank system\n- All G10 central banks listed\n\n3. EVENT-BASED SOURCES\nCheck:\n- Conference agendas (IMF, BIS, universities, think tanks)\n- Panels and hosted discussions\n\nINCLUSION RULES\nInclude ALL policymakers:\n- Governors / Presidents\n- Voting members\n- Non-voting members\n- Assistant governors\n- Regional Fed presidents\n- Senior officials if quoted\n\nUNSCHEDULED COMMUNICATION RULE\nInclude remarks that are:\n- NOT on calendars\n- Reported via Reuters/Bloomberg\n- From interviews or media\n\nDUPLICATION RULE\n- Merge identical remarks across sources into ONE entry\n- Keep the most complete wording available\n\nTONE CLASSIFICATION RULE\nTone must be exactly:\n- Hawkish\n- Neutral\n- Dovish\n- Unknown\n\nRules:\n- Use Hawkish/Dovish only if wording supports it\n- If only scheduled, use Unknown\n- If mixed signals, choose the dominant bias\n\nOUTPUT FORMAT\nReturn machine-readable JSON with:\n- entries\n- sources\n\nEach entry must contain:\n- date\n- currency\n- bank\n- member\n- roleTitle\n- communicationType\n- status\n- tone\n- quoteSummary\n- interpretation\n- expectedImpact\n- sourceLabel\n- sourceUrl\n\nFINAL FILTER\n- Ensure no major central bank communication today is missing\n- Prioritize market-moving flow over formal releases\n- Do not omit newswire remarks\n\nHISTORY RULE\n- Preserve prior entries already stored in `data/report.json`\n- Add or update today's rows without duplicating the same communication\n- Keep older entries available so the dashboard can plot tone drift over time\n",
  "entries": [
    {
      "date": "2026-03-27",
      "currency": "EUR",
      "bank": "European Central Bank",
      "member": "Isabel Schnabel",
      "roleTitle": "Member of the Executive Board, ECB",
      "communicationType": "Guest lecture",
      "status": "Scheduled",
      "tone": "Unknown",
      "quoteSummary": "The ECB weekly schedule lists a 17:00 CET guest lecture by Schnabel at the University of Zurich, with slides/live access indicated, but no policy text was available in the retrieved results at the time of the snapshot.",
      "interpretation": "Scheduled only, so there is no defensible hawkish or dovish classification yet. Markets would watch closely for any guidance on energy-shock persistence, inflation expectations, or the ECB reaction function.",
      "expectedImpact": "EUR impact low unless live headlines or slides deliver fresh policy language; intraday.",
      "sourceLabel": "ECB weekly schedule",
      "sourceUrl": "https://www.ecb.europa.eu/press/calendars/weekly/html/index.en.html"
    },
    {
      "date": "2026-03-27",
      "currency": "USD",
      "bank": "Federal Reserve",
      "member": "Anna Paulson",
      "roleTitle": "President and CEO, Federal Reserve Bank of Philadelphia",
      "communicationType": "Conference remarks / Reuters-reported speech",
      "status": "Live",
      "tone": "Neutral",
      "quoteSummary": "Reuters-attributed market coverage of Paulson’s remarks at the San Francisco Fed’s Macroeconomics and Monetary Policy Conference said she framed the Iran war as adding risks to both inflation and growth, and argued that with inflation still above target the Fed would need to be cautious about simply waiting through any AI-led productivity surge.",
      "interpretation": "Neutral overall because she emphasized two-sided risks and did not pre-commit to a near-term policy move. The marginal nuance was slightly hawkish because she suggested above-target inflation should make policymakers put more weight on overheating risk.",
      "expectedImpact": "USD mildly supportive on reduced near-term easing conviction, but mixed because growth risks were also highlighted; weak to moderate intraday impact.",
      "sourceLabel": "SF Fed conference agenda / Reuters-reported market coverage",
      "sourceUrl": "https://www.frbsf.org/news-and-media/events/conferences/2026/03/macroeconomics-and-monetary-policy-conference-2026/"
    },
    {
      "date": "2026-03-27",
      "currency": "USD",
      "bank": "Federal Reserve",
      "member": "Tom Barkin",
      "roleTitle": "President and CEO, Federal Reserve Bank of Richmond",
      "communicationType": "Keynote speech",
      "status": "Scheduled",
      "tone": "Unknown",
      "quoteSummary": "ETSU’s Appalachian Highlands Economic Forum lists Barkin as the keynote speaker on 27 March 2026. No official speech text or same-day wire summary was available in the retrieved results at the time of the snapshot.",
      "interpretation": "Scheduled only, so no defensible tone classification yet. Any surprise emphasis on inflation persistence, labor-market deterioration, or uncertainty management would be market-relevant for rates and the dollar.",
      "expectedImpact": "Potential USD impact low to moderate if live headlines emerge; otherwise limited.",
      "sourceLabel": "ETSU Appalachian Highlands Economic Forum page",
      "sourceUrl": "https://www.etsu.edu/cbat/economics/economic_forum/default.php"
    }
  ],
  "sources": [
    {
      "label": "Bank of Canada upcoming events",
      "url": "https://www.bankofcanada.ca/press/upcoming-events/",
      "note": "Retrieved page showed a Carolyn Rogers speech on 26 March 2026 and no 27 March BoC event in the snapshot."
    },
    {
      "label": "Bank of England upcoming events",
      "url": "https://www.bankofengland.co.uk/events/upcoming-events",
      "note": "Retrieved official BoE events page did not surface a 27 March communication in the available snapshot."
    },
    {
      "label": "BOJ speeches 2026 index",
      "url": "https://www.boj.or.jp/en/about/press/koen_2026/index.htm",
      "note": "Retrieved BOJ speeches index did not surface a 27 March BOJ speech in the available results."
    },
    {
      "label": "ECB weekly schedule",
      "url": "https://www.ecb.europa.eu/press/calendars/weekly/html/index.en.html",
      "note": "Official ECB schedule confirming Isabel Schnabel’s 27 March 2026 Zurich lecture."
    },
    {
      "label": "ECB weekly schedule of public speaking engagements",
      "url": "https://www.ecb.europa.eu/press/calendars/weekly/html/index.cs.html",
      "note": "Used for March 27, 2026 official ECB scheduling, including the Isabel Schnabel Zurich lecture."
    },
    {
      "label": "Economic Times article carrying Reuters-cited Miran remarks",
      "url": "https://m.economictimes.com/markets/us-stocks/news/us-stock-market-feds-miran-lays-out-roadmap-for-smaller-balance-sheet-easier-policy/articleshow/129838223.cms",
      "note": "Used because no same-day official Fed transcript was available at snapshot time."
    },
    {
      "label": "ETSU Appalachian Highlands Economic Forum",
      "url": "https://www.etsu.edu/cbat/economics/economic_forum/default.php",
      "note": "Official event page confirming Tom Barkin as keynote speaker on 27 March 2026."
    },
    {
      "label": "Federal Reserve Board March 2026 calendar",
      "url": "https://www.federalreserve.gov/newsevents/2026-march.htm",
      "note": "Checked for Board-level 27 March items; retrieved page showed Miran/Cook/Jefferson/Barr events on 26 March, helping avoid carrying over non-Toronto-date Fed Board remarks into 27 March."
    },
    {
      "label": "RBA media / upcoming events",
      "url": "https://www.rba.gov.au/media/",
      "note": "Retrieved upcoming-events snapshot showed 25 and 26 March items and did not surface a 27 March RBA communication."
    },
    {
      "label": "San Francisco Fed conference page",
      "url": "https://www.frbsf.org/news-and-media/events/conferences/2026/03/macroeconomics-and-monetary-policy-conference-2026/",
      "note": "Official agenda confirming 27 March 2026 event, Mary Daly introduction, and Anna Paulson remarks."
    },
    {
      "label": "SNB event schedule",
      "url": "https://www.snb.ch/en/services-events/digital-services/event-schedule",
      "note": "Retrieved schedule showed the 19 March monetary policy assessment and 25 March bulletin, with no 27 March SNB appearance in the available results."
    }
  ]
};
