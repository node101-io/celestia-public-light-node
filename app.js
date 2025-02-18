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

// İstemciden gelen pending sorguları tutmak için Map oluşturuyoruz.
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

// Merkezi dinleyici: nodeWs'den gelen tüm mesajları alıp,
// içindeki requestId veya id alanına göre ilgili istemciye gönderiyoruz.
nodeWs.addEventListener('message', (event) => {
  try {
    const messageData = JSON.parse(event.data);
    // Gelen mesaj örneğin: { "jsonrpc": "2.0", "result": { ... }, "id": 31 }
    const requestKey = messageData.requestId || messageData.id;

    if (!requestKey) {
      console.warn('Gelen mesajda requestKey bulunamadı');
      return;
    }

    if (pendingRequests.has(requestKey)) {
      const clientWs = pendingRequests.get(requestKey);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            requestId: requestKey, // veya "id" ismi de kullanılabilir
            result: messageData.result,
            error: messageData.error
          })
        );
      }
      pendingRequests.delete(requestKey);
    } else {
      console.warn(`Gelen response için requestKey bulunamadı: ${requestKey}`);
    }
  } catch (err) {
    console.error('Gelen mesaj parse edilemedi:', err);
  }
});

// İstemci bağlantılarının kurulması
wss.on('connection', (ws, req) => {
  if (!req.headers['x-api-key'])
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (err, api_keys) => {
    if (err || !api_keys)
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

    if (await isNodeRestarting()) {
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));
    }

    // İstemciden gelen mesajlarda, client'in kendi benzersiz requestId veya id göndereceğini varsayıyoruz.
    ws.on('message', async (message) => {
      if (await isNodeRestarting()) {
        return ws.send(
          JSON.stringify({ error: 'node_is_restarting' })
        );
      }

      try {
        const clientMessage = JSON.parse(message);
        // Mesaj formatı örn: { "method": "blob.Subscribe", "params": [...], 
        //                   "jsonrpc": "2.0", "id": 31, "requestId": 31 }
        const requestKey = clientMessage.requestId || clientMessage.id;
        if (!requestKey) {
          return ws.send(
            JSON.stringify({
              error:
                'Eksik identifier: her sorguya benzersiz bir requestId veya id ekleyin.'
            })
          );
        }

        // Bekleyen sorguları Map'e ekliyoruz.
        pendingRequests.set(requestKey, ws);

        // Light node'a yönlendiriyoruz.
        nodeWs.send(JSON.stringify(clientMessage));
      } catch (err) {
        console.error('Client mesajı parse edilemedi:', err);
        ws.send(JSON.stringify({ error: 'Invalid JSON message' }));
      }
    });

    // Bağlantı kapanınca pendingRequests'ten ilgili istekleri temizleyelim.
    ws.on('close', () => {
      for (const [key, clientWs] of pendingRequests.entries()) {
        if (clientWs === ws) {
          pendingRequests.delete(key);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
