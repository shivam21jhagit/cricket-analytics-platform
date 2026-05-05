import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "./api";

function dedupePlayers(players = []) {
  return [...new Set(players.filter(Boolean))];
}

function usePlayerSuggestions(query) {
  const [batters, setBatters] = useState([]);
  const [bowlers, setBowlers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [catalog, setCatalog] = useState({ batters: [], bowlers: [] });

  useEffect(() => {
    let isActive = true;

    async function loadCatalog() {
      try {
        const response = await axios.get(`${API_BASE_URL}/players`);

        if (!isActive) {
          return;
        }

        setCatalog({
          batters: dedupePlayers(response.data.batters),
          bowlers: dedupePlayers(response.data.bowlers)
        });
      } catch (error) {
        if (isActive) {
          setCatalog({ batters: [], bowlers: [] });
        }
      }
    }

    loadCatalog();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setBatters(catalog.batters);
      setBowlers(catalog.bowlers);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await axios.get(`${API_BASE_URL}/search`, {
          params: { name: term, limit: 80 }
        });

        if (!isActive) {
          return;
        }

        setBatters(dedupePlayers(response.data.batters));
        setBowlers(dedupePlayers(response.data.bowlers));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setBatters(catalog.batters);
        setBowlers(catalog.bowlers);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [catalog.batters, catalog.bowlers, query]);

  return { batters, bowlers, isLoading };
}

export default usePlayerSuggestions;
