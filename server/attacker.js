import { io } from "socket.io-client";

const SERVER_URL = "http://192.168.208.4:3000";
const NUMBER_OF_FAKE_CLIENTS = 100;

const clients = [];

for (let i = 0; i < NUMBER_OF_FAKE_CLIENTS; i++) {
  const fakeIP = `192.168.65.${(i % 250) + 1}`; // cycles IPs between 192.168.65.1 and .250

  const socket = io(SERVER_URL, {
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: {
      "x-forwarded-for": fakeIP,
    },
  });

  socket.on("connect", () => {
    console.log(`Fake client ${i + 1} connected from IP ${fakeIP}`);
  });

  socket.on("disconnect", () => {
    console.log(`Fake client ${i + 1} disconnected`);
  });

  clients.push(socket);
}
