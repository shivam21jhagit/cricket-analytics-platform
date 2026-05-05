import { lazy, Suspense, startTransition, useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "./App.css";
import { API_BASE_URL } from "./api";

const Prediction = lazy(() => import("./Prediction"));
const Simulation = lazy(() => import("./Simulation"));
const Analytics = lazy(() => import("./Analytics"));
const Fantasy = lazy(() => import("./Fantasy"));

const workspaceTabs = [
  {
    id: "prediction",
    label: "Prediction",
    kicker: "AI Engine",
    summary: "Next-ball, win-probability, score-range, venue, and matchup intelligence.",
    accent: "#00c853",
    soft: "rgba(0, 200, 83, 0.14)",
    metrics: [
      { label: "Models", value: "Ensemble" },
      { label: "Refresh", value: "2 min" },
      { label: "Output", value: "Win edge" }
    ],
    board: [
      { label: "Next-ball", value: "Active" },
      { label: "Confidence", value: "Visible" },
      { label: "Fallback", value: "Cached" }
    ]
  },
  {
    id: "simulation",
    label: "Simulation",
    kicker: "Scenarios",
    summary: "Monte Carlo-style innings ranges across rain, wicket clusters, and chase states.",
    accent: "#ff6f00",
    soft: "rgba(255, 111, 0, 0.14)",
    metrics: [
      { label: "Runs", value: "Ranges" },
      { label: "Shape", value: "20 overs" },
      { label: "Output", value: "What-if" }
    ],
    board: [
      { label: "Scenarios", value: "Ready" },
      { label: "Overs", value: "Charted" },
      { label: "Range", value: "Tracked" }
    ]
  },
  {
    id: "analytics",
    label: "Analytics",
    kicker: "Player Intel",
    summary: "Radar-style form, pressure, venue overlays, and scouting summaries.",
    accent: "#37b7ff",
    soft: "rgba(55, 183, 255, 0.14)",
    metrics: [
      { label: "Profiles", value: "Radar" },
      { label: "Reports", value: "AI notes" },
      { label: "Phases", value: "Visible" }
    ],
    board: [
      { label: "Roles", value: "Visible" },
      { label: "Strike rate", value: "Visible" },
      { label: "Notes", value: "Available" }
    ]
  },
  {
    id: "fantasy",
    label: "Fantasy",
    kicker: "AI Team Builder",
    summary: "Captain, vice-captain, differential picks, and auto-substitution alerts.",
    accent: "#ff6b8a",
    soft: "rgba(255, 107, 138, 0.14)",
    metrics: [
      { label: "Budget", value: "Optimized" },
      { label: "Squad", value: "Top XI" },
      { label: "Output", value: "C/VC" }
    ],
    board: [
      { label: "Pitch", value: "Selected" },
      { label: "Captain", value: "Ranked" },
      { label: "Bench", value: "Mapped" }
    ]
  }
];

const navigationTabs = [
  { id: "home", label: "Home", kicker: "Live Desk", accent: "#f5c45b" },
  ...workspaceTabs
];

const homeKpis = [
  { label: "Scale Target", value: "10M+", detail: "Monthly active users architecture target" },
  { label: "Refresh", value: "120s", detail: "Live match intelligence polling cadence" },
  { label: "API", value: "8000", detail: "FastAPI prediction and platform gateway" },
  { label: "Data Mode", value: "Hybrid", detail: "CricAPI when configured, local demo fallback" }
];

const liveMoments = [
  {
    id: "powerplay",
    matchup: "MI vs RCB",
    status: "Live",
    score: "42/1",
    overs: "5.1 ov",
    phase: "Powerplay",
    note: "Boundary surge",
    liveUrl: "https://www.google.com/search?q=MI%20vs%20RCB%20live%20score",
    lanes: [
      { label: "Run Rate", value: "8.4", caption: "Current", level: 72 },
      { label: "Pressure", value: "31%", caption: "Wicket risk", level: 31 },
      { label: "Projected", value: "176", caption: "First innings", level: 78 }
    ],
    ticker: ["Prediction synced", "Simulation running", "Fantasy pool ready"]
  },
  {
    id: "middle",
    matchup: "CSK vs RR",
    status: "Live",
    score: "97/2",
    overs: "11.4 ov",
    phase: "Middle Overs",
    note: "Spin control",
    liveUrl: "https://www.google.com/search?q=CSK%20vs%20RR%20live%20score",
    lanes: [
      { label: "Run Rate", value: "8.3", caption: "Current", level: 70 },
      { label: "Pressure", value: "44%", caption: "Wicket risk", level: 44 },
      { label: "Projected", value: "171", caption: "First innings", level: 73 }
    ],
    ticker: ["Live charts active", "Player search ready", "History loaded"]
  },
  {
    id: "death",
    matchup: "IND vs AUS",
    status: "Live",
    score: "154/4",
    overs: "17.2 ov",
    phase: "Death Overs",
    note: "Finish loading",
    liveUrl: "https://www.google.com/search?q=IND%20vs%20AUS%20live%20score",
    lanes: [
      { label: "Run Rate", value: "8.9", caption: "Current", level: 76 },
      { label: "Pressure", value: "63%", caption: "Wicket risk", level: 63 },
      { label: "Projected", value: "184", caption: "First innings", level: 84 }
    ],
    ticker: ["Death-over model ready", "Matchup history linked", "Top picks updated"]
  }
];

const intelligenceSignals = [
  {
    label: "Predictive Edge",
    value: "84%",
    caption: "model agreement",
    delta: "+12%",
    accent: "#37b7ff",
    level: 84,
    points: [30, 48, 42, 66, 62, 80, 84]
  },
  {
    label: "Boundary Heat",
    value: "71",
    caption: "attack index",
    delta: "+8",
    accent: "#ffb547",
    level: 71,
    points: [28, 36, 54, 50, 64, 58, 71]
  },
  {
    label: "Wicket Risk",
    value: "38%",
    caption: "next over",
    delta: "-5%",
    accent: "#ff6b8a",
    level: 38,
    points: [56, 52, 45, 49, 40, 43, 38]
  },
  {
    label: "Selection Fit",
    value: "92",
    caption: "fantasy score",
    delta: "+15",
    accent: "#42dfb4",
    level: 92,
    points: [44, 52, 61, 70, 78, 86, 92]
  }
];

const matchFlow = [
  {
    id: "powerplay",
    phase: "Powerplay",
    score: "42/1",
    tempo: "Aggressive",
    level: 34
  },
  {
    id: "middle",
    phase: "Middle",
    score: "97/2",
    tempo: "Controlled",
    level: 63
  },
  {
    id: "death",
    phase: "Death",
    score: "154/4",
    tempo: "High leverage",
    level: 88
  }
];

const fallbackRunRateSeries = [
  { over: "1", current: 7.0, required: 8.1, par: 7.6 },
  { over: "3", current: 8.2, required: 8.0, par: 7.8 },
  { over: "6", current: 8.4, required: 7.9, par: 8.2 },
  { over: "9", current: 8.1, required: 8.3, par: 8.4 },
  { over: "12", current: 8.7, required: 8.8, par: 8.6 },
  { over: "16", current: 9.1, required: 9.4, par: 8.9 },
  { over: "20", current: 9.4, required: 9.8, par: 9.2 }
];

const fallbackPlayerCards = [
  {
    name: "Virat Kohli",
    role: "Anchor",
    form: 88,
    pressure_index: 91,
    venue_fit: 84,
    scouting_report:
      "Elite chase controller with a rising boundary rate once spin enters the innings."
  },
  {
    name: "Jasprit Bumrah",
    role: "Death bowler",
    form: 93,
    pressure_index: 96,
    venue_fit: 87,
    scouting_report:
      "High-leverage wicket source with yorker control late in the innings."
  },
  {
    name: "Rashid Khan",
    role: "Middle-over disruptor",
    form: 86,
    pressure_index: 89,
    venue_fit: 92,
    scouting_report:
      "Suppresses pace-on scoring and creates fantasy value through dot-ball chains."
  }
];

const fallbackFantasy = {
  budget_used: 89.5,
  expected_points: 746,
  captain: "Virat Kohli",
  vice_captain: "Jasprit Bumrah",
  differentials: ["Rashid Khan", "Tilak Varma", "Rinku Singh"],
  alerts: [
    "Auto-substitution watch is armed for toss updates.",
    "Death-over bowlers are projected above baseline on this surface."
  ]
};

const fallbackArchitecture = [
  { name: "web-app", stack: "React now, Next.js target", status: "active", owner: "frontend" },
  { name: "prediction-service", stack: "FastAPI + local ML", status: "active", owner: "ai" },
  { name: "match-service", stack: "CricAPI adapter", status: "scaffolded", owner: "data" },
  { name: "auth-service", stack: "JWT/OAuth target", status: "demo endpoint", owner: "platform" }
];

const THEME_STORAGE_KEY = "cap-theme";
const THEME_OPTIONS = [
  { id: "light", label: "Light", status: "Light" },
  { id: "dark", label: "Dark", status: "Dark" },
  { id: "system", label: "System", status: "Auto" }
];

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "dark";
  }

  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

function getStoredThemePreference() {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (THEME_OPTIONS.some((option) => option.id === storedTheme)) {
    return storedTheme;
  }

  return "dark";
}

function resolveTheme(preference, systemTheme) {
  return preference === "system" ? systemTheme : preference;
}

function normalizeLiveMoment(match) {
  return {
    id: match?.id || match?.matchup || "live-match",
    matchup: match?.matchup || "Live cricket match",
    status: match?.status || "Live",
    score: match?.score || "Yet to bat",
    overs: match?.overs || "0.0 ov",
    phase: match?.phase || "Pre-match",
    note: match?.note || "Prediction refresh queued",
    liveUrl:
      match?.live_url ||
      match?.liveUrl ||
      `https://www.google.com/search?q=${encodeURIComponent(
        `${match?.matchup || "cricket"} live score`
      )}`,
    lanes: Array.isArray(match?.lanes) && match.lanes.length ? match.lanes : liveMoments[0].lanes,
    ticker:
      Array.isArray(match?.ticker) && match.ticker.length
        ? match.ticker
        : ["Live feed ready", "Prediction refresh queued", "Fantasy sync armed"]
  };
}

function normalizePlatformDashboard(payload) {
  const source = payload || {};

  return {
    identity: {
      name: "CricketAI",
      tagline: "Predict. Analyze. Dominate the Game.",
      ...(source.identity || {})
    },
    liveMatches: Array.isArray(source.live_matches)
      ? source.live_matches.map(normalizeLiveMoment)
      : [],
    intelligenceSignals: Array.isArray(source.intelligence_signals)
      ? source.intelligence_signals
      : [],
    runRateSeries: Array.isArray(source.run_rate_series) ? source.run_rate_series : [],
    playerCards: Array.isArray(source.player_cards) ? source.player_cards : [],
    fantasy: source.fantasy || null,
    architecture: Array.isArray(source.architecture) ? source.architecture : [],
    generatedAt: source.generated_at || ""
  };
}

function ThemeGlyph({ type }) {
  if (type === "light") {
    return (
      <svg
        className="theme-toggle__glyph"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 1.8v2.1M10 16.1v2.1M18.2 10h-2.1M3.9 10H1.8M15.8 4.2l-1.5 1.5M5.7 14.3l-1.5 1.5M15.8 15.8l-1.5-1.5M5.7 5.7L4.2 4.2" />
      </svg>
    );
  }

  if (type === "dark") {
    return (
      <svg
        className="theme-toggle__glyph"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.5 12.9A6.5 6.5 0 0 1 7.1 5.5a6.8 6.8 0 1 0 7.4 7.4Z" />
      </svg>
    );
  }

  return (
    <svg
      className="theme-toggle__glyph"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="15" height="10.5" rx="2.2" />
      <path d="M7.3 16.5h5.4M10 14v2.5" />
    </svg>
  );
}

function TabGlyph({ id }) {
  if (id === "home") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 8.5 10 3l7 5.5V17h-4.5v-4.6h-5V17H3V8.5Z" />
      </svg>
    );
  }

  if (id === "prediction") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 16.5h14M5 13l3-3 2.4 2.2L15 6" />
        <circle cx="15" cy="6" r="2" />
      </svg>
    );
  }

  if (id === "simulation") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3.5 15.5c3.3-7.6 7.7-7.6 13 0" />
        <path d="M4 5h12M6 8h8" />
        <circle cx="10" cy="13" r="2" />
      </svg>
    );
  }

  if (id === "analytics") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 15V8M8 15V5M12 15v-4M16 15V7" />
        <path d="M3 16.5h14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 5h12v10H4z" />
      <path d="M7 8h6M7 11h3" />
      <circle cx="14" cy="12" r="1.7" />
    </svg>
  );
}

function renderWorkspace(tab) {
  if (tab === "prediction") {
    return <Prediction />;
  }

  if (tab === "simulation") {
    return <Simulation />;
  }

  if (tab === "analytics") {
    return <Analytics />;
  }

  return <Fantasy />;
}

function WorkspaceLoadingState({ activeTab }) {
  return (
    <div
      className="workspace-loading"
      style={{ "--accent": activeTab.accent, "--accent-soft": activeTab.soft }}
      role="status"
      aria-live="polite"
    >
      <div className="workspace-loading__bar" />
      <div className="workspace-loading__grid" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="workspace-loading__tile" />
        ))}
      </div>
    </div>
  );
}

function WorkspaceMiniChart({ id }) {
  const barsById = {
    prediction: [54, 82, 46, 72, 63, 88, 59],
    simulation: [35, 45, 52, 67, 70, 84, 92],
    analytics: [68, 44, 81, 58, 76, 48, 72],
    fantasy: [74, 61, 53, 78, 66, 82, 69]
  };

  return (
    <div className={`mini-chart mini-chart--${id}`} aria-hidden="true">
      {barsById[id].map((height, index) => (
        <span
          key={`${id}-${height}-${index}`}
          style={{ "--height": `${height}%`, "--index": index }}
        />
      ))}
    </div>
  );
}

function SignalSparkline({ points }) {
  return (
    <div className="signal-sparkline" aria-hidden="true">
      {points.map((point, index) => (
        <span
          key={`${point}-${index}`}
          style={{ "--height": `${point}%`, "--index": index }}
        />
      ))}
    </div>
  );
}

function IntelligenceSignalCard({ signal }) {
  return (
    <article
      className="signal-card shell-card"
      style={{
        "--accent": signal.accent,
        "--accent-soft": `${signal.accent}24`,
        "--level": `${signal.level}%`
      }}
    >
      <div className="signal-card__head">
        <span>{signal.label}</span>
        <strong>{signal.delta}</strong>
      </div>
      <div className="signal-card__value">{signal.value}</div>
      <div className="signal-card__footer">
        <span>{signal.caption}</span>
        <div className="signal-card__meter" aria-hidden="true">
          <i />
        </div>
      </div>
      <SignalSparkline points={signal.points} />
    </article>
  );
}

function MatchFlowPanel({ liveMoment }) {
  const currentPhase = liveMoment.phase.toLowerCase();

  return (
    <article className="flow-panel shell-card">
      <div className="section-head">
        <div>
          <p className="eyebrow-copy">Match Flow</p>
          <h3>Phase Momentum</h3>
        </div>
        <span className="meta-chip">{liveMoment.matchup}</span>
      </div>

      <div className="flow-timeline">
        {matchFlow.map((step) => {
          const isActive = currentPhase.includes(step.id) || currentPhase.includes(step.phase.toLowerCase());

          return (
            <div
              key={step.id}
              className={`flow-step ${isActive ? "flow-step--active" : ""}`}
              style={{ "--level": `${step.level}%` }}
            >
              <div className="flow-step__marker" />
              <div className="flow-step__body">
                <div className="flow-step__top">
                  <strong>{step.phase}</strong>
                  <span>{step.score}</span>
                </div>
                <small>{step.tempo}</small>
                <div className="flow-step__bar" aria-hidden="true">
                  <span />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ProbabilityGauge({ liveMoment }) {
  const primaryLane = liveMoment.lanes?.[0] || { label: "Win Edge", value: "58%", level: 58 };
  const level = Math.min(96, Math.max(4, Number(primaryLane.level) || 58));

  return (
    <article
      className="probability-panel shell-card"
      style={{ "--level": `${level}%`, "--needle-angle": `${-90 + level * 1.8}deg` }}
    >
      <div className="section-head">
        <div>
          <p className="eyebrow-copy">AI Match Prediction</p>
          <h3>Win Probability</h3>
        </div>
        <span className="meta-chip">{liveMoment.phase}</span>
      </div>
      <div className="probability-gauge" aria-label={`${primaryLane.label} ${primaryLane.value}`}>
        <div className="probability-gauge__arc" aria-hidden="true" />
        <div className="probability-gauge__needle" aria-hidden="true" />
        <div className="probability-gauge__value">
          <strong>{primaryLane.value}</strong>
          <span>{primaryLane.caption || primaryLane.label}</span>
        </div>
      </div>
      <div className="confidence-band">
        <span>Confidence band</span>
        <strong>{Math.max(46, level - 12)}-{Math.min(96, level + 9)}%</strong>
      </div>
    </article>
  );
}

function RunRatePanel({ series }) {
  return (
    <article className="run-rate-panel shell-card">
      <div className="section-head">
        <div>
          <p className="eyebrow-copy">Live Match Dashboard</p>
          <h3>Run Rate Flow</h3>
        </div>
        <span className="meta-chip">Current vs required</span>
      </div>
      <div className="run-rate-chart">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={series} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="currentRate" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#00c853" stopOpacity={0.36} />
                <stop offset="95%" stopColor="#00c853" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="requiredRate" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#ff6f00" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#ff6f00" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="over" stroke="var(--chart-axis)" tickLine={false} />
            <YAxis stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 8,
                color: "var(--text-primary)"
              }}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="#00c853"
              strokeWidth={2.4}
              fill="url(#currentRate)"
              name="Current"
            />
            <Area
              type="monotone"
              dataKey="required"
              stroke="#ff6f00"
              strokeWidth={2.2}
              fill="url(#requiredRate)"
              name="Required"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function PlayerIntelPanel({ playerCards }) {
  return (
    <section className="player-intel-grid" aria-label="Player intelligence cards">
      {playerCards.slice(0, 3).map((player) => (
        <article key={player.name} className="player-intel-card shell-card">
          <div>
            <p className="eyebrow-copy">{player.role}</p>
            <h3>{player.name}</h3>
          </div>
          <div className="player-radar" aria-hidden="true">
            <span style={{ "--value": `${player.form || 0}%` }}>Form</span>
            <span style={{ "--value": `${player.pressure_index || 0}%` }}>Pressure</span>
            <span style={{ "--value": `${player.venue_fit || 0}%` }}>Venue</span>
          </div>
          <p>{player.scouting_report}</p>
        </article>
      ))}
    </section>
  );
}

function FantasyCommandPanel({ fantasy }) {
  return (
    <article className="fantasy-command shell-card">
      <div className="section-head">
        <div>
          <p className="eyebrow-copy">Fantasy Cricket Suite</p>
          <h3>AI Team Builder</h3>
        </div>
        <span className="meta-chip">{fantasy.expected_points} pts</span>
      </div>
      <div className="fantasy-captains">
        <span>
          Captain
          <strong>{fantasy.captain}</strong>
        </span>
        <span>
          Vice-captain
          <strong>{fantasy.vice_captain}</strong>
        </span>
        <span>
          Budget
          <strong>{fantasy.budget_used}%</strong>
        </span>
      </div>
      <div className="differential-row">
        {fantasy.differentials.map((pick) => (
          <span key={pick}>{pick}</span>
        ))}
      </div>
      <div className="fantasy-alerts">
        {fantasy.alerts.map((alert) => (
          <p key={alert}>{alert}</p>
        ))}
      </div>
    </article>
  );
}

function ArchitecturePanel({ architecture }) {
  return (
    <article className="architecture-panel shell-card">
      <div className="section-head">
        <div>
          <p className="eyebrow-copy">Cloud-Native Blueprint</p>
          <h3>Service Map</h3>
        </div>
        <span className="meta-chip">v1 scaffold</span>
      </div>
      <div className="architecture-grid">
        {architecture.map((service) => (
          <div key={service.name} className="architecture-node">
            <span>{service.owner}</span>
            <strong>{service.name}</strong>
            <small>{service.stack}</small>
            <em>{service.status}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function LiveMatchLinksPanel({ liveMoment, liveMatches }) {
  return (
    <section className="live-link-strip shell-card" aria-label="Live match browser links">
      <div className="section-head">
        <div>
          <p className="eyebrow-copy">Live Matches</p>
          <h3>Browser Links</h3>
        </div>
        <a
          className="live-link-strip__current"
          href={liveMoment.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${liveMoment.matchup} live score in a new tab`}
        >
          Open current
        </a>
      </div>

      <div className="live-link-grid">
        {liveMatches.map((match) => {
          const isActive = match.id === liveMoment.id;

          return (
            <a
              key={match.id}
              className={`live-match-link ${isActive ? "live-match-link--active" : ""}`}
              href={match.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${match.matchup} live score in a new tab`}
            >
              <span className="live-match-link__status">
                <i aria-hidden="true" />
                {match.status}
              </span>
              <strong>{match.matchup}</strong>
              <small>
                {match.score} | {match.overs}
              </small>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function HomeDashboard({
  onOpen,
  liveMoment,
  liveMatches,
  identity,
  signals,
  runRateSeries,
  playerCards,
  fantasy,
  architecture,
  feedStatus
}) {
  return (
    <div className="dashboard-home">
      <section className="dashboard-hero dashboard-hero--live shell-card">
        <div className="dashboard-hero__copy">
          <p className="eyebrow-copy">CricketAI Platform</p>
          <h2 className="hero-title">{identity.name}</h2>
          <p className="hero-copy">
            {identity.tagline} Live prediction, player intelligence, fantasy optimization,
            and match-day decisioning in one command surface.
          </p>
          <div className="hero-live-row" aria-live="polite">
            <span className="hero-live-chip">
              <span className="hero-live-chip__dot" aria-hidden="true" />
              {liveMoment.status}
            </span>
            <span className="hero-live-matchup">{liveMoment.matchup}</span>
          </div>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onOpen("prediction")}>
              Open Prediction
            </button>
            <button type="button" className="secondary-button" onClick={() => onOpen("fantasy")}>
              Open Fantasy
            </button>
            <a
              className="link-button"
              href={liveMoment.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${liveMoment.matchup} live score in a new tab`}
            >
              Open Live Match
            </a>
            <span className={`feed-status feed-status--${feedStatus}`}>
              {feedStatus === "online" ? "API synced" : "Demo feed"}
            </span>
          </div>
        </div>

        <a
          className="broadcast-board broadcast-board--link"
          href={liveMoment.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${liveMoment.matchup} live score in a new tab`}
        >
          <div className="broadcast-board__top">
            <span>{liveMoment.phase}</span>
            <strong>{liveMoment.note}</strong>
          </div>
          <div className="broadcast-board__score">
            <div className="broadcast-score__main">
              <span className="broadcast-score__value">{liveMoment.score}</span>
              <strong className="broadcast-score__overs">{liveMoment.overs}</strong>
            </div>
            <div className="broadcast-score__meta">{liveMoment.matchup}</div>
          </div>
          <div className="broadcast-board__lanes">
            {liveMoment.lanes.map((item) => (
              <div key={item.label} className="broadcast-lane">
                <div className="broadcast-lane__top">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <small>{item.caption}</small>
                <div className="broadcast-lane__meter" aria-hidden="true">
                  <span style={{ "--lane-level": `${item.level}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="broadcast-board__ticker" aria-hidden="true">
            {liveMoment.ticker.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </a>
      </section>

      <LiveMatchLinksPanel liveMoment={liveMoment} liveMatches={liveMatches} />

      <section className="command-grid" aria-label="Live prediction command panels">
        <ProbabilityGauge liveMoment={liveMoment} />
        <RunRatePanel series={runRateSeries} />
      </section>

      <section className="signal-grid" aria-label="Live intelligence signals">
        {signals.map((signal) => (
          <IntelligenceSignalCard key={signal.label} signal={signal} />
        ))}
      </section>

      <PlayerIntelPanel playerCards={playerCards} />

      <section className="decision-layout" aria-label="Match operating overview">
        <MatchFlowPanel liveMoment={liveMoment} />
        <FantasyCommandPanel fantasy={fantasy} />
      </section>

      <ArchitecturePanel architecture={architecture} />

      <section className="kpi-grid" aria-label="Platform status">
        {homeKpis.map((item) => (
          <article key={item.label} className="kpi-card shell-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <p>{item.detail}</p> : null}
          </article>
        ))}
      </section>

      <section className="workspace-preview-grid" aria-label="Workspace shortcuts">
        {workspaceTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className="workspace-preview shell-card"
            style={{ "--accent": item.accent, "--accent-soft": item.soft }}
            aria-label={`Open ${item.label} tab`}
            onClick={() => onOpen(item.id)}
          >
            <div className="workspace-preview__head">
              <span className="workspace-preview__icon">
                <TabGlyph id={item.id} />
              </span>
              <span className="tool-kicker">{item.kicker}</span>
            </div>
            <h3>{item.label}</h3>
            {item.summary ? <p>{item.summary}</p> : null}
            <div className="workspace-preview__metrics">
              {item.metrics.slice(0, 2).map((metric) => (
                <span key={metric.label}>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
            <WorkspaceMiniChart id={item.id} />
          </button>
        ))}
      </section>
    </div>
  );
}

function WorkspaceOverview({ activeTab, onBack, onNext }) {
  return (
    <section
      className="workspace-overview shell-card"
      style={{ "--accent": activeTab.accent, "--accent-soft": activeTab.soft }}
    >
      <div className="workspace-overview__title">
        <span className="workspace-overview__icon">
          <TabGlyph id={activeTab.id} />
        </span>
        <div>
          <p className="eyebrow-copy">{activeTab.kicker}</p>
          <h2 className="hero-title">{activeTab.label}</h2>
          {activeTab.summary ? <p className="hero-copy">{activeTab.summary}</p> : null}
        </div>
      </div>

      <div className="hero-actions">
        <button type="button" className="primary-button" onClick={onBack}>
          Back Home
        </button>
        <button type="button" className="secondary-button" onClick={onNext}>
          Next Workspace
        </button>
      </div>

      <div className="workspace-overview__metrics">
        {activeTab.metrics.map((item) => (
          <article key={item.label} className="metric-card">
            <span className="metric-label">{item.label}</span>
            <strong className="metric-value">{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkspaceRail({ activeTab }) {
  return (
    <aside className="workspace-rail">
      <article
        className="side-panel shell-card"
        style={{ "--accent": activeTab.accent, "--accent-soft": activeTab.soft }}
      >
        <p className="eyebrow-copy">Status</p>
        <div className="status-list">
          {activeTab.board.map((row) => (
            <div key={row.label} className="status-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="side-panel shell-card">
        <p className="eyebrow-copy">System</p>
        <div className="status-list">
          <div className="status-row">
            <span>Frontend</span>
            <strong>3000</strong>
          </div>
          <div className="status-row">
            <span>Backend</span>
            <strong>8000</strong>
          </div>
          <div className="status-row">
            <span>Active tab</span>
            <strong>{activeTab.label}</strong>
          </div>
        </div>
      </article>
    </aside>
  );
}

function App() {
  const [tab, setTab] = useState("home");
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [liveMomentIndex, setLiveMomentIndex] = useState(0);
  const [platformDashboard, setPlatformDashboard] = useState(null);
  const [feedStatus, setFeedStatus] = useState("offline");
  const isHome = tab === "home";
  const activeTab = workspaceTabs.find((item) => item.id === tab) ?? workspaceTabs[0];
  const currentIndex = workspaceTabs.findIndex((item) => item.id === activeTab.id);
  const nextTab = workspaceTabs[(currentIndex + 1) % workspaceTabs.length];
  const theme = resolveTheme(themePreference, systemTheme);
  const liveFeed = platformDashboard?.liveMatches?.length
    ? platformDashboard.liveMatches
    : liveMoments;
  const liveMoment = liveFeed[liveMomentIndex % liveFeed.length];
  const identity = platformDashboard?.identity || {
    name: "CricketAI",
    tagline: "Predict. Analyze. Dominate the Game."
  };
  const dashboardSignals = platformDashboard?.intelligenceSignals?.length
    ? platformDashboard.intelligenceSignals
    : intelligenceSignals;
  const runRateSeries = platformDashboard?.runRateSeries?.length
    ? platformDashboard.runRateSeries
    : fallbackRunRateSeries;
  const playerCards = platformDashboard?.playerCards?.length
    ? platformDashboard.playerCards
    : fallbackPlayerCards;
  const fantasy = platformDashboard?.fantasy || fallbackFantasy;
  const architecture = platformDashboard?.architecture?.length
    ? platformDashboard.architecture
    : fallbackArchitecture;
  const themeStatus =
    themePreference === "system"
      ? `${THEME_OPTIONS.find((option) => option.id === themePreference)?.status} ${theme}`
      : THEME_OPTIONS.find((option) => option.id === themePreference)?.status;

  const handleTabChange = useCallback((nextTabId) => {
    startTransition(() => {
      setTab(nextTabId);
    });
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (event) => {
      setSystemTheme(event.matches ? "light" : "dark");
    };

    setSystemTheme(mediaQuery.matches ? "light" : "dark");

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);

      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener?.(handleChange);

    return () => mediaQuery.removeListener?.(handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [theme, themePreference]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveMomentIndex((current) => (current + 1) % liveFeed.length);
    }, 2600);

    return () => window.clearInterval(intervalId);
  }, [liveFeed.length]);

  useEffect(() => {
    let isMounted = true;

    fetch(`${API_BASE_URL}/platform/dashboard`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Dashboard API returned ${response.status}`);
        }

        return response.json();
      })
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setPlatformDashboard(normalizePlatformDashboard(payload));
        setFeedStatus(payload?.identity?.data_source === "cricapi" ? "online" : "demo");
      })
      .catch(() => {
        if (isMounted) {
          setFeedStatus("demo");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="ipl-app">
      <div className="app-frame">
        <aside className="app-sidebar shell-card">
          <div className="brand-block">
            <div className="brand-mark">CA</div>
            <div className="brand-copy">
              <p className="eyebrow-copy">CricketAI</p>
              <h1 className="brand-title">CricketAI Platform</h1>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Workspace navigation">
            {navigationTabs.map((item) => {
              const isActive = item.id === tab;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-tab ${isActive ? "nav-tab--active" : ""}`}
                  aria-label={`Switch to ${item.label} tab`}
                  aria-pressed={isActive}
                  onClick={() => handleTabChange(item.id)}
                >
                  <span className="nav-tab__icon">
                    <TabGlyph id={item.id} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.kicker}</small>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="app-main">
          <header className="topbar shell-card">
            <div>
              <p className="eyebrow-copy">{isHome ? "Live Intelligence" : activeTab.kicker}</p>
              <h2>{isHome ? identity.name : `${activeTab.label} Workspace`}</h2>
            </div>

            <div className="topbar-actions">
              <a
                className="topbar-live"
                href={liveMoment.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${liveMoment.matchup} live score in a new tab`}
              >
                <span>{liveMoment.matchup}</span>
                <strong>{liveMoment.score}</strong>
                <small>{liveMoment.overs}</small>
              </a>
              <div className="theme-toggle" role="group" aria-label="Theme mode">
                <div className="theme-toggle__segmented">
                  {THEME_OPTIONS.map((option) => {
                    const isActive = option.id === themePreference;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`theme-toggle__option ${
                          isActive ? "theme-toggle__option--active" : ""
                        }`}
                        aria-label={option.label}
                        aria-pressed={isActive}
                        title={option.label}
                        onClick={() => setThemePreference(option.id)}
                      >
                        <ThemeGlyph type={option.id} />
                      </button>
                    );
                  })}
                </div>
                <span className="theme-toggle__status">{themeStatus}</span>
              </div>
              <span className="live-pill">
                <span className="live-pill__dot" aria-hidden="true" />
                {isHome ? "Live Feed" : `${activeTab.label} Live`}
              </span>
            </div>
          </header>

          {isHome ? (
            <HomeDashboard
              onOpen={handleTabChange}
              liveMoment={liveMoment}
              liveMatches={liveFeed}
              identity={identity}
              signals={dashboardSignals}
              runRateSeries={runRateSeries}
              playerCards={playerCards}
              fantasy={fantasy}
              architecture={architecture}
              feedStatus={feedStatus}
            />
          ) : (
            <div className="workspace-layout">
              <div className="workspace-primary">
                <WorkspaceOverview
                  activeTab={activeTab}
                  onBack={() => handleTabChange("home")}
                  onNext={() => handleTabChange(nextTab.id)}
                />

                <section className="workspace-main shell-card">
                  <div className="workspace-head">
                    <div>
                      <p className="eyebrow-copy">{activeTab.kicker}</p>
                      <h2 className="section-title">{activeTab.label}</h2>
                    </div>
                    <div className="chip-row">
                      <span className="meta-chip">Local data</span>
                      <span className="meta-chip">FastAPI</span>
                      <span className="meta-chip">React</span>
                    </div>
                  </div>

                  <div className="workspace-body">
                    <Suspense fallback={<WorkspaceLoadingState activeTab={activeTab} />}>
                      {renderWorkspace(tab)}
                    </Suspense>
                  </div>
                </section>
              </div>

              <WorkspaceRail activeTab={activeTab} />
            </div>
          )}

          <footer className="footer-bar shell-card">
            <span>{feedStatus === "online" ? "CricAPI data" : "Local demo data"}</span>
            <span>Prediction, live dashboard, player intel, fantasy</span>
            <span>Frontend 3000 / API 8000</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
