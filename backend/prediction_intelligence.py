from collections import defaultdict
from functools import lru_cache
from pathlib import Path
import pickle

import pandas as pd


DATA_CSV = (
    Path(__file__).resolve().parents[1] / "data" / "processed" / "cricsheet_data.csv"
)
CACHE_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "processed"
    / "prediction_profile_cache.pkl"
)
RUN_BUCKETS = [0, 1, 2, 3, 4, 6]
PHASE_KEYS = ("powerplay", "middle", "death")
MAX_ANALYSIS_OVER = 20


def bucket_runs(runs):
    if runs >= 6:
        return 6

    if runs == 5:
        return 4

    return runs


def phase_key(over):
    if over <= 5:
        return "powerplay"

    if over <= 14:
        return "middle"

    return "death"


def empty_summary():
    return {
        "runs": 0,
        "balls": 0,
        "dots": 0,
        "fours": 0,
        "sixes": 0,
        "bucket_counts": {bucket: 0 for bucket in RUN_BUCKETS},
        "phases": {
            key: {"runs": 0, "balls": 0}
            for key in PHASE_KEYS
        },
    }


def update_summary(summary, runs, over):
    runs = int(runs)
    bucket = bucket_runs(runs)
    phase = phase_key(int(over))

    summary["runs"] += runs
    summary["balls"] += 1
    summary["dots"] += int(runs == 0)
    summary["fours"] += int(runs == 4)
    summary["sixes"] += int(runs >= 6)
    summary["bucket_counts"][bucket] += 1
    summary["phases"][phase]["runs"] += runs
    summary["phases"][phase]["balls"] += 1


def safe_rate(numerator, denominator):
    if not denominator:
        return 0.0

    return float(numerator) / float(denominator)


def finalize_summary(summary, mode):
    balls = summary["balls"]
    runs = summary["runs"]
    bucket_probabilities = [
        safe_rate(summary["bucket_counts"][bucket], balls)
        for bucket in RUN_BUCKETS
    ]

    phase_cards = []
    for key, label in (
        ("powerplay", "Powerplay"),
        ("middle", "Middle Overs"),
        ("death", "Death Overs"),
    ):
        phase_stats = summary["phases"][key]
        phase_balls = phase_stats["balls"]
        phase_runs = phase_stats["runs"]
        phase_cards.append(
            {
                "key": key,
                "label": label,
                "balls": phase_balls,
                "runs": phase_runs,
                "strike_rate": round(safe_rate(phase_runs * 100, phase_balls), 1),
                "economy": round(safe_rate(phase_runs * 6, phase_balls), 2),
            }
        )

    summary["strike_rate"] = round(safe_rate(runs * 100, balls), 1)
    summary["economy"] = round(safe_rate(runs * 6, balls), 2)
    summary["dot_rate"] = round(safe_rate(summary["dots"], balls), 4)
    summary["boundary_rate"] = round(
        safe_rate(summary["fours"] + summary["sixes"], balls), 4
    )
    summary["scoring_shot_rate"] = round(1 - safe_rate(summary["dots"], balls), 4)
    summary["avg_runs_per_ball"] = round(safe_rate(runs, balls), 3)
    summary["bucket_probabilities"] = bucket_probabilities
    summary["bucket_distribution"] = [
        {
            "run": str(bucket),
            "balls": int(summary["bucket_counts"][bucket]),
            "share": round(bucket_probabilities[index] * 100, 2),
        }
        for index, bucket in enumerate(RUN_BUCKETS)
    ]
    summary["phase_cards"] = phase_cards
    summary["role"] = mode
    return summary


def build_profile_cache():
    batter_profiles = defaultdict(empty_summary)
    bowler_profiles = defaultdict(empty_summary)

    for chunk in pd.read_csv(
        DATA_CSV,
        usecols=["batter", "bowler", "runs", "over"],
        chunksize=300000,
    ):
        chunk = chunk[chunk["over"] < MAX_ANALYSIS_OVER]

        for row in chunk.itertuples(index=False):
            update_summary(batter_profiles[row.batter], row.runs, row.over)
            update_summary(bowler_profiles[row.bowler], row.runs, row.over)

    serialized = {
        "batters": {
            name: finalize_summary(dict(profile), "batter")
            for name, profile in batter_profiles.items()
        },
        "bowlers": {
            name: finalize_summary(dict(profile), "bowler")
            for name, profile in bowler_profiles.items()
        },
        "source_mtime": DATA_CSV.stat().st_mtime,
        "version": 2,
    }

    with CACHE_PATH.open("wb") as cache_file:
        pickle.dump(serialized, cache_file)

    return serialized


@lru_cache(maxsize=1)
def get_profile_cache():
    if CACHE_PATH.exists():
        with CACHE_PATH.open("rb") as cache_file:
            cache = pickle.load(cache_file)

        if (
            cache.get("version") == 2
            and cache.get("source_mtime", 0) >= DATA_CSV.stat().st_mtime
        ):
            return cache

    return build_profile_cache()


def get_batter_profile(name):
    return get_profile_cache()["batters"].get(name)


def get_bowler_profile(name):
    return get_profile_cache()["bowlers"].get(name)


def empty_profile(name, role):
    return {"name": name, **finalize_summary(empty_summary(), role)}


def canonical_context(team1, team2):
    teams = sorted([str(team1), str(team2)])
    return " vs ".join(teams)


@lru_cache(maxsize=256)
def get_pair_history(batter, bowler):
    summary = empty_summary()
    over_stats = defaultdict(empty_summary)
    contexts = defaultdict(empty_summary)

    for chunk in pd.read_csv(
        DATA_CSV,
        usecols=["team1", "team2", "batter", "bowler", "runs", "over"],
        chunksize=300000,
    ):
        filtered = chunk[chunk["over"] < MAX_ANALYSIS_OVER]
        filtered = filtered[(filtered["batter"] == batter) & (filtered["bowler"] == bowler)]

        if filtered.empty:
            continue

        for row in filtered.itertuples(index=False):
            display_over = int(row.over) + 1
            context_key = canonical_context(row.team1, row.team2)

            update_summary(summary, row.runs, row.over)
            update_summary(over_stats[display_over], row.runs, row.over)
            update_summary(contexts[context_key], row.runs, row.over)

    finalized = finalize_summary(summary, "pair")
    finalized["history_available"] = finalized["balls"] > 0
    finalized["by_over"] = [
        {
            "over": over,
            "balls": stats["balls"],
            "runs": stats["runs"],
            "strike_rate": round(safe_rate(stats["runs"] * 100, stats["balls"]), 1),
        }
        for over, stats in sorted(
            (
                (over, finalize_summary(dict(stats), "pair_over"))
                for over, stats in over_stats.items()
            ),
            key=lambda item: item[0],
        )
    ]
    finalized["over_probabilities"] = {
        str(over): stats["bucket_probabilities"]
        for over, stats in (
            (over, finalize_summary(dict(stats), "pair_over"))
            for over, stats in over_stats.items()
        )
    }
    finalized["contexts"] = [
        {
            "label": label,
            "balls": stats["balls"],
            "runs": stats["runs"],
            "strike_rate": round(safe_rate(stats["runs"] * 100, stats["balls"]), 1),
            "dot_rate": round(safe_rate(stats["dots"], stats["balls"]) * 100, 1),
        }
        for label, stats in sorted(
            (
                (label, finalize_summary(dict(stats), "pair_context"))
                for label, stats in contexts.items()
            ),
            key=lambda item: (-item[1]["balls"], item[0]),
        )
    ]
    finalized["archive_note"] = (
        "This archive covers every recorded ball for the matchup in the local "
        "processed dataset. Match dates are not preserved there, so the history "
        "is grouped by teams and over."
    )
    return finalized
