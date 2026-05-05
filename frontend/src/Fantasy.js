import { useEffect, useMemo, useState } from "react";

const pitches = {
  flat: {
    name: "Flat Batting Track",
    summary: "Maximizes boundary volume and rewards aggressive batting depth.",
    captaincy: "Prioritize top-order anchors and power hitters."
  },
  green: {
    name: "Green Seamer",
    summary: "Movement with the new ball lifts wicket equity for seam-heavy attacks.",
    captaincy: "Back strike bowlers and batting all-rounders."
  },
  dry: {
    name: "Dry Turning Pitch",
    summary: "Grip and two-paced bounce pull the game toward spin and control batters.",
    captaincy: "Lean into bowling all-rounders and spin support."
  },
  used: {
    name: "Used Surface",
    summary: "Shot-making gets tougher late, so versatility matters more than pure ceiling.",
    captaincy: "Favor balanced all-rounders and death-over bowlers."
  }
};

const preferredVenueNames = [
  "Wankhede Stadium",
  "Lord's",
  "Melbourne Cricket Ground",
  "Eden Gardens",
  "Dubai International Cricket Stadium"
];

function buildVenueKey(venue) {
  return `${venue.name}__${venue.city || "unknown"}`;
}

function sortByName(items) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function pickPreferredVenue(venues) {
  return (
    venues.find((venue) =>
      preferredVenueNames.some((preferred) => venue.name.includes(preferred))
    ) || sortByName(venues)[0]
  );
}

function formatVenueLabel(venue) {
  return venue.city ? `${venue.name} (${venue.city})` : venue.name;
}

function deriveArchetype(player) {
  const batting = Number(player.battingCount || 0);
  const bowling = Number(player.bowlingCount || 0);

  if (player.role === "utility") {
    return "Utility cover";
  }

  if (player.role === "bowler" || (bowling > batting * 2 && bowling > 0)) {
    return bowling >= 450 ? "Strike bowler" : "Bowling option";
  }

  if (player.role === "batter" || (batting > bowling * 2 && batting > 0)) {
    return batting >= 450 ? "Premium batter" : "Top-order batter";
  }

  if (batting >= bowling * 1.2) {
    return "Batting all-rounder";
  }

  if (bowling >= batting * 1.2) {
    return "Bowling all-rounder";
  }

  return "Balanced all-rounder";
}

function getPitchBoost(player, pitch) {
  const batting = Number(player.battingCount || 0);
  const bowling = Number(player.bowlingCount || 0);
  const archetype = deriveArchetype(player);

  if (pitch === "flat") {
    if (batting >= bowling) {
      return {
        points: 16,
        reason: "Batting volume gets a major lift on flat decks."
      };
    }

    return {
      points: 8,
      reason: "Even on batting decks, wicket-takers stay relevant at the death."
    };
  }

  if (pitch === "green") {
    if (bowling > batting) {
      return {
        points: 18,
        reason: "Seam help boosts strike-bowling upside early."
      };
    }

    return {
      points: 10,
      reason: "Batting all-rounders retain value when conditions stay live."
    };
  }

  if (pitch === "dry") {
    if (archetype.includes("Bowling") || archetype.includes("Balanced")) {
      return {
        points: 17,
        reason: "Dry surfaces reward control and multi-skill players."
      };
    }

    return {
      points: 9,
      reason: "Reliable batters still matter when scoring compresses."
    };
  }

  if (player.role === "all-rounder" || archetype.includes("all-rounder")) {
    return {
      points: 18,
      reason: "Used wickets favor players who can score in two disciplines."
    };
  }

  if (bowling > batting) {
    return {
      points: 13,
      reason: "Late-innings grip improves bowling control."
    };
  }

  return {
    points: 11,
    reason: "Experienced batters still hold value on worn surfaces."
  };
}

function normalizeRoleBucket(player) {
  if (player.role === "bowler") {
    return "Bowlers";
  }

  if (player.role === "batter") {
    return "Batters";
  }

  if (player.role === "utility") {
    return "Utility";
  }

  return "All-rounders";
}

function scorePlayersForTeam(team, pitch) {
  if (!team) {
    return [];
  }

  const maxAppearances = Math.max(
    1,
    ...team.players.map((player) => Number(player.appearances || 0))
  );
  const maxInvolvement = Math.max(
    1,
    ...team.players.map((player) =>
      Number(player.battingCount || 0) + Number(player.bowlingCount || 0)
    )
  );

  return [...team.players]
    .map((player) => {
      const batting = Number(player.battingCount || 0);
      const bowling = Number(player.bowlingCount || 0);
      const involvement = batting + bowling;
      const archetype = deriveArchetype(player);
      const pitchBoost = getPitchBoost(player, pitch);
      const experienceScore = (Number(player.appearances || 0) / maxAppearances) * 44;
      const involvementScore = (involvement / maxInvolvement) * 34;
      const roleBonus =
        player.role === "all-rounder"
          ? 10
          : player.role === "utility"
            ? 4
            : 8;
      const score = Math.round(
        experienceScore + involvementScore + pitchBoost.points + roleBonus
      );

      return {
        ...player,
        batting,
        bowling,
        involvement,
        archetype,
        score,
        pitchReason: pitchBoost.reason,
        roleBucket: normalizeRoleBucket(player)
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.appearances !== left.appearances) {
        return right.appearances - left.appearances;
      }

      return right.involvement - left.involvement;
    });
}

function Fantasy() {
  const [catalog, setCatalog] = useState({ summary: null, venues: [], teams: [] });
  const [catalogError, setCatalogError] = useState("");
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [groundKey, setGroundKey] = useState("");
  const [teamName, setTeamName] = useState("");
  const [pitch, setPitch] = useState("flat");

  useEffect(() => {
    let isActive = true;

    async function loadCatalog() {
      try {
        const module = await import("./data/fantasyCatalog.json");
        const data = module.default || module;

        if (!isActive) {
          return;
        }

        setCatalog({
          summary: data.summary || null,
          venues: Array.isArray(data.venues) ? data.venues : [],
          teams: Array.isArray(data.teams) ? data.teams : []
        });
      } catch (error) {
        if (isActive) {
          setCatalogError("Global fantasy catalog could not be loaded.");
        }
      } finally {
        if (isActive) {
          setIsLoadingCatalog(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isActive = false;
    };
  }, []);

  const venues = useMemo(() => sortByName(catalog.venues), [catalog.venues]);

  const teamMap = useMemo(() => {
    return new Map(catalog.teams.map((team) => [team.name, team]));
  }, [catalog.teams]);

  useEffect(() => {
    if (!venues.length) {
      return;
    }

    const hasSelectedVenue = venues.some((venue) => buildVenueKey(venue) === groundKey);

    if (!hasSelectedVenue) {
      setGroundKey(buildVenueKey(pickPreferredVenue(venues)));
    }
  }, [groundKey, venues]);

  const selectedGround = useMemo(() => {
    return venues.find((venue) => buildVenueKey(venue) === groundKey) || venues[0] || null;
  }, [groundKey, venues]);

  const availableTeams = useMemo(() => {
    if (!selectedGround) {
      return sortByName(catalog.teams);
    }

    const uniqueNames = [...new Set(selectedGround.teams || [])];
    const resolvedTeams = uniqueNames
      .map((name) => teamMap.get(name))
      .filter(Boolean);

    return resolvedTeams.length > 0 ? sortByName(resolvedTeams) : sortByName(catalog.teams);
  }, [catalog.teams, selectedGround, teamMap]);

  useEffect(() => {
    if (!availableTeams.length) {
      return;
    }

    const hasSelectedTeam = availableTeams.some((team) => team.name === teamName);

    if (!hasSelectedTeam) {
      setTeamName(availableTeams[0].name);
    }
  }, [availableTeams, teamName]);

  const selectedTeam = useMemo(() => {
    return availableTeams.find((team) => team.name === teamName) || availableTeams[0] || null;
  }, [availableTeams, teamName]);

  const rankedPlayers = useMemo(() => {
    return scorePlayersForTeam(selectedTeam, pitch);
  }, [pitch, selectedTeam]);

  const squad = rankedPlayers.slice(0, 15);
  const startingXi = squad.slice(0, 11);
  const bench = squad.slice(11, 15);
  const captain = squad[0] || null;
  const viceCaptain = squad[1] || null;
  const selectedPitch = pitches[pitch];

  const roleMix = useMemo(() => {
    return squad.reduce(
      (summary, player) => {
        summary[player.roleBucket] = (summary[player.roleBucket] || 0) + 1;
        return summary;
      },
      { Batters: 0, "All-rounders": 0, Bowlers: 0, Utility: 0 }
    );
  }, [squad]);

  const squadSizeNote =
    selectedTeam && selectedTeam.playerCount < 15
      ? `Showing ${selectedTeam.playerCount} players`
      : "Top 15 shown";

  return (
    <div className="workspace-module fantasy-module" style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroGridStyle}>
          <div>
            <div style={eyebrowStyle}>Fantasy</div>
            <h2 style={heroTitleStyle}>Team Builder</h2>
          </div>

          <div style={heroBadgeRailStyle}>
            <div style={heroBadgeStyle}>877 global grounds</div>
            <div style={heroBadgeStyle}>383 teams</div>
            <div style={heroBadgeStyle}>15-player squad</div>
          </div>
        </div>
      </section>

      <section style={filterCardStyle}>
        <div style={filterGridStyle}>
          <div>
            <label style={labelStyle}>Ground</label>
            <select
              value={groundKey}
              onChange={(event) => setGroundKey(event.target.value)}
              style={selectStyle}
              disabled={isLoadingCatalog || venues.length === 0}
            >
              {venues.map((venue) => (
                <option key={buildVenueKey(venue)} value={buildVenueKey(venue)}>
                  {formatVenueLabel(venue)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Team</label>
            <select
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              style={selectStyle}
              disabled={isLoadingCatalog || availableTeams.length === 0}
            >
              {availableTeams.map((team) => (
                <option key={team.name} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Pitch Type</label>
            <select value={pitch} onChange={(event) => setPitch(event.target.value)} style={selectStyle}>
              {Object.entries(pitches).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {catalogError && <section style={errorCardStyle}>{catalogError}</section>}

      {isLoadingCatalog ? (
        <section style={panelStyle}>
          <div style={eyebrowStyle}>Loading</div>
          <h3 style={sectionTitleStyle}>Loading teams and venues</h3>
        </section>
      ) : (
        <>
          <section style={insightGridStyle}>
            <article style={insightCardStyle("rgba(31, 143, 255, 0.18)")}>
              <div style={insightLabelStyle}>Ground</div>
              <div style={insightTitleStyle}>
                {selectedGround ? formatVenueLabel(selectedGround) : "No venue selected"}
              </div>
              <p style={insightCopyStyle}>
                {selectedGround
                  ? `${selectedGround.matches} matches | ${selectedGround.teams.length} teams`
                  : "Choose a venue"}
              </p>
              {selectedGround && (
                <div style={insightAccentStyle}>
                  Team types: {selectedGround.teamTypes.join(", ")}
                </div>
              )}
            </article>

            <article style={insightCardStyle("rgba(255, 166, 61, 0.18)")}>
              <div style={insightLabelStyle}>Team</div>
              <div style={insightTitleStyle}>
                {selectedTeam ? selectedTeam.name : "No team selected"}
              </div>
              <p style={insightCopyStyle}>
                {selectedTeam
                  ? `${selectedTeam.playerCount} players available`
                  : "Select a team"}
              </p>
              {selectedTeam && (
                <div style={insightAccentStyle}>
                  Competition type: {selectedTeam.teamType}
                </div>
              )}
            </article>

            <article style={panelStyle}>
              <div style={insightLabelStyle}>Pitch</div>
              <div style={insightTitleStyle}>{selectedPitch.name}</div>
              <p style={insightCopyStyle}>{selectedPitch.summary}</p>
            </article>

            <article style={panelStyle}>
              <div style={insightLabelStyle}>Catalog</div>
              <div style={insightTitleStyle}>{catalog.summary?.venues || venues.length} grounds</div>
              <p style={insightCopyStyle}>
                {catalog.summary?.teams || catalog.teams.length} teams |{" "}
                {catalog.summary?.players || 0} players
              </p>
            </article>
          </section>

          <section style={panelStyle}>
            <div style={eyebrowStyle}>15-Player Squad</div>
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={miniLabelStyle}>Captain</div>
                <div style={summaryValueStyle}>{captain ? captain.name : "-"}</div>
                <div style={summaryMetaStyle}>{captain ? captain.archetype : "Waiting for team"}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={miniLabelStyle}>Vice-Captain</div>
                <div style={summaryValueStyle}>{viceCaptain ? viceCaptain.name : "-"}</div>
                <div style={summaryMetaStyle}>
                  {viceCaptain ? viceCaptain.archetype : "Waiting for team"}
                </div>
              </div>

              <div style={summaryCardStyle}>
                <div style={miniLabelStyle}>Role Mix</div>
                <div style={summaryValueStyle}>
                  {roleMix.Batters}/{roleMix["All-rounders"]}/{roleMix.Bowlers}
                </div>
                <div style={summaryMetaStyle}>Batters / all-rounders / bowlers</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={miniLabelStyle}>Selection Note</div>
                <div style={summaryCopyStyle}>{squadSizeNote}</div>
              </div>
            </div>
          </section>

          <section style={panelStyle}>
            <div style={eyebrowStyle}>Starting XI</div>
            <div style={recommendationListStyle}>
              {startingXi.map((player, index) => (
                <article key={player.name} style={recommendationCardStyle(index)}>
                  <div style={recommendationHeaderStyle}>
                    <div>
                      <div style={recommendationRankStyle}>{`0${index + 1}`}</div>
                      <div style={recommendationNameStyle}>{player.name}</div>
                    </div>
                    <div style={recommendationTagRailStyle}>
                      <span style={tagPillStyle}>{player.archetype}</span>
                      <span style={tagPillStyle}>{player.roleBucket}</span>
                    </div>
                  </div>

                  <div style={playerMetricGridStyle}>
                    <div style={playerMetricStyle}>
                      <span style={miniLabelStyle}>Appearances</span>
                      <strong style={playerMetricValueStyle}>{player.appearances}</strong>
                    </div>
                    <div style={playerMetricStyle}>
                      <span style={miniLabelStyle}>Batting Count</span>
                      <strong style={playerMetricValueStyle}>{player.batting}</strong>
                    </div>
                    <div style={playerMetricStyle}>
                      <span style={miniLabelStyle}>Bowling Count</span>
                      <strong style={playerMetricValueStyle}>{player.bowling}</strong>
                    </div>
                    <div style={playerMetricStyle}>
                      <span style={miniLabelStyle}>Fit Score</span>
                      <strong style={playerMetricValueStyle}>{player.score}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            <div style={eyebrowStyle}>Bench</div>
            <div style={benchGridStyle}>
              {bench.map((player, index) => (
                <article key={player.name} style={benchCardStyle}>
                  <div style={benchIndexStyle}>{`B${index + 1}`}</div>
                  <div style={benchNameStyle}>{player.name}</div>
                  <div style={benchRoleStyle}>{player.archetype}</div>
                  <div style={benchMetaStyle}>Appearances: {player.appearances}</div>
                  <div style={benchMetaStyle}>Fit Score: {player.score}</div>
                </article>
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
  gap: "20px"
};

const panelStyle = {
  padding: "22px",
  borderRadius: "24px",
  background: "var(--surface-panel)",
  border: "1px solid var(--border-soft)",
  boxShadow: "var(--shadow-panel)"
};

const heroCardStyle = {
  ...panelStyle,
  background: "var(--surface-hero)"
};

const errorCardStyle = {
  ...panelStyle,
  color: "var(--message-error-text)",
  background: "var(--message-error-bg)"
};

const heroGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(220px, 0.9fr)",
  gap: "18px",
  alignItems: "center"
};

const heroTitleStyle = {
  margin: "10px 0 8px",
  color: "var(--text-primary)",
  fontSize: "32px",
  lineHeight: 1.1
};

const sectionTitleStyle = {
  margin: "10px 0 8px",
  color: "var(--text-primary)",
  fontSize: "24px"
};

const heroBadgeRailStyle = {
  display: "grid",
  gap: "10px"
};

const heroBadgeStyle = {
  padding: "14px 16px",
  borderRadius: "18px",
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-muted)",
  color: "var(--text-tertiary)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontSize: "12px"
};

const filterCardStyle = {
  ...panelStyle,
  padding: "18px 22px"
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px"
};

const insightGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px"
};

const insightCardStyle = (accent) => ({
  ...panelStyle,
  boxShadow: `inset 0 1px 0 ${accent}, var(--shadow-panel)`
});

const eyebrowStyle = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--eyebrow-text)"
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "var(--text-secondary)",
  fontSize: "13px",
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const selectStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "16px",
  border: "1px solid var(--border-muted)",
  outline: "none",
  background: "var(--field-bg)",
  color: "var(--text-primary)",
  boxSizing: "border-box"
};

const insightLabelStyle = {
  color: "var(--text-soft)",
  fontSize: "12px",
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const insightTitleStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: 1.2
};

const insightCopyStyle = {
  margin: "12px 0 0",
  color: "var(--text-secondary)",
  lineHeight: 1.6
};

const insightAccentStyle = {
  marginTop: "12px",
  color: "var(--status-success)",
  fontWeight: 600
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  marginTop: "16px"
};

const summaryCardStyle = {
  padding: "18px",
  borderRadius: "20px",
  background: "var(--surface-muted)",
  border: "1px solid var(--border-muted)"
};

const miniLabelStyle = {
  color: "var(--text-soft)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.1em"
};

const summaryValueStyle = {
  marginTop: "10px",
  color: "var(--text-primary)",
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: 1.2
};

const summaryMetaStyle = {
  marginTop: "8px",
  color: "var(--text-tertiary)",
  lineHeight: 1.5
};

const summaryCopyStyle = {
  marginTop: "10px",
  color: "var(--text-secondary)",
  lineHeight: 1.6
};

const recommendationListStyle = {
  display: "grid",
  gap: "14px",
  marginTop: "16px"
};

const recommendationCardStyle = (index) => ({
  padding: "18px",
  borderRadius: "22px",
  background:
    index < 2
      ? "var(--card-highlight-primary)"
      : "var(--surface-muted)",
  border: "1px solid var(--border-muted)"
});

const recommendationHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  alignItems: "center"
};

const recommendationRankStyle = {
  display: "inline-grid",
  placeItems: "center",
  minWidth: "42px",
  height: "42px",
  marginBottom: "12px",
  borderRadius: "14px",
  background: "var(--surface-strong)",
  color: "var(--status-attention)",
  fontWeight: 700
};

const recommendationNameStyle = {
  color: "var(--text-primary)",
  fontSize: "22px",
  fontWeight: 700
};

const recommendationTagRailStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
};

const tagPillStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  background: "var(--surface-strong)",
  color: "var(--text-tertiary)",
  fontSize: "12px"
};

const playerMetricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "10px",
  marginTop: "16px"
};

const playerMetricStyle = {
  padding: "12px",
  borderRadius: "16px",
  background: "var(--surface-muted)"
};

const playerMetricValueStyle = {
  display: "block",
  marginTop: "8px",
  color: "var(--text-primary)",
  fontSize: "22px"
};

const benchGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  marginTop: "16px"
};

const benchCardStyle = {
  padding: "16px",
  borderRadius: "18px",
  background: "var(--surface-muted)",
  border: "1px solid var(--border-muted)"
};

const benchIndexStyle = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "var(--surface-strong)",
  color: "var(--status-warm)",
  fontSize: "12px",
  fontWeight: 700
};

const benchNameStyle = {
  marginTop: "12px",
  color: "var(--text-primary)",
  fontSize: "20px",
  fontWeight: 700
};

const benchRoleStyle = {
  marginTop: "8px",
  color: "var(--eyebrow-text)"
};

const benchMetaStyle = {
  marginTop: "8px",
  color: "var(--text-secondary)"
};

export default Fantasy;
