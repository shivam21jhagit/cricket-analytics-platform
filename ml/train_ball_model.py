import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier
import pickle

# -----------------------------
# Load dataset
# -----------------------------
df = pd.read_csv("../data/processed/cleaned_cricsheet.csv")

print("Dataset shape:", df.shape)

# -----------------------------
# Encode players
# -----------------------------
batter_encoder = LabelEncoder()
bowler_encoder = LabelEncoder()

df["batter"] = batter_encoder.fit_transform(df["batter"])
df["bowler"] = bowler_encoder.fit_transform(df["bowler"])

# -----------------------------
# Feature Engineering
# -----------------------------
df["ball_number"] = df.groupby(["batter", "over"]).cumcount()

df["over_runs"] = df.groupby(["batter", "over"])["runs"].cumsum()

df["powerplay"] = df["over"].apply(lambda x: 1 if x < 6 else 0)
df["death_over"] = df["over"].apply(lambda x: 1 if x >= 15 else 0)

# -----------------------------
# Remove unrealistic rows
# -----------------------------
df = df[df["runs"].isin([0,1,2,3,4,5])]

# -----------------------------
# Features & Target
# -----------------------------
X = df[[
    "batter",
    "bowler",
    "over",
    "ball_number",
    "over_runs",
    "powerplay",
    "death_over"
]]

y = df["runs"]

# -----------------------------
# Train-test split
# -----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# -----------------------------
# Handle imbalance (IMPORTANT)
# -----------------------------
model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.08,
    subsample=0.9,
    colsample_bytree=0.9,
    objective="multi:softmax",
    num_class=6
)

# -----------------------------
# Train
# -----------------------------
model.fit(X_train, y_train)

# -----------------------------
# Evaluate
# -----------------------------
y_pred = model.predict(X_test)

print("\nAccuracy:", accuracy_score(y_test, y_pred))
print("\nClass Report:\n", classification_report(y_test, y_pred))

# -----------------------------
# Save model + encoders
# -----------------------------
pickle.dump(model, open("ball_model.pkl", "wb"))
pickle.dump(batter_encoder, open("batter_encoder.pkl", "wb"))
pickle.dump(bowler_encoder, open("bowler_encoder.pkl", "wb"))

print("✅ Model saved successfully!")