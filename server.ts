import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Store connected users: { novaId: socketId } and { phoneNumber: socketId }
  const users: Record<string, string> = {};
  const phoneToSocket: Record<string, string> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("register", ({ novaId, phoneNumber }: { novaId: string, phoneNumber?: string }) => {
      users[novaId] = socket.id;
      if (phoneNumber) {
        phoneToSocket[phoneNumber] = socket.id;
      }
      console.log(`Registered: ${novaId} (Phone: ${phoneNumber || 'None'}) -> ${socket.id}`);
      socket.emit("registered", { novaId, phoneNumber });
    });

    socket.on("call-user", ({ to, offer, from, isPhone }: { to: string, offer: any, from: string, isPhone?: boolean }) => {
      const targetSocketId = isPhone ? phoneToSocket[to] : users[to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("incoming-call", { from, offer, isPhone });
      } else {
        socket.emit("call-failed", { reason: isPhone ? "Number not active on Nova Secure Line" : "User not found" });
      }
    });

    socket.on("answer-call", ({ to, answer }: { to: string, answer: any }) => {
      const targetSocketId = users[to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-answered", { answer });
      }
    });

    socket.on("ice-candidate", ({ to, candidate }: { to: string, candidate: any }) => {
      const targetSocketId = users[to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("ice-candidate", { candidate });
      }
    });

    socket.on("end-call", ({ to }: { to: string }) => {
      const targetSocketId = users[to];
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-ended");
      }
    });

    socket.on("disconnect", () => {
      // Cleanup users mapping
      for (const id in users) {
        if (users[id] === socket.id) {
          delete users[id];
          break;
        }
      }
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Nova Server running on http://localhost:${PORT}`);
  });
}

startServer();
