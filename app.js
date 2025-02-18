import 'dotenv/config';

import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit'
import { WebSocketServer, WebSocket } from 'ws';

import { ApiKey } from './models/api-key/ApiKey.js';

import { isNodeRestarting } from './utils/nodeStatus.js';

import config from './config.js';

import isAuthenticated from './middlewares/isAuthenticated.js';

import configGetController from './controllers/config/get.js';
import faucetSendGetController from './controllers/faucet/send/[address]/get.js';

import createWalletPostController from './controllers/wallet/create/post.js';
import listWalletPostController from './controllers/wallet/list/post.js';
import rpcPostController from './controllers/rpc/post.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/celestia');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = config.port || 3000;
export const LIGHT_NODE_ENDPOINT = 'http://localhost:10102';

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    error: 'Too many requests, please try again in a minute.'
  }
});

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

app.get('/faucet/send/:address',
  faucetSendGetController
);
app.get('/config',
  configGetController
);

app.post('/wallet/list',
  isAuthenticated,
  listWalletPostController
);
app.post('/wallet/create',
  isAuthenticated,
  createWalletPostController
);
app.post('/rpc',
  isAuthenticated,
  rateLimiter,
  rpcPostController
);

////////////////////////////////////////////////////////////////////////////

let nodeWs = null;
let connectedClients = new Set(); // Bağlı client'ları takip etmek için

const connectToNode = () => {
  try {
    if (nodeWs) {
      nodeWs.removeAllListeners();
      nodeWs.terminate();
    }

    nodeWs = new WebSocket(LIGHT_NODE_ENDPOINT, {
      headers: {
        Authorization: "Bearer " + process.env.CELESTIA_AUTH_KEY,
      },
    });

    nodeWs.on("open", () => {
      console.log("Connected to light node");
      // Node yeniden bağlandığında, tüm client'lar için message listener'ları yeniden ekle
      for (const clientData of connectedClients) {
        const { ws, handleNodeMessage } = clientData;
        if (ws.readyState === WebSocket.OPEN) {
          nodeWs.on("message", handleNodeMessage);
        }
      }
    });

    nodeWs.on("error", (error) => {
      console.error("Light node connection error:", error);
      nodeWs.close();
    });

    nodeWs.on("close", () => {
      console.log("Disconnected from light node, attempting to reconnect...");
      setTimeout(connectToNode, 5000);
    });
  } catch (error) {
    console.error("Failed to connect to light node:", error);
    setTimeout(connectToNode, 5000);
  }
};

wss.on("connection", (ws, req) => {
  if (!req.headers["x-api-key"])
    return ws.close(1000, JSON.stringify({ error: "unauthorized" }));

  ApiKey.findApiKeysByFilters(
    { key: req.headers["x-api-key"] },
    async (err, api_keys) => {
      if (err || !api_keys)
        return ws.close(1000, JSON.stringify({ error: "unauthorized" }));

      if (await isNodeRestarting())
        ws.send(JSON.stringify({ error: "node_is_restarting" }));

      // Node'dan gelen mesajları client'a iletmek için listener
      const handleNodeMessage = (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      };

      // Client bilgilerini Set'e ekle
      const clientData = { ws, handleNodeMessage };
      connectedClients.add(clientData);

      // Node bağlantısı varsa, mesaj listener'ını ekle
      if (nodeWs && nodeWs.readyState === WebSocket.OPEN) {
        nodeWs.on("message", handleNodeMessage);
      }

      ws.on("message", async (message) => {
        if (await isNodeRestarting())
          return ws.send(JSON.stringify({ error: "node_is_restarting" }));

        if (nodeWs && nodeWs.readyState === WebSocket.OPEN) {
          nodeWs.send(message);
        }
      });

      // Client bağlantısı kapandığında cleanup
      ws.on("close", () => {
        if (nodeWs) {
          nodeWs.removeListener("message", handleNodeMessage);
        }
        // Set'ten client bilgilerini kaldır
        connectedClients.delete(clientData);
      });

      const intervalId = setInterval(async () => {
        if (await isNodeRestarting())
          ws.send(JSON.stringify({ error: "node_is_restarting" }));
      }, 5000);

      ws.on("close", () => {
        clearInterval(intervalId);
      });
    }
  );
});

// İlk bağlantıyı başlat
connectToNode();

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
