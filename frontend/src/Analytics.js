import { getPlayerPhoto } from "./playerPhotos";

const strengths = [
  {
    name: "Virat Kohli",
    role: "Anchor",
    strikeRate: 142,
    matchup: "Strong against pace in the final overs",
    tag: "Anchor",
    form: 86,
    control: 78,
    accent: "#37b7ff"
  },
  {
    name: "Suryakumar Yadav",
    role: "Accelerator",
    strikeRate: 168,
    matchup: "Strong against hard lengths",
    tag: "Attacking batter",
    form: 91,
    control: 64,
    accent: "#ffb547"
  },
  {
    name: "Jasprit Bumrah",
    role: "Closer",
    strikeRate: 91,
    matchup: "Keeps boundary rate low in overs 17-20",
    tag: "Death bowler",
    form: 88,
    control: 93,
    accent: "#42dfb4"
  }
];

const signals = [
  "Powerplay scoring remains the fastest phase.",
  "Middle overs still score at the lowest rate.",
  "Death overs show the biggest wicket swings."
];

const phaseRows = [
  { phase: "Powerplay", runRate: "8.7", wickets: "Low", pressure: 58 },
  { phase: "Middle", runRate: "7.2", wickets: "Medium", pressure: 71 },
  { phase: "Death", runRate: "11.4", wickets: "High", pressure: 89 }
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

function PlayerPhoto({ player }) {
  const photo = getPlayerPhoto(player.name);

  if (photo) {
    return <img src={photo} alt={`${player.name} portrait`} style={portraitStyle} />;
  }

  return (
    <div style={{ ...portraitFallbackStyle, "--accent": player.accent }}>
      {getInitials(player.name)}
    </div>
  );
}

function SignalMeter({ label, value, accent }) {
  return (
    <div style={meterStyle}>
      <div style={meterTopStyle}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={meterTrackStyle}>
        <span style={{ ...meterFillStyle, width: `${value}%`, background: accent }} />
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <div className="workspace-module analytics-module" style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroGridStyle}>
          <div>
            <div style={eyebrowStyle}>Analytics</div>
            <h2 style={heroTitleStyle}>Player Analytics</h2>
          </div>

          <div style={heroBadgeRailStyle}>
            {["Roles", "Phases", "History"].map((item) => (
              <div key={item} style={heroBadgeStyle}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={cardGridStyle}>
        {strengths.map((player) => (
          <article key={player.name} style={featureCardStyle(player.accent)}>
            <div style={featureHeaderStyle}>
              <PlayerPhoto player={player} />
              <div>
                <div style={featureTagStyle}>{player.tag}</div>
                <div style={featureNameStyle}>{player.name}</div>
                <div style={featureRoleStyle}>{player.role}</div>
              </div>
            </div>

            <div style={featureMetricStyle}>
              Strike Rate <strong style={{ color: "var(--text-primary)" }}>{player.strikeRate}</strong>
            </div>
            <p style={featureCopyStyle}>{player.matchup}</p>

            <div style={meterStackStyle}>
              <SignalMeter label="Form" value={player.form} accent={player.accent} />
              <SignalMeter label="Control" value={player.control} accent={player.accent} />
            </div>
          </article>
        ))}
      </section>

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <div style={eyebrowStyle}>Phase Pressure</div>
          <div style={phaseListStyle}>
            {phaseRows.map((row) => (
              <div key={row.phase} style={phaseRowStyle}>
                <div>
                  <div style={phaseTitleStyle}>{row.phase}</div>
                  <div style={phaseMetaStyle}>RR {row.runRate} | wickets {row.wickets}</div>
                </div>
                <div style={phaseMeterStyle}>
                  <span style={{ ...phaseMeterFillStyle, width: `${row.pressure}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={eyebrowStyle}>Notes</div>
          <div style={signalListStyle}>
            {signals.map((signal, index) => (
              <div key={signal} style={signalCardStyle}>
                <div style={signalIndexStyle}>{`0${index + 1}`}</div>
                <div style={signalBodyStyle}>{signal}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "16px"
};

const panelStyle = {
  padding: "18px",
  borderRadius: "8px",
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  boxShadow: "var(--shadow-panel)"
};

const heroCardStyle = {
  ...panelStyle,
  background: "var(--surface-hero)"
};

const heroGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(220px, 0.8fr)",
  gap: "16px",
  alignItems: "center"
};

const heroTitleStyle = {
  margin: "8px 0 10px",
  color: "var(--text-primary)",
  fontSize: "clamp(30px, 4vw, 48px)",
  lineHeight: 1
};

const heroBadgeRailStyle = {
  display: "grid",
  gap: "10px"
};

const heroBadgeStyle = {
  padding: "12px 14px",
  borderRadius: "8px",
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-muted)",
  color: "var(--text-tertiary)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontSize: "12px",
  fontWeight: 800
};

const eyebrowStyle = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--eyebrow-text)",
  fontWeight: 800
};

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px"
};

const featureCardStyle = (accent) => ({
  padding: "16px",
  borderRadius: "8px",
  border: "1px solid var(--border-soft)",
  background: `linear-gradient(135deg, ${accent}24, transparent 52%), var(--surface-panel)`,
  boxShadow: "var(--shadow-panel)"
});

const featureHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "76px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center"
};

const portraitStyle = {
  width: "76px",
  height: "86px",
  borderRadius: "8px",
  border: "1px solid var(--border-soft)",
  objectFit: "cover"
};

const portraitFallbackStyle = {
  ...portraitStyle,
  display: "grid",
  placeItems: "center",
  background: "var(--accent, #37b7ff)",
  color: "#06111f",
  fontWeight: 900
};

const featureTagStyle = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: "6px",
  background: "var(--surface-strong)",
  color: "var(--status-attention)",
  fontSize: "12px",
  fontWeight: 800
};

const featureNameStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "24px",
  fontWeight: 800,
  lineHeight: 1.05
};

const featureRoleStyle = {
  marginTop: "6px",
  color: "var(--eyebrow-text)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontSize: "12px"
};

const featureMetricStyle = {
  marginTop: "16px",
  color: "var(--text-tertiary)"
};

const featureCopyStyle = {
  margin: "10px 0 0",
  color: "var(--text-secondary)",
  lineHeight: 1.55
};

const meterStackStyle = {
  display: "grid",
  gap: "10px",
  marginTop: "14px"
};

const meterStyle = {
  display: "grid",
  gap: "6px"
};

const meterTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  color: "var(--text-soft)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em"
};

const meterTrackStyle = {
  height: "8px",
  borderRadius: "6px",
  background: "var(--surface-muted)",
  overflow: "hidden"
};

const meterFillStyle = {
  display: "block",
  height: "100%",
  borderRadius: "6px"
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "12px"
};

const phaseListStyle = {
  display: "grid",
  gap: "10px",
  marginTop: "14px"
};

const phaseRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.8fr) minmax(120px, 1fr)",
  gap: "12px",
  alignItems: "center",
  padding: "12px",
  borderRadius: "8px",
  background: "var(--surface-muted)",
  border: "1px solid var(--border-muted)"
};

const phaseTitleStyle = {
  color: "var(--text-primary)",
  fontWeight: 800
};

const phaseMetaStyle = {
  marginTop: "4px",
  color: "var(--text-soft)",
  fontSize: "13px"
};

const phaseMeterStyle = {
  height: "12px",
  borderRadius: "6px",
  background: "var(--surface-elevated)",
  overflow: "hidden"
};

const phaseMeterFillStyle = {
  display: "block",
  height: "100%",
  borderRadius: "6px",
  background: "linear-gradient(90deg, var(--accent-sky), var(--accent-amber))"
};

const signalListStyle = {
  display: "grid",
  gap: "10px",
  marginTop: "14px"
};

const signalCardStyle = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: "12px",
  alignItems: "start",
  padding: "12px",
  borderRadius: "8px",
  background: "var(--surface-muted)",
  border: "1px solid var(--border-muted)"
};

const signalIndexStyle = {
  display: "grid",
  placeItems: "center",
  height: "40px",
  borderRadius: "6px",
  background: "rgba(55, 183, 255, 0.16)",
  color: "var(--eyebrow-text)",
  fontWeight: 800
};

const signalBodyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6
};

export default Analytics;
