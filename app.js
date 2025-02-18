import 'dotenv/config';

import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit'
import { WebSocketServer, WebSocket } from 'ws';
import ReconnectingWebSocket from '@opensumi/reconnecting-websocket';

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
// Her istemcinin sorguları için pending (bekleyen) sorguları saklamak üzere Map oluşturuyoruz.
const pendingRequests = new Map();

// ReconnectingWebSocket ile light node bağlantısı yapılıyor.
const nodeWs = new ReconnectingWebSocket(LIGHT_NODE_ENDPOINT, [], {
  WebSocket: WebSocket,
  WebSocketOptions: {
    headers: {
      'Authorization': 'Bearer ' + process.env.CELESTIA_AUTH_KEY
    }
  }
});

// Merkezi dinleyici: nodeWs'den gelen tüm mesajları alıp, içindeki requestId'ye göre ilgili istemciye gönderecek.
nodeWs.addEventListener('message', (event) => {
  try {
    const messageData = JSON.parse(event.data);
    // Gelen mesajın formatı örn.: { requestId: "12345", result: { ... } }
    const { requestId, result, error } = messageData;
    
    if (pendingRequests.has(requestId)) {
      const clientWs = pendingRequests.get(requestId);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({ requestId, result, error })
        );
      }
      pendingRequests.delete(requestId);
    } else {
      console.warn(
        `Gelen response için requestId bulunamadı: ${requestId}`
      );
    }
  } catch (err) {
    console.error('Gelen mesaj parse edilemedi:', err);
  }
});

// İstemci bağlantılarının kurulması
wss.on('connection', (ws, req) => {
  if (!req.headers['x-api-key'])
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

  ApiKey.findApiKeysByFilters(
    { key: req.headers['x-api-key'] },
    async (err, api_keys) => {
      if (err || !api_keys)
        return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

      if (await isNodeRestarting()) {
        ws.send(JSON.stringify({ error: 'node_is_restarting' }));
      }

      // İstemciden gelen mesajlarda, client kendi requestId'sini oluşturup göndereceğini farz ediyoruz.
      ws.on('message', async (message) => {
        if (await isNodeRestarting())
          return ws.send(
            JSON.stringify({ error: 'node_is_restarting' })
          );

        try {
          const clientMessage = JSON.parse(message);
          // clientMessage ör. format: { requestId: "12345", type: "some_query", payload: { ... } }
          if (!clientMessage.requestId)
            return ws.send(
              JSON.stringify({
                error: 'Eksik requestId: her sorguya benzersiz bir requestId ekleyin.'
              })
            );

          // Bekleyen sorguları saklamak
          pendingRequests.set(clientMessage.requestId, ws);

          // Light node'a yönlendiriyoruz.  
          // Örneğin, clientMessage doğrudan veya gerekirse dönüştürülerek gönderilebilir.
          nodeWs.send(JSON.stringify(clientMessage));
        } catch (err) {
          console.error('Client mesajı parse edilemedi:', err);
          ws.send(JSON.stringify({ error: 'Invalid JSON message' }));
        }
      });

      // Bağlantı kapanınca pendingRequests'ten de temizleyelim
      ws.on('close', () => {
        for (const [key, clientWs] of pendingRequests.entries()) {
          if (clientWs === ws) {
            pendingRequests.delete(key);
          }
        }
      });
    }
  );
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
