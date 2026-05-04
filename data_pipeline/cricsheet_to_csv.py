import json
import pandas as pd
import os

# Path to Cricsheet JSON files
folder_path = "../data/raw/cricsheet"

data = []

# Loop through all JSON files
for file in os.listdir(folder_path):

    if file.endswith(".json"):

        with open(os.path.join(folder_path, file), encoding="utf-8") as f:
            match = json.load(f)

        # Get teams safely
        teams = match.get("info", {}).get("teams", ["Unknown", "Unknown"])

        # Loop through innings
        for inning in match.get("innings", []):

            # -----------------------------
            # CASE 1: If "overs" exists
            # -----------------------------
            if "overs" in inning:
                for over in inning["overs"]:
                    over_number = over.get("over", None)

                    for ball in over.get("deliveries", []):

                        batter = ball.get("batter")
                        bowler = ball.get("bowler")
                        runs = ball.get("runs", {}).get("batter", 0)

                        data.append([
                            teams[0],
                            teams[1],
                            over_number,
                            batter,
                            bowler,
                            runs
                        ])

            # -----------------------------
            # CASE 2: If "deliveries" exists
            # -----------------------------
            elif "deliveries" in inning:
                for ball in inning["deliveries"]:

                    over_number = ball.get("over", None)
                    batter = ball.get("batter")
                    bowler = ball.get("bowler")
                    runs = ball.get("runs", {}).get("batter", 0)

                    data.append([
                        teams[0],
                        teams[1],
                        over_number,
                        batter,
                        bowler,
                        runs
                    ])

# Convert to DataFrame
df = pd.DataFrame(data, columns=[
    "team1", "team2", "over", "batter", "bowler", "runs"
])

# Remove missing values (basic cleaning)
df = df.dropna()

# Show sample
print(df.head())

# Save processed dataset
output_path = "../data/processed/cricsheet_data.csv"
df.to_csv(output_path, index=False)

print("\n✅ Cricsheet converted successfully!")
print(f"Saved at: {output_path}")
print(f"Total rows: {len(df)}")