import { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [batters, setBatters] = useState([]);
  const [bowlers, setBowlers] = useState([]);

  const [batter, setBatter] = useState("");
  const [bowler, setBowler] = useState("");

  const [result, setResult] = useState(null);

  // Load players
  useEffect(() => {
    axios.get("https://cricket-analytics-platform.onrender.com/players")
      .then(res => {
        setBatters(res.data.batters);
        setBowlers(res.data.bowlers);
      });
  }, []);

  const predict = async () => {
    const res = await axios.post("https://cricket-analytics-platform.onrender.com/predict", {
      batter,
      bowler,
      over: 5,
      ball_number: 2,
      over_runs: 8
    });

    setResult(res.data.predicted_runs);
  };

  return (
    <div style={{
      background: "#1e1e2f",
      color: "white",
      height: "100vh",
      padding: 40
    }}>
      <h1>🏏 Cricket Analytics AI</h1>

      <select onChange={(e) => setBatter(e.target.value)}>
        <option>Select Batter</option>
        {batters.map((p, i) => (
          <option key={i}>{p}</option>
        ))}
      </select>

      <br /><br />

      <select onChange={(e) => setBowler(e.target.value)}>
        <option>Select Bowler</option>
        {bowlers.map((p, i) => (
          <option key={i}>{p}</option>
        ))}
      </select>

      <br /><br />

      <button onClick={predict}>Predict</button>

      {result && (
        <h2>🔥 Predicted Runs: {result}</h2>
      )}
    </div>
  );
}

export default App;