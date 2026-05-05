from pathlib import Path
from datetime import datetime, timezone
import os
import pickle
import random
import re
import urllib.error
import urllib.parse
import urllib.request
from math import erf, sqrt
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
try:
    from prediction_intelligence import (
        RUN_BUCKETS,
        empty_profile,
        get_batter_profile,
        get_bowler_profile,
        get_pair_history,
    )
except ModuleNotFoundError:
    from backend.prediction_intelligence import (
        RUN_BUCKETS,
        empty_profile,
        get_batter_profile,
        get_bowler_profile,
        get_pair_history,
    )


app = FastAPI(
    title="CricketAI Platform API",
    version="1.0.0",
    description=(
        "Local CricketAI service for live match intelligence, player prediction, "
        "fantasy recommendations, and platform readiness data."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cricket-analytics-platform-2vul.vercel.app",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ML_DIR = Path(__file__).resolve().parents[1] / "ml"

with open(ML_DIR / "ball_model.pkl", "rb") as model_file:
    model = pickle.load(model_file)

with open(ML_DIR / "batter_encoder.pkl", "rb") as batter_file:
    batter_encoder = pickle.load(batter_file)

with open(ML_DIR / "bowler_encoder.pkl", "rb") as bowler_file:
    bowler_encoder = pickle.load(bowler_file)


BatterPlayers = sorted(str(player) for player in batter_encoder.classes_)
BowlerPlayers = sorted(str(player) for player in bowler_encoder.classes_)
RUN_CLASS_TO_VALUE = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 6}
RUN_PROBABILITY_VALUES = np.array([0, 1, 2, 3, 4, 6], dtype=float)
RUN_PROBABILITY_SQUARES = np.square(RUN_PROBABILITY_VALUES)
T20_TOTAL_BALLS = 120
POWERPLAY_BALLS = 36
MIDDLE_OVERS_BALLS = 54
COMMENTARY_EVENT_PATTERNS = {
    "wicket": (
        r"\bwicket\b",
        r"\bout\b",
        r"\bcaught\b",
        r"\bbowled\b",
        r"\blbw\b",
        r"\bstumped\b",
        r"\brun out\b",
    ),
    "six": (r"\bsix\b", r"\bmaximum\b", r"\b6\b"),
    "four": (r"\bfour\b", r"\bboundary\b", r"\bdriven for four\b", r"\b4\b"),
    "dot": (r"\bdot\b", r"\bdefended\b", r"\bno run\b"),
    "single": (r"\bsingle\b", r"\b1 run\b", r"\btakes one\b"),
    "double": (r"\bdouble\b", r"\btwo runs\b", r"\b2 runs\b"),
    "extra": (r"\bwide\b", r"\bno-ball\b", r"\bleg bye\b", r"\bbye\b"),
    "review": (r"\breview\b", r"\bappeal\b", r"\bumpire\b"),
    "chance": (r"\bdropped\b", r"\bchance\b", r"\bmisfield\b", r"\bedge\b"),
}
COMMENTARY_SKILL_PATTERNS = {
    "shot": {
        "drive": (r"\bdrive\b", r"\bdriven\b"),
        "pull": (r"\bpull\b", r"\bpulled\b"),
        "cut": (r"\bcut\b", r"\bcut away\b"),
        "sweep": (r"\bsweep\b", r"\breverse sweep\b"),
        "flick": (r"\bflick\b", r"\bclipped\b"),
        "loft": (r"\bloft\b", r"\binside-out\b"),
    },
    "ball": {
        "yorker": (r"\byorker\b",),
        "bouncer": (r"\bbouncer\b", r"\bshort ball\b"),
        "slower": (r"\bslower\b", r"\boff-cutter\b", r"\bknuckle\b"),
        "swing": (r"\bswing\b", r"\bseaming\b"),
        "spin": (r"\bturn\b", r"\bspin\b"),
    },
}


CRICAPI_CURRENT_MATCHES_URL = "https://api.cricapi.com/v1/currentMatches"
PLATFORM_REFRESH_SECONDS = 120


class LiveMatchesResponse(BaseModel):
    generated_at: str
    source: str
    refresh_seconds: int = Field(PLATFORM_REFRESH_SECONDS, ge=30, le=600)
    matches: List[Dict[str, Any]]


class PlatformDashboardResponse(BaseModel):
    generated_at: str
    identity: Dict[str, Any]
    live_matches: List[Dict[str, Any]]
    intelligence_signals: List[Dict[str, Any]]
    run_rate_series: List[Dict[str, Any]]
    player_cards: List[Dict[str, Any]]
    fantasy: Dict[str, Any]
    architecture: List[Dict[str, Any]]
    roadmap: List[Dict[str, Any]]
    safeguards: List[str]


class DemoLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=160)
    role: str = Field("user", pattern="^(user|analyst|admin|bettor)$")


class DemoLoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, str]
    capabilities: List[str]


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def make_live_score_url(matchup):
    return f"https://www.google.com/search?q={urllib.parse.quote(matchup + ' live score')}"


def build_live_match(match_id, matchup, status, score, overs, phase, note, lanes, ticker):
    return {
        "id": match_id,
        "matchup": matchup,
        "status": status,
        "score": score,
        "overs": overs,
        "phase": phase,
        "note": note,
        "live_url": make_live_score_url(matchup),
        "lanes": lanes,
        "ticker": ticker,
    }


def fallback_live_matches():
    return [
        build_live_match(
            "ipl-powerplay",
            "MI vs RCB",
            "Live",
            "42/1",
            "5.1 ov",
            "Powerplay",
            "Boundary surge",
            [
                {"label": "Win Edge", "value": "58%", "caption": "MI", "level": 58},
                {"label": "Pressure", "value": "31%", "caption": "Wicket risk", "level": 31},
                {"label": "Projected", "value": "176", "caption": "First innings", "level": 78},
            ],
            ["Prediction synced", "Redis cache warm", "Fantasy pool ready"],
        ),
        build_live_match(
            "ipl-middle",
            "CSK vs RR",
            "Live",
            "97/2",
            "11.4 ov",
            "Middle Overs",
            "Spin control",
            [
                {"label": "Win Edge", "value": "64%", "caption": "CSK", "level": 64},
                {"label": "Pressure", "value": "44%", "caption": "Wicket risk", "level": 44},
                {"label": "Projected", "value": "171", "caption": "First innings", "level": 73},
            ],
            ["Phase model active", "Player cards linked", "Leaderboard queued"],
        ),
        build_live_match(
            "international-death",
            "IND vs AUS",
            "Live",
            "154/4",
            "17.2 ov",
            "Death Overs",
            "Finish loading",
            [
                {"label": "Win Edge", "value": "61%", "caption": "IND", "level": 61},
                {"label": "Pressure", "value": "63%", "caption": "Wicket risk", "level": 63},
                {"label": "Projected", "value": "184", "caption": "First innings", "level": 84},
            ],
            ["Death-over model ready", "Matchup history linked", "Top picks updated"],
        ),
    ]


def score_line_from_cricapi(score_entries):
    if not score_entries:
        return "Yet to bat", "0.0 ov"

    latest_score = score_entries[-1]
    runs = latest_score.get("r", 0)
    wickets = latest_score.get("w", 0)
    overs = latest_score.get("o", "0.0")
    return f"{runs}/{wickets}", f"{overs} ov"


def phase_from_overs(overs_text):
    try:
        over_number = float(str(overs_text).replace(" ov", ""))
    except ValueError:
        return "Pre-match"

    if over_number < 6:
        return "Powerplay"
    if over_number < 16:
        return "Middle Overs"
    return "Death Overs"


def build_lanes_from_score(score, overs_text):
    score_match = re.match(r"(?P<runs>\d+)\/(?P<wickets>\d+)", score)
    try:
        overs_float = max(0.1, float(str(overs_text).replace(" ov", "")))
    except ValueError:
        overs_float = 0.1

    runs = int(score_match.group("runs")) if score_match else 0
    wickets = int(score_match.group("wickets")) if score_match else 0
    run_rate = round(runs / overs_float, 1) if overs_float > 0 else 0
    projected = round(run_rate * 20)
    pressure = min(92, max(18, wickets * 12 + int(overs_float * 2)))

    return [
        {"label": "Run Rate", "value": str(run_rate), "caption": "Current", "level": min(96, int(run_rate * 9))},
        {"label": "Pressure", "value": f"{pressure}%", "caption": "Wicket risk", "level": pressure},
        {"label": "Projected", "value": str(projected), "caption": "T20 pace", "level": min(96, int(projected / 2.2))},
    ]


def parse_cricapi_match(raw_match):
    matchup = raw_match.get("name") or "Live cricket match"
    score, overs = score_line_from_cricapi(raw_match.get("score", []))
    phase = phase_from_overs(overs)
    status = raw_match.get("status") or "Live"
    match_id = raw_match.get("id") or compact_name(matchup) or "live-match"

    return build_live_match(
        match_id,
        matchup,
        status,
        score,
        overs,
        phase,
        "CricAPI feed",
        build_lanes_from_score(score, overs),
        ["CricAPI synced", "Prediction refresh queued", "Notification rules armed"],
    )


def fetch_cricapi_live_matches():
    api_key = os.getenv("CRICAPI_KEY")
    if not api_key:
        return None

    query = urllib.parse.urlencode({"apikey": api_key, "offset": 0})
    request = urllib.request.Request(f"{CRICAPI_CURRENT_MATCHES_URL}?{query}")

    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            payload = response.read().decode("utf-8")
    except (TimeoutError, urllib.error.URLError, urllib.error.HTTPError, OSError):
        return None

    try:
        import json

        parsed = json.loads(payload)
    except ValueError:
        return None

    matches = parsed.get("data") or []
    live_matches = [parse_cricapi_match(match) for match in matches[:6]]
    return live_matches or None


def get_platform_live_payload():
    cricapi_matches = fetch_cricapi_live_matches()
    source = "cricapi" if cricapi_matches else "demo"
    matches = cricapi_matches or fallback_live_matches()

    return {
        "generated_at": utc_now_iso(),
        "source": source,
        "refresh_seconds": PLATFORM_REFRESH_SECONDS,
        "matches": matches,
    }


def platform_intelligence_signals():
    return [
        {
            "label": "Predictive Edge",
            "value": "84%",
            "caption": "ensemble agreement",
            "delta": "+12%",
            "accent": "#00C853",
            "level": 84,
            "points": [30, 48, 42, 66, 62, 80, 84],
        },
        {
            "label": "Boundary Heat",
            "value": "71",
            "caption": "attack index",
            "delta": "+8",
            "accent": "#FF6F00",
            "level": 71,
            "points": [28, 36, 54, 50, 64, 58, 71],
        },
        {
            "label": "Wicket Risk",
            "value": "38%",
            "caption": "next over",
            "delta": "-5%",
            "accent": "#EF4444",
            "level": 38,
            "points": [56, 52, 45, 49, 40, 43, 38],
        },
        {
            "label": "Selection Fit",
            "value": "92",
            "caption": "fantasy score",
            "delta": "+15",
            "accent": "#42dfb4",
            "level": 92,
            "points": [44, 52, 61, 70, 78, 86, 92],
        },
    ]


def platform_run_rate_series():
    return [
        {"over": "1", "current": 7.0, "required": 8.1, "par": 7.6},
        {"over": "3", "current": 8.2, "required": 8.0, "par": 7.8},
        {"over": "6", "current": 8.4, "required": 7.9, "par": 8.2},
        {"over": "9", "current": 8.1, "required": 8.3, "par": 8.4},
        {"over": "12", "current": 8.7, "required": 8.8, "par": 8.6},
        {"over": "16", "current": 9.1, "required": 9.4, "par": 8.9},
        {"over": "20", "current": 9.4, "required": 9.8, "par": 9.2},
    ]


def platform_player_cards():
    return [
        {
            "name": "Virat Kohli",
            "role": "Anchor",
            "form": 88,
            "pressure_index": 91,
            "venue_fit": 84,
            "scouting_report": (
                "Elite chase controller with a rising boundary rate once spin enters. "
                "Best used as captain when the target profile rewards stability."
            ),
        },
        {
            "name": "Jasprit Bumrah",
            "role": "Death bowler",
            "form": 93,
            "pressure_index": 96,
            "venue_fit": 87,
            "scouting_report": (
                "High-leverage wicket source with yorker control late in the innings. "
                "Projection spikes when the batting side is forced above nine an over."
            ),
        },
        {
            "name": "Rashid Khan",
            "role": "Middle-over disruptor",
            "form": 86,
            "pressure_index": 89,
            "venue_fit": 92,
            "scouting_report": (
                "Suppresses pace-on scoring and creates fantasy value through dot-ball chains. "
                "Most valuable on slower surfaces with a defendable par."
            ),
        },
    ]


def platform_architecture_blocks():
    return [
        {"name": "web-app", "stack": "React now, Next.js target", "status": "active", "owner": "frontend"},
        {"name": "prediction-service", "stack": "FastAPI + local ML", "status": "active", "owner": "ai"},
        {"name": "match-service", "stack": "CricAPI adapter + live cache", "status": "scaffolded", "owner": "data"},
        {"name": "auth-service", "stack": "JWT/OAuth target", "status": "demo endpoint", "owner": "platform"},
        {"name": "notification-service", "stack": "FCM/SendGrid target", "status": "planned", "owner": "engagement"},
        {"name": "analytics-service", "stack": "FastAPI + ClickHouse target", "status": "planned", "owner": "analytics"},
    ]


def platform_roadmap():
    return [
        {"sprint": "1-2", "name": "Foundation", "status": "in progress", "items": ["Docker Compose", "Auth shell", "Live dashboard"]},
        {"sprint": "3-4", "name": "Core Product", "status": "next", "items": ["WebSocket score updates", "Player pages", "Leaderboard"]},
        {"sprint": "5-6", "name": "AI Layer", "status": "next", "items": ["XGBoost baseline", "MLflow registry", "Probability gauge"]},
        {"sprint": "7-8", "name": "Engagement", "status": "planned", "items": ["Fantasy builder", "LLM chat", "Notifications"]},
    ]


def normalize_name(name):
    return " ".join(re.findall(r"[a-z0-9]+", name.lower()))


def compact_name(name):
    return normalize_name(name).replace(" ", "")


def build_signatures(tokens):
    if not tokens:
        return set()

    signatures = {"".join(tokens)}

    if len(tokens) >= 2:
        surname = tokens[-1]
        first_initial = tokens[0][0]
        lead_initials = "".join(token[0] for token in tokens[:-1] if token)

        signatures.update(
            {
                f"{first_initial}{surname}",
                f"{first_initial} {surname}",
                f"{lead_initials}{surname}",
                f"{lead_initials} {surname}",
            }
        )

    return signatures


def build_player_index(players):
    index = []
    lower_lookup = {}

    for player in players:
        normalized = normalize_name(player)
        tokens = normalized.split()

        metadata = {
            "name": player,
            "lower": player.lower(),
            "normalized": normalized,
            "compact": normalized.replace(" ", ""),
            "tokens": tokens,
            "signatures": build_signatures(tokens),
        }

        index.append(metadata)
        lower_lookup[player.lower()] = player

    return {"players": players, "index": index, "lower_lookup": lower_lookup}


BATTER_INDEX = build_player_index(BatterPlayers)
BOWLER_INDEX = build_player_index(BowlerPlayers)


def build_query_meta(name):
    normalized = normalize_name(name)
    tokens = normalized.split()
    return {
        "raw": name.strip(),
        "lower": name.strip().lower(),
        "normalized": normalized,
        "compact": normalized.replace(" ", ""),
        "tokens": tokens,
        "signatures": build_signatures(tokens),
    }


def player_match_score(query_meta, candidate):
    if not query_meta["normalized"]:
        return 0

    score = 0

    if query_meta["lower"] == candidate["lower"]:
        return 1000

    if query_meta["normalized"] == candidate["normalized"]:
        score = max(score, 950)

    if query_meta["lower"] and query_meta["lower"] in candidate["lower"]:
        score = max(score, 920)

    if query_meta["compact"] and query_meta["compact"] in candidate["compact"]:
        score = max(score, 900)

    if query_meta["signatures"] & candidate["signatures"]:
        score = max(score, 860)

    query_tokens = query_meta["tokens"]
    candidate_tokens = candidate["tokens"]

    if query_tokens and candidate_tokens and query_tokens[-1] == candidate_tokens[-1]:
        if query_tokens[0][0] == candidate_tokens[0][0]:
            score = max(score, 840)

        leading_overlap = sum(
            1
            for query_token in query_tokens[:-1]
            if any(
                candidate_token.startswith(query_token)
                or query_token.startswith(candidate_token)
                for candidate_token in candidate_tokens[:-1]
            )
        )

        if leading_overlap:
            score = max(score, 820 + leading_overlap)

    if len(query_tokens) >= 2:
        matching_tokens = sum(
            1
            for query_token in query_tokens
            if any(
                candidate_token.startswith(query_token)
                or query_token.startswith(candidate_token)
                for candidate_token in candidate_tokens
            )
        )

        if matching_tokens >= len(query_tokens) - 1:
            score = max(score, 780 + matching_tokens)

    return score


def search_players(name, player_index, limit=50):
    query_meta = build_query_meta(name)

    if not query_meta["normalized"]:
        return player_index["players"][:limit]

    scored_matches = []
    for candidate in player_index["index"]:
        score = player_match_score(query_meta, candidate)
        if score > 0:
            scored_matches.append((score, candidate["name"]))

    scored_matches.sort(key=lambda item: (-item[0], item[1]))
    return [name for _, name in scored_matches[:limit]]


def resolve_player_name(name, player_index):
    stripped_name = name.strip()
    lower_name = stripped_name.lower()

    if lower_name in player_index["lower_lookup"]:
        return player_index["lower_lookup"][lower_name]

    matches = search_players(stripped_name, player_index, limit=3)
    query_meta = build_query_meta(stripped_name)

    if not matches:
        return stripped_name

    best_match = matches[0]
    best_score = player_match_score(query_meta, build_query_meta(best_match) | {"name": best_match})

    if best_score >= 900:
        return best_match

    if len(query_meta["tokens"]) >= 2 and best_score >= 840:
        return best_match

    return stripped_name


def encode_player(name, encoder):
    try:
        return int(encoder.transform([name])[0])
    except Exception:
        return 0


def phase_prior(over):
    if over <= 6:
        return np.array([0.37, 0.33, 0.10, 0.03, 0.13, 0.04], dtype=float)

    if over <= 15:
        return np.array([0.44, 0.33, 0.09, 0.03, 0.08, 0.03], dtype=float)

    return np.array([0.35, 0.28, 0.10, 0.04, 0.14, 0.09], dtype=float)


def blend_probabilities(probabilities, over):
    probabilities = np.asarray(probabilities, dtype=float)
    prior = phase_prior(over)
    confidence = float(probabilities.max())

    if confidence >= 0.98:
        model_weight = 0.25
    elif confidence >= 0.95:
        model_weight = 0.45
    else:
        model_weight = 0.65

    combined = (model_weight * probabilities) + ((1 - model_weight) * prior)
    combined /= combined.sum()
    return combined


def sample_runs(batter_code, bowler_code, over, ball_number, over_runs):
    input_data = np.array(
        [[batter_code, bowler_code, over, ball_number, over_runs, 0, 0]]
    )
    probabilities = model.predict_proba(input_data)[0]
    distribution = blend_probabilities(probabilities, over)
    predicted_class = int(np.random.choice(model.classes_, p=distribution))
    return RUN_CLASS_TO_VALUE.get(predicted_class, predicted_class)


def model_probability_vector(batter_code, bowler_code, over, ball_number, over_runs):
    input_data = np.array(
        [[batter_code, bowler_code, over, ball_number, over_runs, 0, 0]]
    )
    probabilities = model.predict_proba(input_data)[0]
    return blend_probabilities(probabilities, over)


def combine_probability_vectors(vectors, weights):
    combined = np.zeros(len(RUN_BUCKETS), dtype=float)
    total_weight = 0.0

    for vector, weight in zip(vectors, weights):
        if vector is None or weight <= 0:
            continue

        combined += np.asarray(vector, dtype=float) * float(weight)
        total_weight += float(weight)

    if total_weight == 0:
        return phase_prior(0)

    combined /= total_weight
    combined /= combined.sum()
    return combined


def build_stats_prior(batter_profile, bowler_profile, pair_history, over_display):
    vectors = [phase_prior(max(0, over_display - 1))]
    weights = [0.25]

    if batter_profile and batter_profile["balls"] >= 24:
        vectors.append(batter_profile["bucket_probabilities"])
        weights.append(0.35)

    if bowler_profile and bowler_profile["balls"] >= 24:
        vectors.append(bowler_profile["bucket_probabilities"])
        weights.append(0.30)

    if pair_history and pair_history["balls"] >= 12:
        vectors.append(pair_history["bucket_probabilities"])
        weights.append(0.45)

        over_specific = pair_history["over_probabilities"].get(str(over_display))
        if over_specific:
            vectors.append(over_specific)
            weights.append(0.2)

    return combine_probability_vectors(vectors, weights)


def predict_probability_vector(
    batter,
    bowler,
    over_display,
    ball_number,
    over_runs,
    batter_profile=None,
    bowler_profile=None,
    pair_history=None,
):
    model_over = max(0, int(over_display) - 1)
    batter_code = encode_player(batter, batter_encoder)
    bowler_code = encode_player(bowler, bowler_encoder)
    model_probs = model_probability_vector(
        batter_code, bowler_code, model_over, ball_number, over_runs
    )
    stats_prior = build_stats_prior(
        batter_profile, bowler_profile, pair_history, over_display
    )
    final = combine_probability_vectors(
        [model_probs, stats_prior, phase_prior(model_over)],
        [0.35, 0.5, 0.15],
    )
    return final


def expected_runs_from_probabilities(probabilities):
    return float(np.dot(probabilities, RUN_PROBABILITY_VALUES))


def most_likely_run(probabilities):
    return int(RUN_PROBABILITY_VALUES[int(np.argmax(probabilities))])


def average_defined(values):
    usable = [value for value in values if value is not None]
    if not usable:
        return 0.0

    return float(sum(usable)) / float(len(usable))


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def parse_optional_int(value):
    if value in (None, ""):
        return None

    return int(value)


def phase_label(over_display):
    if over_display <= 6:
        return "Powerplay"

    if over_display <= 15:
        return "Middle Overs"

    return "Death Overs"


def balls_completed(over_display, ball_number):
    return clamp(((int(over_display) - 1) * 6) + (int(ball_number) - 1), 0, 119)


def balls_remaining(over_display, ball_number):
    return max(1, T20_TOTAL_BALLS - balls_completed(over_display, ball_number))


def overs_display_from_balls(ball_count):
    completed_overs, remainder = divmod(max(0, int(ball_count)), 6)
    return f"{completed_overs}.{remainder}"


def expected_squared_runs_from_probabilities(probabilities):
    return float(np.dot(probabilities, RUN_PROBABILITY_SQUARES))


def normal_cdf(value):
    return 0.5 * (1 + erf(float(value) / sqrt(2)))


def par_score_for_balls(ball_count):
    powerplay = min(ball_count, POWERPLAY_BALLS)
    middle = min(max(ball_count - POWERPLAY_BALLS, 0), MIDDLE_OVERS_BALLS)
    death = max(ball_count - POWERPLAY_BALLS - MIDDLE_OVERS_BALLS, 0)

    return (
        powerplay * (8.4 / 6.0)
        + middle * (7.8 / 6.0)
        + death * (10.2 / 6.0)
    )


def project_remaining_innings(
    batter,
    bowler,
    over_display,
    ball_number,
    over_runs,
    batter_profile,
    bowler_profile,
    pair_history,
):
    projected_runs = 0.0
    projected_variance = 0.0
    phase_projection = {"Powerplay": 0.0, "Middle Overs": 0.0, "Death Overs": 0.0}
    estimated_over_runs = float(over_runs)

    for simulated_over in range(int(over_display), 21):
        start_ball = int(ball_number) if simulated_over == int(over_display) else 1

        if simulated_over != int(over_display):
            estimated_over_runs = 0.0

        for simulated_ball in range(start_ball, 7):
            probabilities = predict_probability_vector(
                batter,
                bowler,
                simulated_over,
                simulated_ball,
                estimated_over_runs,
                batter_profile,
                bowler_profile,
                pair_history,
            )
            expected_runs = expected_runs_from_probabilities(probabilities)
            variance = (
                expected_squared_runs_from_probabilities(probabilities)
                - (expected_runs * expected_runs)
            )

            projected_runs += expected_runs
            projected_variance += max(variance, 0.0)
            phase_projection[phase_label(simulated_over)] += expected_runs
            estimated_over_runs += expected_runs

    return {
        "remaining_runs": projected_runs,
        "remaining_variance": projected_variance,
        "phase_projection": [
            {"label": label, "runs": round(value, 1)}
            for label, value in phase_projection.items()
        ],
    }


def build_total_range(current_score, remaining_runs, remaining_variance):
    projected_total = float(current_score) + float(remaining_runs)
    sigma = sqrt(max(remaining_variance, 1.0))
    band = max(6.0, sigma * 0.9)

    return {
        "floor": round(max(float(current_score), projected_total - band), 1),
        "base": round(projected_total, 1),
        "ceiling": round(projected_total + band, 1),
        "volatility": round(band * 2, 1),
        "sigma": round(sigma, 2),
    }


def compute_chase_win_probability(
    current_score, target, remaining_runs, remaining_variance, wickets_lost
):
    if target is None:
        return None

    runs_to_win = max(int(target) - int(current_score), 0)
    if runs_to_win == 0:
        return 99.0

    sigma = max(sqrt(max(remaining_variance, 1.0)), 1.0)
    wickets_in_hand = max(0, 10 - int(wickets_lost))
    base_probability = (1 - normal_cdf((runs_to_win - remaining_runs) / sigma)) * 100
    wicket_multiplier = clamp(0.72 + (wickets_in_hand * 0.04), 0.55, 1.1)
    adjusted = clamp(base_probability * wicket_multiplier, 1.0, 99.0)
    return round(adjusted, 1)


def build_commentary_intel(recent_commentary, over_display, ball_number, pressure_index):
    text = (recent_commentary or "").strip()

    if not text:
        return {
            "raw": "",
            "event_type": "model_only",
            "impact": "neutral",
            "signals": [],
            "headline": "No live commentary supplied",
            "summary": (
                "The intelligence rail is leaning on model projections and archive history "
                "because no fresh commentary text was provided."
            ),
        }

    lowered = text.lower()
    event_type = "neutral"
    signals = []

    for label, patterns in COMMENTARY_EVENT_PATTERNS.items():
        if any(re.search(pattern, lowered) for pattern in patterns):
            signals.append(label)
            if event_type == "neutral":
                event_type = label

    for skill_group, entries in COMMENTARY_SKILL_PATTERNS.items():
        for label, patterns in entries.items():
            if any(re.search(pattern, lowered) for pattern in patterns):
                signals.append(f"{skill_group}:{label}")

    signal_set = list(dict.fromkeys(signals))

    if event_type in {"six", "four"}:
        impact = "positive"
        headline = "Batting release detected"
        summary = (
            f"The latest commentary points to boundary intent, so the feed treats "
            f"{over_display}.{ball_number} as a chance to keep momentum flowing."
        )
    elif event_type == "wicket":
        impact = "warning"
        headline = "Pressure spike in the live feed"
        summary = (
            f"The commentary reads like a wicket moment, which raises tension immediately "
            f"heading into ball {over_display}.{ball_number}."
        )
    elif event_type in {"dot", "review", "chance"}:
        impact = "warning"
        headline = "Bowling pressure is surfacing"
        summary = (
            "Recent text signals a squeeze ball or half-chance, so the next delivery carries "
            "more pressure than a neutral sequence."
        )
    elif event_type in {"single", "double", "extra"}:
        impact = "neutral"
        headline = "Scoreboard nudges are in play"
        summary = (
            "The latest commentary suggests rotation or extras rather than a pure power shot, "
            "which usually keeps the over moving without fully breaking it open."
        )
    else:
        impact = "warning" if pressure_index >= 65 else "neutral"
        headline = "Commentary signal is mixed"
        summary = (
            "The text does not map to one strong event pattern, so the feed is weighting it "
            "alongside the live pressure index and archive matchup data."
        )

    return {
        "raw": text,
        "event_type": event_type,
        "impact": impact,
        "signals": signal_set[:8],
        "headline": headline,
        "summary": summary,
    }


def build_match_state_summary(
    innings,
    current_score,
    wickets_lost,
    target,
    over_display,
    ball_number,
    remaining_projection,
    total_range,
    dismissal_risk,
):
    completed_balls = balls_completed(over_display, ball_number)
    remaining_balls = balls_remaining(over_display, ball_number)
    current_run_rate = round((current_score * 6.0) / completed_balls, 2) if completed_balls else 0.0
    phase = phase_label(over_display)
    wickets_in_hand = max(0, 10 - int(wickets_lost))

    if int(innings) == 2 and target is not None:
        required_runs = max(int(target) - int(current_score), 0)
        required_run_rate = round((required_runs * 6.0) / remaining_balls, 2) if remaining_balls else 0.0
        chase_win_probability = compute_chase_win_probability(
            current_score,
            target,
            remaining_projection["remaining_runs"],
            remaining_projection["remaining_variance"],
            wickets_lost,
        )
        pressure_index = clamp(
            round(
                28
                + max(0.0, required_run_rate - current_run_rate) * 7.5
                + (int(wickets_lost) * 4.5)
                + (dismissal_risk * 0.45)
                + (12 if remaining_balls <= 18 else 0)
            ),
            6,
            99,
        )

        if chase_win_probability >= 65 and pressure_index <= 45:
            momentum = "Chase under control"
        elif chase_win_probability <= 35 or pressure_index >= 72:
            momentum = "Scoreboard squeeze"
        else:
            momentum = "Balanced chase"

        return {
            "innings": 2,
            "phase": phase,
            "current_score": int(current_score),
            "wickets_lost": int(wickets_lost),
            "wickets_in_hand": wickets_in_hand,
            "target": int(target),
            "required_runs": required_runs,
            "required_run_rate": required_run_rate,
            "current_run_rate": current_run_rate,
            "balls_completed": completed_balls,
            "balls_remaining": remaining_balls,
            "overs_completed": overs_display_from_balls(completed_balls),
            "projected_total": total_range["base"],
            "projected_range": total_range,
            "phase_projection": remaining_projection["phase_projection"],
            "pressure_index": pressure_index,
            "momentum": momentum,
            "chase_win_probability": chase_win_probability,
        }

    par_score = par_score_for_balls(completed_balls)
    score_delta = round(float(current_score) - par_score, 1)
    pressure_index = clamp(
        round(
            52
            - (score_delta * 1.6)
            + (int(wickets_lost) * 4.0)
            + (dismissal_risk * 0.35)
        ),
        8,
        95,
    )

    if score_delta >= 14 and pressure_index <= 40:
        momentum = "Batting surge"
    elif score_delta <= -12 or pressure_index >= 70:
        momentum = "Bowling squeeze"
    else:
        momentum = "Balanced first innings"

    return {
        "innings": 1,
        "phase": phase,
        "current_score": int(current_score),
        "wickets_lost": int(wickets_lost),
        "wickets_in_hand": wickets_in_hand,
        "target": None,
        "required_runs": None,
        "required_run_rate": None,
        "current_run_rate": current_run_rate,
        "balls_completed": completed_balls,
        "balls_remaining": remaining_balls,
        "overs_completed": overs_display_from_balls(completed_balls),
        "projected_total": total_range["base"],
        "projected_range": total_range,
        "phase_projection": remaining_projection["phase_projection"],
        "pressure_index": pressure_index,
        "momentum": momentum,
        "par_score": round(par_score, 1),
        "score_delta_to_par": score_delta,
        "chase_win_probability": None,
    }


def build_strategy_call(match_state, next_ball_run, expected_next_ball_runs, dismissal_risk):
    if dismissal_risk >= 24:
        return (
            "The risk profile is spiking here. Treat this ball like a retention ball first and "
            "force the bowler away from their best length before opening up."
        )

    if match_state["pressure_index"] >= 70:
        return (
            "Pressure is heavy, so even a low-drama single has tactical value. The model prefers "
            "survival plus strike rotation over a forced release shot."
        )

    if expected_next_ball_runs >= 1.7 or next_ball_run in (4, 6):
        return (
            "This looks like a release window. If the batter gets leverage early, the scoring lane "
            "is there to attack rather than merely reset."
        )

    return (
        "The matchup is relatively balanced right now, which makes touch scoring and over control "
        "more valuable than one all-or-nothing swing."
    )


def build_intel_feed(
    batter,
    bowler,
    predictions,
    match_state,
    commentary_intel,
    pair_history,
):
    matchup_note = (
        f"{batter} has {pair_history['runs']} runs from {pair_history['balls']} tracked balls "
        f"against {bowler}."
        if pair_history and pair_history["balls"] >= 12
        else (
            f"The local archive has limited direct history for {batter} against {bowler}, "
            "so the model is leaning more heavily on broader player tendencies."
        )
    )

    feed = [
        {
            "id": "model-edge",
            "tone": "spotlight",
            "title": "Model edge",
            "body": (
                f"Next ball leans {predictions['next_ball_run']} with an expected value of "
                f"{predictions['expected_next_ball_runs']} runs and a dismissal risk of "
                f"{predictions['dismissal_risk']}%."
            ),
        },
        {
            "id": "match-pressure",
            "tone": "warning" if match_state["pressure_index"] >= 65 else "neutral",
            "title": "Pressure pulse",
            "body": (
                f"{match_state['momentum']} at a pressure index of {match_state['pressure_index']}. "
                f"The projected finish sits in the {match_state['projected_range']['floor']} to "
                f"{match_state['projected_range']['ceiling']} band."
            ),
        },
        {
            "id": "archive-context",
            "tone": "neutral",
            "title": "Archive context",
            "body": matchup_note,
        },
        {
            "id": "commentary-wire",
            "tone": commentary_intel["impact"],
            "title": commentary_intel["headline"],
            "body": commentary_intel["summary"],
        },
        {
            "id": "creative-call",
            "tone": "positive" if match_state["pressure_index"] < 60 else "warning",
            "title": "Creative call",
            "body": build_strategy_call(
                match_state,
                predictions["next_ball_run"],
                predictions["expected_next_ball_runs"],
                predictions["dismissal_risk"],
            ),
        },
    ]

    if match_state["innings"] == 2 and match_state["target"] is not None:
        feed.insert(
            2,
            {
                "id": "chase-lens",
                "tone": "positive"
                if (match_state["chase_win_probability"] or 0) >= 55
                else "warning",
                "title": "Chase lens",
                "body": (
                    f"{match_state['required_runs']} needed from {match_state['balls_remaining']} balls "
                    f"at {match_state['required_run_rate']} RPO. Win probability is sitting at "
                    f"{match_state['chase_win_probability']}%."
                ),
            },
        )
    else:
        feed.insert(
            2,
            {
                "id": "innings-lens",
                "tone": "neutral",
                "title": "First-innings lens",
                "body": (
                    f"Current run rate is {match_state['current_run_rate']} with par at "
                    f"{match_state.get('par_score', 0)}. The side is "
                    f"{match_state.get('score_delta_to_par', 0)} runs versus par."
                ),
            },
        )

    return feed


def predict_over_projection(
    batter,
    bowler,
    over_display,
    ball_number,
    over_runs,
    batter_profile,
    bowler_profile,
    pair_history,
):
    remaining_runs = 0.0
    estimated_over_runs = float(over_runs)

    for simulated_ball in range(ball_number, 7):
        probabilities = predict_probability_vector(
            batter,
            bowler,
            over_display,
            simulated_ball,
            estimated_over_runs,
            batter_profile,
            bowler_profile,
            pair_history,
        )
        expected = expected_runs_from_probabilities(probabilities)
        remaining_runs += expected
        estimated_over_runs += expected

    return remaining_runs


def predict_dismissal_risk(
    over_display,
    ball_number,
    over_runs,
    batter_profile,
    bowler_profile,
    pair_history,
):
    batter_dot = batter_profile["dot_rate"] if batter_profile else None
    bowler_dot = bowler_profile["dot_rate"] if bowler_profile else None
    pair_dot = pair_history["dot_rate"] if pair_history and pair_history["balls"] else None
    batter_boundary = batter_profile["boundary_rate"] if batter_profile else None
    bowler_boundary = bowler_profile["boundary_rate"] if bowler_profile else None
    pair_boundary = (
        pair_history["boundary_rate"] if pair_history and pair_history["balls"] else None
    )
    combined_dot = average_defined([pair_dot, batter_dot, bowler_dot])
    combined_boundary = average_defined([pair_boundary, batter_boundary, bowler_boundary])

    phase_pressure = 0.06 if over_display >= 16 else 0.03 if over_display <= 6 else 0.045
    ball_pressure = 0.04 if ball_number >= 5 else 0.02 if ball_number >= 3 else 0.0
    run_pressure = min(float(over_runs) / 18.0, 1.0) * 0.03
    matchup_penalty = 0.0

    if (
        pair_history
        and pair_history["balls"] >= 18
        and batter_profile
        and pair_history["strike_rate"] < batter_profile["strike_rate"] * 0.78
    ):
        matchup_penalty = 0.05

    risk = (
        0.05
        + (combined_dot * 0.18)
        + ((1 - combined_boundary) * 0.06)
        + phase_pressure
        + ball_pressure
        + run_pressure
        + matchup_penalty
    )
    risk = max(0.04, min(0.42, risk))
    return round(risk * 100, 1)


def build_prediction_commentary(
    resolved_batter,
    resolved_bowler,
    next_ball_run,
    over_projection,
    pair_history,
):
    if pair_history and pair_history["balls"] >= 12:
        return (
            f"{resolved_batter} has scored {pair_history['runs']} runs from "
            f"{pair_history['balls']} tracked balls against {resolved_bowler}; "
            f"the archive leans toward a {next_ball_run}-run ball and roughly "
            f"{round(over_projection, 1)} more runs this over."
        )

    return (
        f"The local archive has limited direct history for {resolved_batter} against "
        f"{resolved_bowler}, so the projection leans on overall player tendencies and "
        f"the ball model."
    )


def predict_runs(batter, bowler, over, ball_number, over_runs):
    batter_code = encode_player(batter, batter_encoder)
    bowler_code = encode_player(bowler, bowler_encoder)
    return sample_runs(batter_code, bowler_code, over, ball_number, over_runs)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "cricketai-platform-api",
        "generated_at": utc_now_iso(),
        "models": {
            "ball_model": "loaded",
            "batters": len(BatterPlayers),
            "bowlers": len(BowlerPlayers),
        },
    }


@app.get("/platform/live-matches", response_model=LiveMatchesResponse)
def platform_live_matches():
    return get_platform_live_payload()


@app.get("/platform/dashboard", response_model=PlatformDashboardResponse)
def platform_dashboard():
    live_payload = get_platform_live_payload()

    return {
        "generated_at": live_payload["generated_at"],
        "identity": {
            "name": "CricketAI",
            "tagline": "Predict. Analyze. Dominate the Game.",
            "version": "1.0.0",
            "audience": "Fans, fantasy players, analysts, bettors 18+, and coaches",
            "stack": "React + FastAPI today; MERN + Python AI services target",
            "data_source": live_payload["source"],
        },
        "live_matches": live_payload["matches"],
        "intelligence_signals": platform_intelligence_signals(),
        "run_rate_series": platform_run_rate_series(),
        "player_cards": platform_player_cards(),
        "fantasy": {
            "budget_used": 89.5,
            "expected_points": 746,
            "captain": "Virat Kohli",
            "vice_captain": "Jasprit Bumrah",
            "differentials": ["Rashid Khan", "Tilak Varma", "Rinku Singh"],
            "alerts": [
                "Auto-substitution watch is armed for toss updates.",
                "Death-over bowlers are projected above baseline on this surface.",
            ],
        },
        "architecture": platform_architecture_blocks(),
        "roadmap": platform_roadmap(),
        "safeguards": [
            "No production secret is hardcoded; CRICAPI_KEY is read from environment.",
            "Betting intelligence remains gated behind 18+ and responsible-play controls.",
            "The local dashboard falls back to demo data when external feeds are unavailable.",
        ],
    }


@app.post("/auth/demo-login", response_model=DemoLoginResponse)
def demo_login(data: DemoLoginRequest):
    normalized_role = data.role.lower()
    token_seed = compact_name(f"{data.email}-{normalized_role}")[:36] or "demo"

    return {
        "access_token": f"demo.{token_seed}.local",
        "token_type": "Bearer",
        "expires_in": 900,
        "user": {
            "email": data.email,
            "role": normalized_role,
            "name": data.email.split("@")[0].replace(".", " ").title(),
        },
        "capabilities": [
            "live-dashboard:read",
            "prediction:run",
            "fantasy:preview",
            "analytics:read",
        ],
    }


@app.get("/")
def home():
    return {
        "status": "Backend running 🚀",
        "service": "CricketAI",
        "docs": "/docs"
    }



@app.get("/search")
def search_player(name: str = "", limit: int = 50):
    safe_limit = max(1, min(limit, 200))
    return {
        "batters": search_players(name, BATTER_INDEX, safe_limit),
        "bowlers": search_players(name, BOWLER_INDEX, safe_limit),
    }


@app.get("/players")
def list_players():
    return {
        "batters": BatterPlayers,
        "bowlers": BowlerPlayers,
        "counts": {
            "batters": len(BatterPlayers),
            "bowlers": len(BowlerPlayers),
        },
    }


@app.post("/predict")
def predict(data: dict):
    try:
        requested_batter = data["batter"].strip()
        requested_bowler = data["bowler"].strip()
        batter = resolve_player_name(requested_batter, BATTER_INDEX)
        bowler = resolve_player_name(requested_bowler, BOWLER_INDEX)
        over = int(data["over"])
        ball_number = int(data["ball_number"])
        over_runs = int(data["over_runs"])

        predicted_runs = predict_runs(batter, bowler, over, ball_number, over_runs)
        return {
            "runs": predicted_runs,
            "resolved_batter": batter,
            "resolved_bowler": bowler,
            "requested_batter": requested_batter,
            "requested_bowler": requested_bowler,
        }
    except (KeyError, TypeError, ValueError) as exc:
        return {"error": str(exc)}


@app.post("/win-prob")
def win_prob(data: dict):
    runs = int(data["runs"])
    over = int(data["over"])

    base = (runs * 10) + (over * 2)
    probability = min(95, max(5, base))

    return {"win_probability": probability}


@app.post("/commentary")
def commentary(data: dict):
    runs = int(data["runs"])

    comments = {
        6: ["Massive six!", "Huge hit!", "Into the stands!"],
        4: ["Beautiful boundary!", "Cracking shot!", "Driven for four!"],
        2: ["Good running!", "Quick double"],
        1: ["Takes a single"],
        0: ["Dot ball", "Tight bowling"],
    }

    text = random.choice(comments.get(runs, ["Good play"]))
    return {"commentary": text}


@app.post("/predict-all")
def predict_all(data: dict):
    try:
        requested_batter = data["batter"].strip()
        requested_bowler = data["bowler"].strip()
        batter = resolve_player_name(requested_batter, BATTER_INDEX)
        bowler = resolve_player_name(requested_bowler, BOWLER_INDEX)
        over = int(data["over"])
        ball_number = int(data["ball_number"])
        over_runs = int(data["over_runs"])

        predicted_runs = predict_runs(batter, bowler, over, ball_number, over_runs)
        probability = win_prob({"runs": predicted_runs, "over": over})["win_probability"]
        text = commentary({"runs": predicted_runs})["commentary"]

        return {
            "runs": predicted_runs,
            "win_probability": probability,
            "commentary": text,
            "resolved_batter": batter,
            "resolved_bowler": bowler,
            "requested_batter": requested_batter,
            "requested_bowler": requested_bowler,
        }
    except (KeyError, TypeError, ValueError) as exc:
        return {"error": str(exc)}


@app.post("/prediction-intel")
def prediction_intel(data: dict):
    try:
        requested_batter = data["batter"].strip()
        requested_bowler = data["bowler"].strip()
        over_display = clamp(int(data["over"]), 1, 20)
        ball_number = clamp(int(data["ball_number"]), 1, 6)
        over_runs = max(0, int(data["over_runs"]))
        innings = clamp(int(data.get("innings", 1)), 1, 2)
        current_score = max(0, int(data.get("current_score", 0)))
        wickets_lost = clamp(int(data.get("wickets_lost", 0)), 0, 10)
        target = parse_optional_int(data.get("target"))
        recent_commentary = str(data.get("recent_commentary", "")).strip()

        if innings == 1:
            target = None

        batter = resolve_player_name(requested_batter, BATTER_INDEX)
        bowler = resolve_player_name(requested_bowler, BOWLER_INDEX)

        batter_profile = get_batter_profile(batter)
        bowler_profile = get_bowler_profile(bowler)
        pair_history = get_pair_history(batter, bowler)
        probabilities = predict_probability_vector(
            batter,
            bowler,
            over_display,
            ball_number,
            over_runs,
            batter_profile,
            bowler_profile,
            pair_history,
        )
        next_ball_run = most_likely_run(probabilities)
        expected_next_ball_runs = expected_runs_from_probabilities(probabilities)
        over_projection = predict_over_projection(
            batter,
            bowler,
            over_display,
            ball_number,
            over_runs,
            batter_profile,
            bowler_profile,
            pair_history,
        )
        balls_remaining = max(1, 7 - ball_number)
        projected_strike_rate = round((over_projection / balls_remaining) * 100, 1)
        dismissal_risk = predict_dismissal_risk(
            over_display,
            ball_number,
            over_runs,
            batter_profile,
            bowler_profile,
            pair_history,
        )
        projected_total_over_runs = round(over_runs + over_projection, 1)
        legacy_win_probability = win_prob(
            {"runs": round(expected_next_ball_runs), "over": over_display}
        )["win_probability"]
        remaining_projection = project_remaining_innings(
            batter,
            bowler,
            over_display,
            ball_number,
            over_runs,
            batter_profile,
            bowler_profile,
            pair_history,
        )
        projected_total_range = build_total_range(
            current_score,
            remaining_projection["remaining_runs"],
            remaining_projection["remaining_variance"],
        )
        match_state = build_match_state_summary(
            innings,
            current_score,
            wickets_lost,
            target,
            over_display,
            ball_number,
            remaining_projection,
            projected_total_range,
            dismissal_risk,
        )
        commentary_intel = build_commentary_intel(
            recent_commentary,
            over_display,
            ball_number,
            match_state["pressure_index"],
        )

        predictions = {
            "next_ball_run": next_ball_run,
            "expected_next_ball_runs": round(expected_next_ball_runs, 2),
            "projected_over_runs_remaining": round(over_projection, 2),
            "projected_total_over_runs": projected_total_over_runs,
            "projected_strike_rate": projected_strike_rate,
            "dismissal_risk": dismissal_risk,
            "win_probability": legacy_win_probability,
            "run_distribution": [
                {
                    "run": str(int(RUN_PROBABILITY_VALUES[index])),
                    "probability": round(float(probabilities[index]) * 100, 2),
                }
                for index in range(len(RUN_PROBABILITY_VALUES))
            ],
            "commentary": build_prediction_commentary(
                batter,
                bowler,
                next_ball_run,
                over_projection,
                pair_history,
            ),
        }
        intel_feed = build_intel_feed(
            batter,
            bowler,
            predictions,
            match_state,
            commentary_intel,
            pair_history,
        )

        return {
            "requested_batter": requested_batter,
            "requested_bowler": requested_bowler,
            "resolved_batter": batter,
            "resolved_bowler": bowler,
            "input_context": {
                "over": over_display,
                "ball_number": ball_number,
                "over_runs": over_runs,
                "innings": innings,
                "current_score": current_score,
                "wickets_lost": wickets_lost,
                "target": target,
                "recent_commentary": recent_commentary,
            },
            "predictions": predictions,
            "batter_profile": batter_profile or empty_profile(batter, "batter"),
            "bowler_profile": bowler_profile or empty_profile(bowler, "bowler"),
            "head_to_head": pair_history,
            "match_state": match_state,
            "commentary_intel": commentary_intel,
            "intel_feed": intel_feed,
        }
    except (KeyError, TypeError, ValueError) as exc:
        return {"error": str(exc)}


@app.post("/simulate")
def simulate(data: dict):
    requested_batter = data["batter"].strip()
    requested_bowler = data["bowler"].strip()
    batter = resolve_player_name(requested_batter, BATTER_INDEX)
    bowler = resolve_player_name(requested_bowler, BOWLER_INDEX)

    batter_code = encode_player(batter, batter_encoder)
    bowler_code = encode_player(bowler, bowler_encoder)

    cumulative = 0
    results = []

    for over in range(1, 21):
        over_score = 0

        for ball in range(1, 7):
            predicted_runs = sample_runs(
                batter_code, bowler_code, over, ball, over_score
            )

            over_score += predicted_runs
            cumulative += predicted_runs

        results.append({"over": over, "runs": cumulative})

    return {
        "total_runs": cumulative,
        "overs": results,
        "resolved_batter": batter,
        "resolved_bowler": bowler,
        "requested_batter": requested_batter,
        "requested_bowler": requested_bowler,
    }
