import { useId, useState } from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { API_BASE_URL } from "./api";
import { getPlayerPhoto } from "./playerPhotos";
import usePlayerSuggestions from "./usePlayerSuggestions";

const SIMULATION_RUNS = 6;

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
  "Totals",
  "Over chart",
  "Range"
];

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
      <text x="160" y="290" text-anchor="middle" fill="white" font-size="44" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${initials}</text>
      <text x="160" y="34" text-anchor="middle" fill="rgba(255,255,255,0.84)" font-size="20" font-family="Segoe UI, Arial, sans-serif" letter-spacing="4">${role.toUpperCase()}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildOverSeries(overs = []) {
  let previous = 0;

  return overs.map((entry) => {
    const cumulative = entry.runs;
    const overRuns = cumulative - previous;
    previous = cumulative;

    return {
      over: entry.over,
      cumulative,
      overRuns,
      runRate: Number((cumulative / entry.over).toFixed(2))
    };
  });
}

function getOverCumulative(series, over) {
  return series.find((entry) => entry.over === over)?.cumulative || 0;
}

function buildScenario(response, index) {
  const series = buildOverSeries(response.overs || []);
  const totalRuns = response.total_runs || 0;
  const powerplay = getOverCumulative(series, 6);
  const middle = getOverCumulative(series, 15) - powerplay;
  const death = totalRuns - getOverCumulative(series, 15);
  const peakOverEntry = series.reduce(
    (best, current) => (current.overRuns > best.overRuns ? current : best),
    { over: 1, overRuns: 0 }
  );

  return {
    id: `${index}-${totalRuns}`,
    totalRuns,
    series,
    powerplay,
    middle,
    death,
    averageRunRate: Number((totalRuns / 20).toFixed(2)),
    peakOver: peakOverEntry.over,
    peakOverRuns: peakOverEntry.overRuns
  };
}

function combineScenarioCurves(scenarios) {
  return Array.from({ length: 20 }, (_, index) => {
    const over = index + 1;
    const point = { over };

    scenarios.forEach((scenario) => {
      point[scenario.variant] =
        scenario.series.find((entry) => entry.over === over)?.cumulative || 0;
    });

    return point;
  });
}

function summarizeScenarios(rawScenarios) {
  const ordered = [...rawScenarios].sort((left, right) => left.totalRuns - right.totalRuns);
  const floor = { ...ordered[0], variant: "floor", label: "Floor" };
  const ceiling = {
    ...ordered[ordered.length - 1],
    variant: "ceiling",
    label: "Ceiling"
  };
  const base = {
    ...ordered[Math.floor(ordered.length / 2)],
    variant: "base",
    label: "Base Case"
  };

  return {
    floor,
    base,
    ceiling,
    averageTotal: Number(
      (
        rawScenarios.reduce((sum, scenario) => sum + scenario.totalRuns, 0) /
        rawScenarios.length
      ).toFixed(1)
    ),
    volatilityBand: ceiling.totalRuns - floor.totalRuns,
    curve: combineScenarioCurves([floor, base, ceiling]),
    gallery: ordered
      .map((scenario, index) => ({
        ...scenario,
        label:
          index === 0
            ? "Floor"
            : index === ordered.length - 1
              ? "Ceiling"
              : scenario.totalRuns === base.totalRuns
                ? "Base Case"
                : `Run ${index + 1}`
      }))
      .reverse()
  };
}

function MatchupPortrait({ label, name, palette, role }) {
  const fallbackPortrait = createPortrait(name, palette, role);
  const playerPhoto = getPlayerPhoto(name);

  return (
    <div style={matchupPortraitStyle}>
      <img
        alt={`${name} portrait`}
        src={playerPhoto || fallbackPortrait}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallbackPortrait;
        }}
        style={portraitStyle}
      />
      <div>
        <div style={{ ...eyebrowStyle, color: palette.chip }}>{label}</div>
        <div style={portraitNameStyle}>{name}</div>
      </div>
    </div>
  );
}

function Simulation() {
  const [batter, setBatter] = useState("Virat Kohli");
  const [bowler, setBowler] = useState("JJ Bumrah");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const batterListId = useId();
  const bowlerListId = useId();
  const batterSuggestions = usePlayerSuggestions(batter);
  const bowlerSuggestions = usePlayerSuggestions(bowler);

  const runSimulation = async () => {
    if (!batter.trim() || !bowler.trim()) {
      setError("Enter both batter and bowler names.");
      return;
    }

    try {
      setIsLoading(true);

      const responses = await Promise.all(
        Array.from({ length: SIMULATION_RUNS }, () =>
          axios.post(`${API_BASE_URL}/simulate`, {
            batter: batter.trim(),
            bowler: bowler.trim()
          })
        )
      );

      const first = responses[0].data;
      const scenarios = responses.map((response, index) =>
        buildScenario(response.data, index)
      );
      const summary = summarizeScenarios(scenarios);

      setAnalysis({
        requestedBatter: batter.trim(),
        requestedBowler: bowler.trim(),
        resolvedBatter: first.resolved_batter || batter.trim(),
        resolvedBowler: first.resolved_bowler || bowler.trim(),
        summary
      });
      setBatter(first.resolved_batter || batter.trim());
      setBowler(first.resolved_bowler || bowler.trim());
      setError("");
    } catch (requestError) {
      setError("Simulation failed. Check that the backend is running on port 8000.");
      console.error(requestError);
    } finally {
      setIsLoading(false);
    }
  };

  const baseScenario = analysis?.summary.base;
  const floorScenario = analysis?.summary.floor;
  const ceilingScenario = analysis?.summary.ceiling;

  return (
    <div className="workspace-module simulation-module" style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroSplitStyle}>
          <div>
            <div style={eyebrowStyle}>Simulation</div>
            <h2 style={heroTitleStyle}>Score Projections</h2>
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
            <h3 style={sectionTitleStyle}>Choose the batter-bowler matchup</h3>
          </div>
          <div style={contextBadgeStyle}>{SIMULATION_RUNS} simulation runs</div>
        </div>

        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Batter</span>
            <input
              list={batterListId}
              value={batter}
              onChange={(event) => setBatter(event.target.value)}
              placeholder="Enter batter"
              style={inputStyle}
            />
            <datalist id={batterListId}>
              {batterSuggestions.batters.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Bowler</span>
            <input
              list={bowlerListId}
              value={bowler}
              onChange={(event) => setBowler(event.target.value)}
              placeholder="Enter bowler"
              style={inputStyle}
            />
            <datalist id={bowlerListId}>
              {bowlerSuggestions.bowlers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>

        <div style={buttonRowStyle}>
          <button type="button" style={primaryButtonStyle} onClick={runSimulation} disabled={isLoading}>
            {isLoading ? "Loading..." : "Run Simulation"}
          </button>
        </div>

        {error && (
          <div role="alert" style={{ ...messageCardStyle, background: "var(--message-error-bg)" }}>
            {error}
          </div>
        )}
      </section>

      {analysis && baseScenario && floorScenario && ceilingScenario && (
        <>
          <section style={matchupCardStyle}>
            <div style={matchupGridStyle}>
              <MatchupPortrait
                label="Batter"
                name={analysis.resolvedBatter}
                palette={batterPalette}
                role="batter"
              />
              <div style={versusStyle}>vs</div>
              <MatchupPortrait
                label="Bowler"
                name={analysis.resolvedBowler}
                palette={bowlerPalette}
                role="bowler"
              />
            </div>

            <div style={tickerGridStyle}>
              <div style={tickerCardStyle}>
                <div style={miniLabelStyle}>Average Total</div>
                <div style={tickerValueStyle}>{analysis.summary.averageTotal}</div>
              </div>
              <div style={tickerCardStyle}>
                <div style={miniLabelStyle}>Volatility Band</div>
                <div style={tickerValueStyle}>{analysis.summary.volatilityBand} runs</div>
              </div>
              <div style={tickerCardStyle}>
                <div style={miniLabelStyle}>Base RR</div>
                <div style={tickerValueStyle}>{baseScenario.averageRunRate}</div>
              </div>
            </div>
          </section>

          <section style={metricsGridStyle}>
            <div style={metricCardStyle}>
              <div style={miniLabelStyle}>Base Case</div>
              <div style={metricValueStyle}>{baseScenario.totalRuns}</div>
              <div style={metricCopyStyle}>Projected full-innings total</div>
            </div>
            <div style={metricCardStyle}>
              <div style={miniLabelStyle}>Powerplay</div>
              <div style={metricValueStyle}>{baseScenario.powerplay}</div>
              <div style={metricCopyStyle}>Runs in the first 6 overs</div>
            </div>
            <div style={metricCardStyle}>
              <div style={miniLabelStyle}>Death Overs</div>
              <div style={metricValueStyle}>{baseScenario.death}</div>
              <div style={metricCopyStyle}>Runs in overs 16-20</div>
            </div>
              <div style={metricCardStyle}>
                <div style={miniLabelStyle}>Peak Over</div>
                <div style={metricValueStyle}>
                  {baseScenario.peakOver} ({baseScenario.peakOverRuns})
                </div>
                <div style={metricCopyStyle}>Highest-scoring over</div>
              </div>
            </section>

          <section style={chartGridStyle}>
            <div style={chartCardStyle}>
              <div style={eyebrowStyle}>Cumulative Runs</div>
              <h3 style={chartTitleStyle}>Base Case by Over</h3>
              <div style={{ height: "330px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={baseScenario.series}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="over" stroke="var(--chart-axis)" />
                    <YAxis stroke="var(--chart-axis)" />
                    <Tooltip
                      formatter={(value, name) => [
                        value,
                        name === "cumulative" ? "Cumulative Runs" : "Run Rate"
                      ]}
                      contentStyle={tooltipStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#29b7ff"
                      fill="rgba(41, 183, 255, 0.24)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={chartCardStyle}>
              <div style={eyebrowStyle}>Over Breakdown</div>
              <h3 style={chartTitleStyle}>Runs Scored Per Over</h3>
              <div style={{ height: "330px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={baseScenario.series}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="over" stroke="var(--chart-axis)" />
                    <YAxis stroke="var(--chart-axis)" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="overRuns" fill="#ffb14a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section style={chartCardStyle}>
            <div style={eyebrowStyle}>Scenario Comparison</div>
            <h3 style={chartTitleStyle}>Floor, Base, and Ceiling</h3>
            <div style={{ height: "360px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.summary.curve}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis dataKey="over" stroke="var(--chart-axis)" />
                  <YAxis stroke="var(--chart-axis)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="floor"
                    name="Floor"
                    stroke="#ff9f43"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="base"
                    name="Base"
                    stroke="#29b7ff"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ceiling"
                    name="Ceiling"
                    stroke="#4ade80"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={galleryCardStyle}>
            <div style={eyebrowStyle}>All Results</div>
            <h3 style={chartTitleStyle}>All Simulation Outcomes</h3>
            <div style={galleryGridStyle}>
              {analysis.summary.gallery.map((scenario) => (
                <div key={scenario.id} style={scenarioCardStyle}>
                  <div style={miniLabelStyle}>{scenario.label}</div>
                  <div style={scenarioTotalStyle}>{scenario.totalRuns}</div>
                  <div style={scenarioMetaStyle}>
                    Avg RR {scenario.averageRunRate} | PP {scenario.powerplay} | Death {scenario.death}
                  </div>
                  <div style={scenarioMetaStyle}>
                    Peak over {scenario.peakOver} for {scenario.peakOverRuns}
                  </div>
                </div>
              ))}
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

const matchupCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px"
};

const matchupGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
  alignItems: "center"
};

const matchupPortraitStyle = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  minWidth: 0
};

const portraitStyle = {
  width: "120px",
  height: "120px",
  borderRadius: "28px",
  border: "1px solid var(--border-soft)",
  objectFit: "cover",
  flexShrink: 0
};

const portraitNameStyle = {
  marginTop: "8px",
  color: "var(--text-primary)",
  fontSize: "24px",
  fontWeight: 700
};

const versusStyle = {
  color: "var(--text-tertiary)",
  fontSize: "28px",
  fontWeight: 700,
  textAlign: "center"
};

const tickerGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
  marginTop: "20px"
};

const tickerCardStyle = {
  padding: "16px",
  borderRadius: "18px",
  background: "var(--surface-muted)"
};

const miniLabelStyle = {
  color: "var(--text-soft)",
  fontSize: "12px",
  letterSpacing: "0.1em",
  textTransform: "uppercase"
};

const tickerValueStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "28px",
  fontWeight: 700
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px"
};

const metricCardStyle = {
  ...panelSurface,
  padding: "18px",
  borderRadius: "22px"
};

const metricValueStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "30px",
  fontWeight: 700
};

const metricCopyStyle = {
  marginTop: "8px",
  color: "var(--text-tertiary)",
  lineHeight: 1.5
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

const galleryCardStyle = {
  ...panelSurface,
  padding: "22px",
  borderRadius: "24px"
};

const galleryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px"
};

const scenarioCardStyle = {
  padding: "16px",
  borderRadius: "18px",
  background: "var(--surface-muted)"
};

const scenarioTotalStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "28px",
  fontWeight: 700
};

const scenarioMetaStyle = {
  marginTop: "8px",
  color: "var(--text-tertiary)",
  lineHeight: 1.5
};

const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "10px"
};

export default Simulation;
