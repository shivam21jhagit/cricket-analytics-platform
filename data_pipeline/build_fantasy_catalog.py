from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "cricsheet"
PROCESSED_CSV = ROOT / "data" / "processed" / "cleaned_cricsheet.csv"
OUTPUT_PATH = ROOT / "frontend" / "src" / "data" / "fantasyCatalog.json"


def infer_role(batting_count: int, bowling_count: int) -> str:
    if batting_count > 0 and bowling_count > 0:
        return "all-rounder"
    if bowling_count > 0:
        return "bowler"
    if batting_count > 0:
        return "batter"
    return "utility"


def load_player_activity() -> dict[str, dict[str, int | str]]:
    stats: dict[str, dict[str, int | str]] = defaultdict(
        lambda: {"battingCount": 0, "bowlingCount": 0, "role": "utility"}
    )

    with PROCESSED_CSV.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            batter = (row.get("batter") or "").strip()
            bowler = (row.get("bowler") or "").strip()

            if batter:
                stats[batter]["battingCount"] += 1
            if bowler:
                stats[bowler]["bowlingCount"] += 1

    for name, values in stats.items():
        values["role"] = infer_role(
            int(values["battingCount"]),
            int(values["bowlingCount"]),
        )

    return stats


def build_catalog() -> dict:
    player_activity = load_player_activity()
    team_players: dict[str, Counter] = defaultdict(Counter)
    team_types: dict[str, Counter] = defaultdict(Counter)
    venue_meta: dict[str, dict] = defaultdict(
        lambda: {
            "city": "",
            "matches": 0,
            "teamTypes": Counter(),
            "teams": set(),
        }
    )

    total_matches = 0

    for match_path in RAW_DIR.glob("*.json"):
        with match_path.open(encoding="utf-8") as handle:
            data = json.load(handle)

        info = data.get("info", {})
        venue = (info.get("venue") or "").strip()
        city = (info.get("city") or "").strip()
        team_type = (info.get("team_type") or "unknown").strip()
        teams = info.get("teams") or []
        players = info.get("players") or {}

        if venue:
            meta = venue_meta[venue]
            meta["city"] = meta["city"] or city
            meta["matches"] += 1
            meta["teamTypes"][team_type] += 1
            meta["teams"].update(teams)

        for team_name, squad in players.items():
            team_types[team_name][team_type] += 1
            for player in squad:
                team_players[team_name][player] += 1

        total_matches += 1

    teams_payload = []
    all_players = set(player_activity)

    for team_name in sorted(team_players):
        players_payload = []
        for player_name, appearances in team_players[team_name].most_common():
            activity = player_activity.get(
                player_name,
                {"battingCount": 0, "bowlingCount": 0, "role": "utility"},
            )
            players_payload.append(
                {
                    "name": player_name,
                    "appearances": appearances,
                    "battingCount": activity["battingCount"],
                    "bowlingCount": activity["bowlingCount"],
                    "role": activity["role"],
                }
            )
            all_players.add(player_name)

        teams_payload.append(
            {
                "name": team_name,
                "teamType": team_types[team_name].most_common(1)[0][0],
                "playerCount": len(players_payload),
                "players": players_payload,
            }
        )

    venues_payload = []
    for venue_name in sorted(venue_meta):
        meta = venue_meta[venue_name]
        venues_payload.append(
            {
                "name": venue_name,
                "city": meta["city"],
                "matches": meta["matches"],
                "teamTypes": [item[0] for item in meta["teamTypes"].most_common()],
                "teams": sorted(meta["teams"]),
            }
        )

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "matches": total_matches,
            "teams": len(teams_payload),
            "venues": len(venues_payload),
            "players": len(all_players),
        },
        "teams": teams_payload,
        "venues": venues_payload,
    }


def main() -> None:
    catalog = build_catalog()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(catalog, handle, ensure_ascii=True)

    print(f"Wrote catalog to {OUTPUT_PATH}")
    print(json.dumps(catalog["summary"], ensure_ascii=True))


if __name__ == "__main__":
    main()
