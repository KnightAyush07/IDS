import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const socket = io("http://192.168.208.4:3000");

const ServerStatsChart = () => {
  const [stats, setStats] = useState({
    cpuUsage: [],
    memoryUsage: [],
    activeClientsCount: [],
    intrusion: "",
    timestamps: [],
  });

  const [activeClients, setActiveClients] = useState({});
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [intrusionHistory, setIntrusionHistory] = useState([]); // Add this line

  useEffect(() => {
    socket.on("server-stats", (data) => {
      setStats((prevStats) => ({
        cpuUsage: [...prevStats.cpuUsage.slice(-9), data.cpu],
        memoryUsage: [...prevStats.memoryUsage.slice(-9), data.memory],
        activeClientsCount: [
          ...prevStats.activeClientsCount.slice(-9),
          data.activeClientsCount,
        ],
        intrusion: data.intrusion,
        timestamps: [
          ...prevStats.timestamps.slice(-9),
          new Date().toLocaleTimeString(),
        ],
      }));

      // Update intrusion history when received from server
      if (data.intrusionHistory) {
        setIntrusionHistory(data.intrusionHistory);
      }
    });

    socket.on("active-clients", (data) => {
      setActiveClients((prevClients) => {
        const updatedHistory = [...connectionHistory];

        for (const socketId in prevClients) {
          if (!(socketId in data)) {
            const existing = updatedHistory.find(
              (entry) => entry.socketId === socketId && !entry.disconnectedAt
            );
            if (existing) {
              existing.disconnectedAt = new Date().toLocaleString();
            }
          }
        }

        for (const socketId in data) {
          const alreadyLogged = updatedHistory.some(
            (entry) => entry.socketId === socketId
          );
          if (!alreadyLogged) {
            updatedHistory.push({
              socketId,
              ip: data[socketId].ip,
              isServer: data[socketId].isServer || false,
              connectedAt: data[socketId].connectedAt,
              disconnectedAt: null,
            });
          }
        }

        setConnectionHistory(updatedHistory);
        return data;
      });
    });

    return () => {
      socket.off("server-stats");
      socket.off("active-clients");
    };
  }, [connectionHistory]);

  const exportToCSV = () => {
    // Connection History Section
    let csvContent = "Connection History\n";
    csvContent += "Socket ID,IP Address,Type,Connected At,Disconnected At\n";

    connectionHistory.forEach((entry) => {
      csvContent += `${entry.socketId},${entry.ip},${
        entry.isServer ? "Server" : "Client"
      },${entry.connectedAt},${entry.disconnectedAt || "Still Connected"}\n`;
    });

    // Intrusion History Section
    csvContent += "\n\nIntrusion History\n";
    csvContent += "Timestamp,Event Type,IP Address(es),Details\n";

    intrusionHistory.forEach((event) => {
      csvContent += `${event.timestamp},${event.type},"${event.ips.join(
        ", "
      )}",${event.details}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `server-history-${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ... rest of your component code ...
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 10,
        },
      },
    },
  };

  const cpuData = {
    labels: stats.timestamps,
    datasets: [
      {
        label: "CPU Usage (%)",
        data: stats.cpuUsage,
        borderColor: "red",
        backgroundColor: "rgba(255, 0, 0, 0.2)",
        fill: true,
      },
    ],
  };

  const memoryData = {
    labels: stats.timestamps,
    datasets: [
      {
        label: "Memory Usage (%)",
        data: stats.memoryUsage,
        borderColor: "blue",
        backgroundColor: "rgba(0, 0, 255, 0.2)",
        fill: true,
      },
    ],
  };

  const activeClientsData = {
    labels: stats.timestamps,
    datasets: [
      {
        label: "Active Clients Count",
        data: stats.activeClientsCount,
        borderColor: "green",
        backgroundColor: "rgba(0, 255, 0, 0.2)",
        fill: true,
      },
    ],
  };

  return (
    <div style={{ padding: "10px" }}>
      {stats.intrusion && (
        <div style={{ color: "red", fontSize: "20px" }}>
          <strong>{stats.intrusion}</strong>
        </div>
      )}
      {stats.intrusion.includes("Unauthorized IP") && (
        <div
          style={{
            backgroundColor: "#ffe0e0",
            border: "1px solid red",
            padding: "10px",
            borderRadius: "5px",
            margin: "10px 0",
            color: "red",
            fontWeight: "bold",
          }}
        >
          ⚠️ Unauthorized IP has attempted to connect to the server!
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
        {/* Charts on Left */}
        <div style={{ flex: 1, minWidth: "50vw" }}>
          <div style={{ height: "200px", marginBottom: "60px" }}>
            <h3>Active Clients Count</h3>
            <Line data={activeClientsData} options={chartOptions} />
          </div>
          <div style={{ height: "200px", marginBottom: "60px" }}>
            <h3>CPU Usage (%)</h3>
            <Line data={cpuData} options={chartOptions} />
          </div>
          <div style={{ height: "200px" }}>
            <h3>Memory Usage (%)</h3>
            <Line data={memoryData} options={chartOptions} />
          </div>
        </div>

        {/* Active Clients Table on Right */}
        <div style={{ flex: 1, minWidth: "45vw" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h2>Active Connections</h2>
            <button
              onClick={exportToCSV}
              style={{
                padding: "8px 12px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Export CSV
            </button>
          </div>
          <h3>🔌 Total Connections: {Object.keys(activeClients).length}</h3>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              backgroundColor: "#000",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#222" }}>
                <th
                  style={{
                    border: "1px solid #444",
                    padding: "8px",
                    color: "#fff",
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    border: "1px solid #444",
                    padding: "8px",
                    color: "#fff",
                  }}
                >
                  Socket ID
                </th>
                <th
                  style={{
                    border: "1px solid #444",
                    padding: "8px",
                    color: "#fff",
                  }}
                >
                  IP Address
                </th>
                <th
                  style={{
                    border: "1px solid #444",
                    padding: "8px",
                    color: "#fff",
                  }}
                >
                  Connected At
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(activeClients).map(([id, client]) => (
                <tr key={id}>
                  <td
                    style={{
                      border: "1px solid #444",
                      padding: "8px",
                      color: client.isServer ? "#4CAF50" : "#fff",
                      fontWeight: client.isServer ? "bold" : "normal",
                    }}
                  >
                    {client.isServer ? "🖥️ Server" : "👤 Client"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #444",
                      padding: "8px",
                      color: client.isServer ? "#4CAF50" : "#fff",
                    }}
                  >
                    {id}
                  </td>
                  <td
                    style={{
                      border: "1px solid #444",
                      padding: "8px",
                      color: client.isServer ? "#4CAF50" : "#fff",
                    }}
                  >
                    {client.ip} {client.isServer && "(Server)"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #444",
                      padding: "8px",
                      color: client.isServer ? "#4CAF50" : "#fff",
                    }}
                  >
                    {client.connectedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ServerStatsChart;
