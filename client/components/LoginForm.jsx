import { useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000"); // your backend server

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    socket.emit("login-attempt", { username, password });
  };

  socket.on("login-response", (res) => {
    setMessage(res.message);
  });

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded shadow mt-10">
      <h2 className="text-2xl mb-4 font-bold text-center">Login</h2>
      <form onSubmit={handleLogin}>
        <input
          className="border p-2 w-full mb-3"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="border p-2 w-full mb-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="bg-blue-500 text-white w-full p-2 rounded"
          type="submit"
        >
          Login
        </button>
      </form>
      {message && <p className="mt-4 text-center text-red-500">{message}</p>}
    </div>
  );
}
