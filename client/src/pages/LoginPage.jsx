import { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000");

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.on("chat-message", (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    socket.on("user-joined", ({ username }) => {
      setChat((prev) => [...prev, { username, message: "joined the chat!" }]);
    });

    socket.on("user-left", ({ username }) => {
      setChat((prev) => [...prev, { username, message: "left the chat." }]);
    });

    socket.on("login-error", (msg) => {
      setError(msg);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLogin = () => {
    socket.emit("attempt-login", { username, password });
  };

  socket.on("login-success", () => {
    setLoggedIn(true);
    setError("");
  });

  const handleSend = () => {
    if (message.trim() === "") return;
    socket.emit("chat-message", message);
    setMessage("");
  };

  if (!loggedIn) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">Secure Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          className="w-full mb-2 px-3 py-2 border rounded"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          className="w-full mb-4 px-3 py-2 border rounded"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Login
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-2">Chat as {username}</h2>
      <div className="h-64 overflow-y-scroll border mb-2 p-2 bg-gray-100">
        {chat.map((msg, i) => (
          <div key={i}>
            <strong>{msg.username || "Server"}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <input
        type="text"
        placeholder="Type message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="border px-2 py-1 rounded w-full"
      />
      <button
        onClick={handleSend}
        className="mt-2 bg-green-500 text-white px-4 py-1 rounded"
      >
        Send
      </button>
    </div>
  );
}
