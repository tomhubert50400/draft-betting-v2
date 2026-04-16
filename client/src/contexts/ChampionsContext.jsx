import React, { createContext, useContext, useState, useEffect } from "react";

let championsCache = null;
let versionCache = null;

async function fetchLatestVersion() {
  if (versionCache) return versionCache;
  try {
    const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await response.json();
    versionCache = versions[0];
    return versionCache;
  } catch (error) {
    console.error("Error fetching version:", error);
    return "14.1.1";
  }
}

async function fetchChampions() {
  if (championsCache) return championsCache;

  try {
    const version = await fetchLatestVersion();
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );
    const data = await response.json();

    const champions = Object.values(data.data).map((champ) => ({
      name: champ.name,
      id: champ.id,
      key: champ.key,
    }));

    championsCache = { champions, version };
    return championsCache;
  } catch (error) {
    console.error("Error fetching champions:", error);
    return { champions: [], version: "14.1.1" };
  }
}

function getChampionImageUrl(championId, version) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`;
}

const ChampionsContext = createContext({
  champions: [],
  version: null,
  loading: true,
  getChampionImageUrl: () => "",
});

export function ChampionsProvider({ children }) {
  const [champions, setChampions] = useState([]);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChampions() {
      setLoading(true);
      const { champions: champs, version: v } = await fetchChampions();
      setChampions(champs);
      setVersion(v);
      setLoading(false);
    }
    loadChampions();
  }, []);

  const getImageUrl = (championId) => {
    if (!version || !championId) return "";
    return getChampionImageUrl(championId, version);
  };

  return (
    <ChampionsContext.Provider
      value={{
        champions,
        version,
        loading,
        getChampionImageUrl: getImageUrl,
      }}
    >
      {children}
    </ChampionsContext.Provider>
  );
}

export function useChampions() {
  const context = useContext(ChampionsContext);
  if (!context) {
    throw new Error("useChampions must be used within a ChampionsProvider");
  }
  return context;
}
