import { Server } from "socket.io";
import express from "express";
import http from "http";
import os from "os";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Constants
const SERVER_IP = "192.168.208.4";
const TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { style: 'short' });
const INTRUSION_TYPES = {
  UNAUTHORIZED_IP: "Unauthorized IP",
  TOO_MANY_CONNECTIONS: "Too Many Connections",
  FREQUENT_RECONNECTS: "Frequent Reconnects",
  FAILED_LOGINS: "Failed Login Attempts"
};

// Configuration
const allowedIPs = [
  SERVER_IP,
  "192.168.208.101",
  "192.168.65.10"
];

const allowedIPUsers = {
  "192.168.208.101": { username: "Ayush", password: "123456" },
  [SERVER_IP]: { username: "Server", password: "server123" },
  "192.168.65.10": { username: "Apoorv", password: "654321" }
};

const RECONNECT_LIMIT = 5;
const RECONNECT_WINDOW_MS = 30000;
const FAILED_LOGIN_LIMIT = 3;

// State
let activeClients = {};
let unauthorizedSockets = new Map();
let ipConnectionCount = {};
let flaggedIPs = new Set();
let reconnectTracker = {};
let frequentReconnectIPs = new Set();
let failedLoginAttempts = new Map();
let users = {};
let chatHistory = [];
let intrusionHistory = [];

// Helper functions
function isBlockedIP(ip) {
  return ip === "127.0.0.1" || ip === "::1";
}

const getCpuUsage = () => (os.loadavg()[0] * 100).toFixed(2);

// Server setup
app.use(express.static("../public"));
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "../public/index.html" });
});

// Socket.io connection handler
io.on("connection", (socket) => {
  const clientIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;

  if (isBlockedIP(clientIp)) {
    console.log(`❌ Blocking disallowed local IP: ${clientIp}`);
    socket.disconnect(true);
    return;
  }

  ipConnectionCount[clientIp] = (ipConnectionCount[clientIp] || 0) + 1;
  if (ipConnectionCount[clientIp] > 5) {
    flaggedIPs.add(clientIp);
    const event = {
      type: INTRUSION_TYPES.TOO_MANY_CONNECTIONS,
      ips: [clientIp],
      timestamp: new Date().toLocaleString(),
      details: `${clientIp} (${ipConnectionCount[clientIp]} connections)`
    };
    intrusionHistory.push(event);
    console.log(`🚨 Too many connections from IP: ${clientIp}`);
  }

  const now = Date.now();
  if (!reconnectTracker[clientIp]) {
    reconnectTracker[clientIp] = {
      timestamps: [],
      lastWarning: null,
      warningCount: 0
    };
  }

  reconnectTracker[clientIp].timestamps.push(now);
  reconnectTracker[clientIp].timestamps = reconnectTracker[clientIp].timestamps.filter(
    ts => now - ts <= RECONNECT_WINDOW_MS
  );

  if (reconnectTracker[clientIp].timestamps.length > RECONNECT_LIMIT) {
    const lastWarning = reconnectTracker[clientIp].lastWarning;
    const secondsSinceLastWarning = lastWarning ? Math.floor((now - lastWarning) / 1000) : 0;

    if (!lastWarning || secondsSinceLastWarning >= 5) {
      frequentReconnectIPs.add(clientIp);
      reconnectTracker[clientIp].lastWarning = now;
      reconnectTracker[clientIp].warningCount++;

      const timeAgo = TIME_FORMATTER.format(
        -Math.floor((now - reconnectTracker[clientIp].timestamps[0]) / 1000),
        'second'
      );

      const event = {
        type: INTRUSION_TYPES.FREQUENT_RECONNECTS,
        ips: [clientIp],
        timestamp: new Date().toLocaleString(),
        details: `${clientIp} (${reconnectTracker[clientIp].timestamps.length} reconnects in ${timeAgo})`
      };
      intrusionHistory.push(event);
      console.log(`⚠️ Frequent reconnects: ${event.details}`);
    }
  }

  const isAuthorized = allowedIPs.includes(clientIp);
  if (!isAuthorized) {
    unauthorizedSockets.set(socket.id, clientIp);
    const event = {
      type: INTRUSION_TYPES.UNAUTHORIZED_IP,
      ips: [clientIp],
      timestamp: new Date().toLocaleString(),
      details: `Unauthorized connection attempt from ${clientIp}`
    };
    intrusionHistory.push(event);
    console.log(`⚠️ Unauthorized IP detected: ${clientIp}`);
  }

  activeClients[socket.id] = {
    ip: clientIp,
    connectedAt: new Date().toLocaleTimeString(),
    isServer: clientIp === SERVER_IP
  };

  console.log(`Client connected: ${clientIp} (Socket ID: ${socket.id})`);
  io.emit("active-clients", activeClients);

  socket.on("register-user", ({ username, password }) => {
    const userRecord = allowedIPUsers[clientIp];

    if (userRecord && userRecord.username === username && userRecord.password === password) {
      users[socket.id] = username;
      console.log(`✅ ${username} authenticated and joined (Socket ID: ${socket.id})`);

      if (failedLoginAttempts.has(clientIp)) {
        failedLoginAttempts.delete(clientIp);
        console.log(`🔓 Cleared failed login attempts for IP: ${clientIp}`);
      }

      io.emit("user-joined", { id: socket.id, username });
      io.emit("chat-history", chatHistory);
    } else {
      console.log(`❌ Auth failed for IP: ${clientIp} with username: ${username}`);

      const failCount = failedLoginAttempts.get(clientIp) || 0;
      failedLoginAttempts.set(clientIp, failCount + 1);

      if (failCount + 1 >= FAILED_LOGIN_LIMIT) {
        const event = {
          type: INTRUSION_TYPES.FAILED_LOGINS,
          ips: [clientIp],
          timestamp: new Date().toLocaleString(),
          details: `${clientIp} (${failCount + 1} failed attempts)`
        };
        intrusionHistory.push(event);
        console.warn(`🚨 Multiple failed login attempts from IP: ${clientIp}`);
      }

      socket.emit("auth-failed", "Authentication failed. Check username/password.");
      socket.disconnect(true);
    }
  });

  socket.on("chat-message", (message) => {
    const username = users[socket.id] || "Unknown";
    const msgObj = {
      id: socket.id,
      username,
      message,
      time: new Date().toLocaleTimeString(),
    };
    chatHistory.push(msgObj);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit("chat-message", msgObj);
  });

  socket.on("disconnect", () => {
    const username = users[socket.id] || "Unknown";
    console.log(`Client disconnected: ${clientIp} (Socket ID: ${socket.id})`);

    delete activeClients[socket.id];
    unauthorizedSockets.delete(socket.id);
    delete users[socket.id];

    ipConnectionCount[clientIp]--;
    if (ipConnectionCount[clientIp] <= 5) {
      flaggedIPs.delete(clientIp);
    }

    if (failedLoginAttempts.get(clientIp) && users[socket.id]) {
      failedLoginAttempts.delete(clientIp);
    }

    io.emit("active-clients", activeClients);
    io.emit("user-left", { id: socket.id, username });
  });
});

setInterval(() => {
  const cpuUsage = getCpuUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);
  const clientsCount = Object.keys(activeClients).length;

  const unauthorizedCount = unauthorizedSockets.size;
  const unauthorizedIps = Array.from(new Set(unauthorizedSockets.values()));
  const multipleConnIps = Array.from(flaggedIPs);
  const frequentIps = Array.from(frequentReconnectIPs);
  const suspiciousLoginIps = Array.from(failedLoginAttempts.entries())
    .filter(([_, count]) => count >= FAILED_LOGIN_LIMIT)
    .map(([ip]) => ip);

  let intrusionDetected = [];

  if (clientsCount > 70) {
    intrusionDetected.push("⚠️ Too many clients — Intrusion Detected!");
  }

  if (unauthorizedCount > 0) {
    intrusionDetected.push(`🚨 ${unauthorizedCount} Unauthorized IP(s) Connected\nIPs: ${unauthorizedIps.join(", ")}`);
  }

  if (multipleConnIps.length > 0) {
    intrusionDetected.push(
      `🚨 Multiple Connections from Same IP Detected:\n${multipleConnIps
        .map(ip => `${ip} (${ipConnectionCount[ip]} connections)`)
        .join("\n")}`
    );
  }

  if (frequentIps.length > 0) {
    const frequentReconnectInfo = frequentIps.map(ip => {
      const reconnects = reconnectTracker[ip]?.timestamps || [];
      const lastConnect = reconnects[reconnects.length - 1];
      const timeAgo = lastConnect ? TIME_FORMATTER.format(
        -Math.floor((Date.now() - lastConnect) / 1000),
        'second'
      ) : 'just now';

      return `${ip} (${reconnects.length} reconnects, last ${timeAgo})`;
    });

    intrusionDetected.push(`⚠️ Frequent Reconnects Detected:\n${frequentReconnectInfo.join("\n")}`);
  }

  if (suspiciousLoginIps.length > 0) {
    intrusionDetected.push(`🚨 Repeated Failed Login Attempts Detected:\n${suspiciousLoginIps.join("\n")}`);
  }

  io.emit("server-stats", {
    cpu: cpuUsage,
    memory: memoryUsage,
    activeClientsCount: clientsCount,
    intrusion: intrusionDetected.join("\n\n"),
    activeClients: Object.values(activeClients),
    intrusionHistory
  });

}, 2000);

// Start server
const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
