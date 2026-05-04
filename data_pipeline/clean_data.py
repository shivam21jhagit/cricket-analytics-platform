import pandas as pd

# Load big dataset
df = pd.read_csv("../data/processed/cricsheet_data.csv")

print("Original shape:", df.shape)

# -----------------------------
# 1. Remove missing values
# -----------------------------
df = df.dropna()

# -----------------------------
# 2. Convert data types (OPTIMIZATION)
# -----------------------------
df["runs"] = df["runs"].astype("int8")
df["over"] = df["over"].astype("int8")

# -----------------------------
# 3. Keep only important columns
# -----------------------------
df = df[["batter", "bowler", "runs", "over"]]

# -----------------------------
# 4. Reduce dataset size (IMPORTANT)
# -----------------------------
df_sample = df.sample(n=500000, random_state=42)

print("Sample shape:", df_sample.shape)

# Save cleaned dataset
df_sample.to_csv("../data/processed/cleaned_cricsheet.csv", index=False)

print("\n✅ Cleaned dataset ready!")