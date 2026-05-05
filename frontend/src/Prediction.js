import { useId, useState } from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { API_BASE_URL } from "./api";
import { getPlayerDisplayName, getPlayerPhoto } from "./playerPhotos";
import usePlayerSuggestions from "./usePlayerSuggestions";

const batterPalette = {
  start: "#25c3ff",
  end: "#3158ff",
  chip: "#8fd8ff"
};

const bowlerPalette = {
  start: "#ffb14a",
  end: "#ff5b54",
  chip: "#ffd07d"
};

const heroSignals = [
  "Match state",
  "Run distribution",
  "History"
];

const DEFAULT_CONTEXT = {
  over: 1,
  ballNumber: 1,
  overRuns: 0
};

const DEFAULT_MATCH_STATE = {
  innings: 1,
  currentScore: 0,
  wicketsLost: 0,
  target: "",
  recentCommentary: ""
};

function createEmptyProfile(name = "", role = "") {
  return {
    name,
    role,
    runs: 0,
    balls: 0,
    strike_rate: 0,
    dot_rate: 0,
    economy: 0,
    phase_cards: []
  };
}

function createEmptyHeadToHead() {
  return {
    history_available: false,
    archive_note: "No history is available for this matchup yet.",
    balls: 0,
    runs: 0,
    strike_rate: 0,
    dot_rate: 0,
    by_over: [],
    contexts: []
  };
}

function createEmptyMatchState() {
  return {
    innings: 1,
    phase: "Powerplay",
    current_score: 0,
    wickets_lost: 0,
    wickets_in_hand: 10,
    target: null,
    required_runs: null,
    required_run_rate: null,
    current_run_rate: 0,
    balls_completed: 0,
    balls_remaining: 120,
    overs_completed: "0.0",
    projected_total: 0,
    projected_range: {
      floor: 0,
      base: 0,
      ceiling: 0,
      volatility: 0
    },
    phase_projection: [],
    pressure_index: 0,
    momentum: "Balanced start",
    par_score: 0,
    score_delta_to_par: 0,
    chase_win_probability: null
  };
}

function normalizeProfile(profile, fallbackName, role) {
  const source = profile || {};

  return {
    ...createEmptyProfile(fallbackName, role),
    ...source,
    name: getPlayerDisplayName(source.name || fallbackName),
    phase_cards: Array.isArray(source.phase_cards) ? source.phase_cards : []
  };
}

function normalizeHeadToHead(headToHead) {
  const source = headToHead || {};

  return {
    ...createEmptyHeadToHead(),
    ...source,
    by_over: Array.isArray(source.by_over) ? source.by_over : [],
    contexts: Array.isArray(source.contexts) ? source.contexts : []
  };
}

function normalizeMatchState(matchState) {
  const source = matchState || {};
  const defaults = createEmptyMatchState();

  return {
    ...defaults,
    ...source,
    projected_range: {
      ...defaults.projected_range,
      ...(source.projected_range || {})
    },
    phase_projection: Array.isArray(source.phase_projection) ? source.phase_projection : []
  };
}

function normalizePredictionResponse(data, requestedBatter, requestedBowler) {
  const source = data || {};
  const predictions = source.predictions || {};
  const resolvedBatter = source.resolved_batter || requestedBatter;
  const resolvedBowler = source.resolved_bowler || requestedBowler;

  return {
    ...source,
    resolved_batter: getPlayerDisplayName(resolvedBatter),
    resolved_bowler: getPlayerDisplayName(resolvedBowler),
    input_context: {
      over: source.input_context?.over ?? DEFAULT_CONTEXT.over,
      ball_number: source.input_context?.ball_number ?? DEFAULT_CONTEXT.ballNumber,
      over_runs: source.input_context?.over_runs ?? DEFAULT_CONTEXT.overRuns,
      innings: source.input_context?.innings ?? DEFAULT_MATCH_STATE.innings,
      current_score: source.input_context?.current_score ?? DEFAULT_MATCH_STATE.currentScore,
      wickets_lost: source.input_context?.wickets_lost ?? DEFAULT_MATCH_STATE.wicketsLost,
      target: source.input_context?.target ?? null,
      recent_commentary:
        source.input_context?.recent_commentary ?? DEFAULT_MATCH_STATE.recentCommentary
    },
    predictions: {
      next_ball_run: predictions.next_ball_run ?? "-",
      expected_next_ball_runs: predictions.expected_next_ball_runs ?? 0,
      projected_over_runs_remaining: predictions.projected_over_runs_remaining ?? 0,
      projected_total_over_runs: predictions.projected_total_over_runs ?? 0,
      projected_strike_rate: predictions.projected_strike_rate ?? 0,
      dismissal_risk: predictions.dismissal_risk ?? 0,
      win_probability: predictions.win_probability ?? 0,
      commentary: predictions.commentary || "",
      run_distribution: Array.isArray(predictions.run_distribution)
        ? predictions.run_distribution
        : []
    },
    batter_profile: normalizeProfile(source.batter_profile, resolvedBatter, "batter"),
    bowler_profile: normalizeProfile(source.bowler_profile, resolvedBowler, "bowler"),
    head_to_head: normalizeHeadToHead(source.head_to_head),
    match_state: normalizeMatchState(source.match_state)
  };
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function createPortrait(name, palette, role) {
  const initials = getInitials(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="46" fill="url(#bg)" />
      <circle cx="160" cy="122" r="60" fill="rgba(255,255,255,0.18)" />
      <path d="M92 258c16-42 45-68 68-68s52 26 68 68" fill="rgba(255,255,255,0.18)" />
      <circle cx="248" cy="70" r="28" fill="rgba(3,10,24,0.24)" />
      <path d="M236 70h24M248 58v24" stroke="rgba(255,255,255,0.5)" stroke-width="4" stroke-linecap="round" />
      <text x="160" y="290" text-anchor="middle" fill="white" font-size="44" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${initials}</text>
      <text x="160" y="34" text-anchor="middle" fill="rgba(255,255,255,0.84)" font-size="20" font-family="Segoe UI, Arial, sans-serif" letter-spacing="4">${role.toUpperCase()}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDecimal(value) {
  return Number(value || 0).toFixed(1);
}

function formatNullableValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${value}${suffix}`;
}

function formatScore(score, wickets) {
  return `${score}/${wickets}`;
}

function formatRange(range) {
  return `${formatDecimal(range.floor)} - ${formatDecimal(range.ceiling)}`;
}

function displayValue(value, suffix = "") {
  const formatted = formatNullableValue(value, suffix);
  return formatted;
}

function buildProfileHighlights(profile, role) {
  if (role === "batter") {
    return [
      { label: "Runs", value: profile.runs },
      { label: "Balls", value: profile.balls },
      { label: "Strike Rate", value: formatDecimal(profile.strike_rate) },
      { label: "Dot Rate", value: formatPercent((profile.dot_rate || 0) * 100) }
    ];
  }

  return [
    { label: "Runs Conceded", value: profile.runs },
    { label: "Balls Bowled", value: profile.balls },
    { label: "Economy", value: formatDecimal(profile.economy) },
    { label: "Dot Rate", value: formatPercent((profile.dot_rate || 0) * 100) }
  ];
}

function phaseValue(phase, role) {
  return role === "batter"
    ? `${formatDecimal(phase.strike_rate)} SR`
    : `${formatDecimal(phase.economy)} Econ`;
}

function PlayerCard({ label, profile, role, palette }) {
  const highlights = buildProfileHighlights(profile, role);
  const fallbackPortrait = createPortrait(profile.name, palette, role);
  const playerPhoto = getPlayerPhoto(profile.name);

  return (
    <section style={playerCardStyle}>
      <div style={playerHeaderStyle}>
        <img
          alt={`${profile.name} portrait`}
          src={playerPhoto || fallbackPortrait}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = fallbackPortrait;
          }}
          style={portraitStyle}
        />

        <div style={{ flex: 1, minWidth: "220px" }}>
          <div style={{ ...eyebrowStyle, color: palette.chip }}>{label}</div>
          <h3 style={playerNameStyle}>{profile.name}</h3>
        </div>
      </div>

      <div style={statGridStyle}>
        {highlights.map((item) => (
          <div key={item.label} style={miniCardStyle}>
            <div style={miniCardLabelStyle}>{item.label}</div>
            <div style={miniCardValueStyle}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={phaseGridStyle}>
        {(profile.phase_cards || []).map((phase) => (
          <div key={phase.key} style={phaseCardStyle}>
            <div style={miniCardLabelStyle}>{phase.label}</div>
            <div style={phaseValueStyle}>{phaseValue(phase, role)}</div>
            <div style={phaseCopyStyle}>
              {phase.runs} runs across {phase.balls} balls
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function mapSuggestionNames(players = []) {
  return [...new Set(players.map((name) => getPlayerDisplayName(name)).filter(Boolean))];
}

function Prediction() {
  const [batter, setBatter] = useState("Virat Kohli");
  const [bowler, setBowler] = useState("Jasprit Bumrah");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const batterListId = useId();
  const bowlerListId = useId();
  const batterSuggestions = usePlayerSuggestions(batter);
  const bowlerSuggestions = usePlayerSuggestions(bowler);
  const batterOptions = mapSuggestionNames(batterSuggestions.batters);
  const bowlerOptions = mapSuggestionNames(bowlerSuggestions.bowlers);

  const validateInputs = () => {
    if (!batter.trim() || !bowler.trim()) {
      setError("Enter both batter and bowler names.");
      return false;
    }

    setError("");
    return true;
  };

  const analyzeMatchup = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/prediction-intel`, {
        batter: batter.trim(),
        bowler: bowler.trim(),
        over: DEFAULT_CONTEXT.over,
        ball_number: DEFAULT_CONTEXT.ballNumber,
        over_runs: DEFAULT_CONTEXT.overRuns,
        innings: DEFAULT_MATCH_STATE.innings,
        current_score: DEFAULT_MATCH_STATE.currentScore,
        wickets_lost: DEFAULT_MATCH_STATE.wicketsLost,
        target: null,
        recent_commentary: DEFAULT_MATCH_STATE.recentCommentary
      });

      if (response.data.error) {
        setError(response.data.error);
        setAnalysis(null);
        return;
      }

      const normalized = normalizePredictionResponse(
        response.data,
        batter.trim(),
        bowler.trim()
      );

      setAnalysis(normalized);
      setBatter(normalized.resolved_batter);
      setBowler(normalized.resolved_bowler);
      setError("");
    } catch (requestError) {
      setError("Prediction analysis failed. Check that the backend is running on port 8000.");
      console.error(requestError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="workspace-module prediction-module" style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroSplitStyle}>
          <div>
            <div style={eyebrowStyle}>Prediction</div>
            <h2 style={heroTitleStyle}>Batter vs Bowler</h2>
          </div>

          <div style={heroRailStyle}>
            {heroSignals.map((item) => (
              <div key={item} style={heroSignalCardStyle}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={controlCardStyle}>
        <div style={controlHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Match Filters</div>
            <h3 style={sectionTitleStyle}>Choose the batter and bowler</h3>
          </div>
          <div style={contextBadgeStyle}>Full names preferred</div>
        </div>

        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Batter</span>
            <input
              list={batterListId}
              placeholder="Enter batter"
              value={batter}
              onChange={(event) => setBatter(event.target.value)}
              style={inputStyle}
            />
            <datalist id={batterListId}>
              {batterOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Bowler</span>
            <input
              list={bowlerListId}
              placeholder="Enter bowler"
              value={bowler}
              onChange={(event) => setBowler(event.target.value)}
              style={inputStyle}
            />
            <datalist id={bowlerListId}>
              {bowlerOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>

        <div style={buttonRowStyle}>
          <button
            style={primaryButtonStyle}
            type="button"
            onClick={analyzeMatchup}
            disabled={isLoading}
          >
            {isLoading ? "Analyzing..." : "Analyze Matchup"}
          </button>
        </div>

        {error && (
          <div role="alert" style={{ ...messageCardStyle, background: "var(--message-error-bg)" }}>
            {error}
          </div>
        )}
      </section>

      {analysis && (
        <>
          <section style={spotlightCardStyle}>
            <div style={spotlightHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Summary</div>
                <h3 style={sectionTitleStyle}>
                  {analysis.resolved_batter} vs {analysis.resolved_bowler}
                </h3>
              </div>
              <div style={contextBadgeStyle}>
                {analysis.match_state.phase} | Over {analysis.input_context?.over}.
                {analysis.input_context?.ball_number}
              </div>
            </div>

            <div style={spotlightGridStyle}>
              <div style={spotlightTileStyle}>
                <div style={miniCardLabelStyle}>Current Score</div>
                <div style={spotlightValueStyle}>
                  {formatScore(
                    analysis.match_state.current_score,
                    analysis.match_state.wickets_lost
                  )}
                </div>
              </div>

              <div style={spotlightTileStyle}>
                <div style={miniCardLabelStyle}>Next Ball</div>
                <div style={spotlightValueStyle}>{analysis.predictions.next_ball_run}</div>
              </div>

              <div style={spotlightTileStyle}>
                <div style={miniCardLabelStyle}>Projected Finish</div>
                <div style={spotlightValueStyle}>
                  {formatDecimal(analysis.match_state.projected_total)}
                </div>
              </div>

              <div style={spotlightTileStyle}>
                <div style={miniCardLabelStyle}>Pressure Index</div>
                <div style={spotlightValueStyle}>{analysis.match_state.pressure_index}</div>
              </div>

              <div style={spotlightTileStyle}>
                <div style={miniCardLabelStyle}>
                  {analysis.match_state.innings === 2 ? "Chase Win" : "Vs Par"}
                </div>
                <div style={spotlightValueStyle}>
                  {analysis.match_state.innings === 2
                    ? displayValue(analysis.match_state.chase_win_probability, "%")
                    : `${analysis.match_state.score_delta_to_par >= 0 ? "+" : ""}${formatDecimal(
                        analysis.match_state.score_delta_to_par
                      )}`}
                </div>
              </div>
            </div>
          </section>

          <section style={metricsCardStyle}>
            <div style={eyebrowStyle}>Match State</div>
            <div style={metricsGridStyle}>
              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>Current RR</div>
                <div style={metricPrimaryStyle}>
                  {formatDecimal(analysis.match_state.current_run_rate)}
                </div>
              </div>

              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>
                  {analysis.match_state.innings === 2 ? "Required RR" : "Par Score"}
                </div>
                <div style={metricPrimaryStyle}>
                  {analysis.match_state.innings === 2
                    ? displayValue(analysis.match_state.required_run_rate)
                    : formatDecimal(analysis.match_state.par_score)}
                </div>
              </div>

              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>Projected Range</div>
                <div style={metricPrimaryStyle}>
                  {formatRange(analysis.match_state.projected_range)}
                </div>
              </div>

              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>Momentum</div>
                <div style={metricNarrativeStyle}>{analysis.match_state.momentum}</div>
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <div style={subSectionLabelStyle}>Projected runs by phase</div>
              <div style={phaseProjectionGridStyle}>
                {analysis.match_state.phase_projection.map((item) => (
                  <div key={item.label} style={phaseProjectionCardStyle}>
                    <div style={miniCardLabelStyle}>{item.label}</div>
                    <div style={phaseProjectionValueStyle}>{formatDecimal(item.runs)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={comparisonGridStyle}>
            <PlayerCard
              label="Batter Profile"
              profile={analysis.batter_profile}
              role="batter"
              palette={batterPalette}
            />
            <PlayerCard
              label="Bowler Profile"
              profile={analysis.bowler_profile}
              role="bowler"
              palette={bowlerPalette}
            />
          </section>

          <section style={metricsCardStyle}>
            <div style={eyebrowStyle}>Prediction</div>
            <div style={metricsGridStyle}>
              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>Next Ball Run</div>
                <div style={metricPrimaryStyle}>{analysis.predictions.next_ball_run}</div>
              </div>

              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>Expected Value</div>
                <div style={metricPrimaryStyle}>
                  {analysis.predictions.expected_next_ball_runs}
                </div>
              </div>

              <div style={metricCardStyle}>
              <div style={miniCardLabelStyle}>Projected Over Total</div>
              <div style={metricPrimaryStyle}>
                {analysis.predictions.projected_total_over_runs}
              </div>
              </div>

              <div style={metricCardStyle}>
                <div style={miniCardLabelStyle}>Dismissal Risk</div>
                <div style={metricPrimaryStyle}>{analysis.predictions.dismissal_risk}%</div>
              </div>
            </div>
          </section>

          <section style={chartGridStyle}>
            <div style={chartCardStyle}>
              <div style={eyebrowStyle}>Run Distribution</div>
              <h3 style={chartTitleStyle}>Next Ball Probabilities</h3>
              <div style={{ height: "320px" }}>
                {analysis.predictions.run_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.predictions.run_distribution}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                      <XAxis dataKey="run" stroke="var(--chart-axis)" />
                      <YAxis stroke="var(--chart-axis)" />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Probability"]}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="probability" fill="#29b7ff" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={emptyStateStyle}>Run distribution is unavailable for this query.</div>
                )}
              </div>
            </div>

            <div style={chartCardStyle}>
              <div style={eyebrowStyle}>History By Over</div>
              <h3 style={chartTitleStyle}>Head-to-Head Runs by Over</h3>
              <div style={{ height: "320px" }}>
                {analysis.head_to_head.history_available && analysis.head_to_head.by_over.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analysis.head_to_head.by_over}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                      <XAxis dataKey="over" stroke="var(--chart-axis)" />
                      <YAxis stroke="var(--chart-axis)" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="runs"
                        stroke="#ffb14a"
                        fill="rgba(255, 177, 74, 0.24)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={emptyStateStyle}>
                    No history found for this matchup yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section style={chartCardStyle}>
            <div style={eyebrowStyle}>Matchup History</div>
            <h3 style={chartTitleStyle}>
              {analysis.resolved_batter} vs {analysis.resolved_bowler}
            </h3>

            <div style={statGridStyle}>
              <div style={miniCardStyle}>
                <div style={miniCardLabelStyle}>Tracked Balls</div>
                <div style={miniCardValueStyle}>{analysis.head_to_head.balls}</div>
              </div>
              <div style={miniCardStyle}>
                <div style={miniCardLabelStyle}>Runs Scored</div>
                <div style={miniCardValueStyle}>{analysis.head_to_head.runs}</div>
              </div>
              <div style={miniCardStyle}>
                <div style={miniCardLabelStyle}>Head-to-Head SR</div>
                <div style={miniCardValueStyle}>{analysis.head_to_head.strike_rate}</div>
              </div>
              <div style={miniCardStyle}>
                <div style={miniCardLabelStyle}>Dot Rate</div>
                <div style={miniCardValueStyle}>
                  {formatPercent((analysis.head_to_head.dot_rate || 0) * 100)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <div style={subSectionLabelStyle}>Team contexts</div>
              {analysis.head_to_head.contexts?.length > 0 ? (
                <div style={historyListStyle}>
                  {analysis.head_to_head.contexts.map((context) => (
                    <div key={context.label} style={historyRowStyle}>
                      <div>
                        <div style={historyRowTitleStyle}>{context.label}</div>
                        <div style={historyRowMetaStyle}>
                          {context.balls} balls, {context.runs} runs, {context.dot_rate}% dots
                        </div>
                      </div>
                      <div style={historyRowValueStyle}>{context.strike_rate} SR</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={emptyStateStyle}>No team context history found.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "20px",
  maxWidth: "1240px"
};

const panelSurface = {
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  boxShadow: "var(--shadow-panel)"
};

const heroCardStyle = {
  ...panelSurface,
  padding: "24px",
  borderRadius: "26px",
  background: "var(--surface-hero)"
};

const heroSplitStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(220px, 0.95fr)",
  gap: "18px",
  alignItems: "center"
};

const heroRailStyle = {
  display: "grid",
  gap: "10px"
};

const heroSignalCardStyle = {
  padding: "14px 16px",
  borderRadius: "18px",
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-muted)",
  color: "var(--text-tertiary)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontSize: "12px"
};

const controlCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px",
  display: "grid",
  gap: "16px"
};

const controlHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  flexWrap: "wrap"
};

const contextBadgeStyle = {
  padding: "10px 14px",
  borderRadius: "999px",
  background: "var(--surface-elevated)",
  color: "var(--status-warm)",
  fontSize: "13px",
  fontWeight: 700
};

const heroTitleStyle = {
  margin: "10px 0 8px",
  color: "var(--text-primary)",
  fontSize: "32px",
  lineHeight: 1.1
};

const sectionTitleStyle = {
  margin: "8px 0 0",
  color: "var(--text-primary)",
  fontSize: "24px"
};

const eyebrowStyle = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--eyebrow-text)"
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px"
};

const fieldStyle = {
  display: "grid",
  gap: "8px"
};

const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "16px",
  border: "1px solid var(--border-muted)",
  outline: "none",
  background: "var(--field-bg)",
  color: "var(--text-primary)",
  boxSizing: "border-box"
};

const buttonRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px"
};

const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #1c90ff, #385bff)",
  color: "var(--text-primary)",
  fontWeight: 700,
  cursor: "pointer"
};

const messageCardStyle = {
  padding: "14px 16px",
  borderRadius: "18px",
  border: "1px solid var(--border-soft)",
  color: "var(--text-primary)"
};

const spotlightCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px",
  display: "grid",
  gap: "16px"
};

const spotlightHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  alignItems: "flex-start"
};

const spotlightGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px"
};

const spotlightTileStyle = {
  padding: "18px",
  borderRadius: "20px",
  background: "var(--surface-muted)",
  border: "1px solid var(--border-muted)"
};

const spotlightValueStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "30px",
  fontWeight: 700
};

const comparisonGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px"
};

const playerCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px"
};

const playerHeaderStyle = {
  display: "flex",
  gap: "18px",
  alignItems: "center",
  flexWrap: "wrap"
};

const portraitStyle = {
  width: "118px",
  height: "118px",
  borderRadius: "28px",
  border: "1px solid var(--border-soft)",
  objectFit: "cover",
  flexShrink: 0
};

const playerNameStyle = {
  margin: "8px 0 6px",
  color: "var(--text-primary)",
  fontSize: "28px"
};

const metricsCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px"
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
  marginTop: "16px"
};

const metricCardStyle = {
  padding: "16px",
  borderRadius: "18px",
  background: "var(--surface-muted)"
};

const miniCardLabelStyle = {
  color: "var(--text-soft)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.1em"
};

const metricPrimaryStyle = {
  marginTop: "8px",
  color: "var(--text-primary)",
  fontSize: "28px",
  fontWeight: 700
};

const metricNarrativeStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "20px",
  fontWeight: 700,
  lineHeight: 1.3
};

const chartGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px"
};

const chartCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px"
};

const chartTitleStyle = {
  margin: "10px 0 14px",
  color: "var(--text-primary)",
  fontSize: "24px"
};

const statGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginTop: "18px"
};

const miniCardStyle = {
  padding: "14px",
  borderRadius: "16px",
  background: "var(--surface-muted)"
};

const miniCardValueStyle = {
  marginTop: "8px",
  color: "var(--text-primary)",
  fontSize: "24px",
  fontWeight: 700
};

const phaseGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "10px",
  marginTop: "18px"
};

const phaseCardStyle = {
  padding: "14px",
  borderRadius: "16px",
  background: "var(--surface-muted)"
};

const phaseValueStyle = {
  marginTop: "8px",
  color: "var(--text-primary)",
  fontSize: "20px",
  fontWeight: 700
};

const phaseCopyStyle = {
  marginTop: "8px",
  color: "var(--text-muted)",
  fontSize: "12px",
  lineHeight: 1.5
};

const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "10px"
};

const emptyStateStyle = {
  display: "grid",
  placeItems: "center",
  height: "100%",
  textAlign: "center",
  color: "var(--text-tertiary)"
};

const subSectionLabelStyle = {
  color: "var(--text-secondary)",
  fontSize: "14px",
  marginBottom: "12px"
};

const phaseProjectionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px"
};

const phaseProjectionCardStyle = {
  padding: "14px",
  borderRadius: "16px",
  background: "var(--surface-muted)",
  border: "1px solid var(--border-soft)"
};

const phaseProjectionValueStyle = {
  marginTop: "8px",
  color: "var(--text-primary)",
  fontSize: "22px",
  fontWeight: 700
};

const historyListStyle = {
  display: "grid",
  gap: "10px",
  maxHeight: "360px",
  overflowY: "auto",
  paddingRight: "4px"
};

const historyRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  padding: "14px 16px",
  borderRadius: "16px",
  background: "var(--surface-muted)"
};

const historyRowTitleStyle = {
  color: "var(--text-primary)",
  fontWeight: 600
};

const historyRowMetaStyle = {
  marginTop: "6px",
  color: "var(--text-muted)",
  fontSize: "13px"
};

const historyRowValueStyle = {
  color: "var(--status-warm)",
  fontWeight: 700
};

export default Prediction;
