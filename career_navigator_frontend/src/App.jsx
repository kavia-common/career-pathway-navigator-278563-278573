/**
 * Minimal App wiring graph and library pages.
 */
import React, { useState } from "react";
import Graph from "./components/Graph";
import RoadmapLibrary from "./pages/RoadmapLibrary";

export default function App() {
  const [route, setRoute] = useState("graph");
  const [fromRoleId, setFromRoleId] = useState(1);
  const [toRoleId, setToRoleId] = useState(2);
  const [loaded, setLoaded] = useState(null);

  const userId = "demo-user";

  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setRoute("graph")} style={{ padding: "6px 10px" }}>
          Graph
        </button>
        <button onClick={() => setRoute("library")} style={{ padding: "6px 10px" }}>
          Roadmaps
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <label>
            From Role ID{" "}
            <input
              type="number"
              min={1}
              value={fromRoleId}
              onChange={(e) => setFromRoleId(parseInt(e.target.value || "1", 10))}
            />
          </label>
          <label>
            To Role ID{" "}
            <input
              type="number"
              min={1}
              value={toRoleId}
              onChange={(e) => setToRoleId(parseInt(e.target.value || "2", 10))}
            />
          </label>
        </div>
      </header>
      {route === "graph" ? (
        <Graph
          fromRoleId={fromRoleId}
          toRoleId={toRoleId}
          userId={userId}
          initialGraph={loaded?.graph_payload || null}
        />
      ) : (
        <RoadmapLibrary userId={userId} onLoadRoadmap={(rm) => { setLoaded(rm); setRoute("graph"); }} />
      )}
    </div>
  );
}
