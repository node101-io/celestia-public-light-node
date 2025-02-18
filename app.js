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
const activeListeners = [];

const connectToNode = () => {
  try {
    if (nodeWs) {
      nodeWs.removeAllListeners();
      nodeWs.terminate();
    }

    nodeWs = new WebSocket(LIGHT_NODE_ENDPOINT, {
      headers: {
        'Authorization': 'Bearer ' + process.env.CELESTIA_AUTH_KEY,
      }
    });

    nodeWs.on('open', () => {
      console.log('Connected to light node');
      // Node bağlantısı yenilendiğinde tüm aktif listener'ları yeniden bağla
      // ve subscription mesajlarını tekrar gönder
      activeListeners.forEach(listener => {
        nodeWs.on('message', listener.handleNodeMessage);
        if (listener.lastSubscriptionMessage) {
          nodeWs.send(listener.lastSubscriptionMessage);
        }
      });
    });

    nodeWs.on('error', (error) => {
      console.error('Light node connection error:', error);
      nodeWs.close();
    });

    nodeWs.on('close', () => {
      console.log('Disconnected from light node, attempting to reconnect...');
      setTimeout(connectToNode, 5000);
    });
  } catch (error) {
    console.error('Failed to connect to light node:', error);
    setTimeout(connectToNode, 5000);
  }
};

wss.on('connection', (ws, req) => {
  if (!req.headers['x-api-key'])
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (err, api_keys) => {
    if (err || !api_keys)
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

    if (await isNodeRestarting())
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));

    const handleNodeMessage = (data) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(data);
    };

    // Listener bilgisini genişletiyoruz, son subscription mesajını da tutacak
    const listenerInfo = { 
      ws, 
      handleNodeMessage,
      lastSubscriptionMessage: null 
    };
    activeListeners.push(listenerInfo);

    if (nodeWs)
      nodeWs.on('message', handleNodeMessage);

    ws.on('message', async (message) => {
      if (await isNodeRestarting())
        return ws.send(JSON.stringify({ error: 'node_is_restarting' }));

      // Gelen mesaj bir subscription ise kaydedelim
      const msgStr = message.toString();
      try {
        const msgObj = JSON.parse(msgStr);
        if (msgObj.method === 'blob.Subscribe') {
          // Bu client'ın listener bilgisini bulup subscription mesajını kaydedelim
          const listener = activeListeners.find(l => l.ws === ws);
          if (listener) {
            listener.lastSubscriptionMessage = msgStr;
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }

      if (nodeWs && nodeWs.readyState === WebSocket.OPEN) {
        nodeWs.send(message);
      }
    });

    ws.on('close', () => {
      // Önce nodeWs listener'ını kaldır
      if (nodeWs) {
        nodeWs.removeListener('message', handleNodeMessage);
      }
      
      // Active listeners array'inden kaldır
      const index = activeListeners.findIndex(l => l.ws === ws);
      if (index !== -1) {
        // Listener'ı array'den çıkarmadan önce tüm referanslarını temizle
        const listener = activeListeners[index];
        listener.ws = null;
        listener.handleNodeMessage = null;
        listener.lastSubscriptionMessage = null;
        activeListeners.splice(index, 1);
      }
      
      clearInterval(intervalId);
    });

    const intervalId = setInterval(async () => {
      if (await isNodeRestarting())
        ws.send(JSON.stringify({ error: 'node_is_restarting' }));
    }, 5000);
  });
});

connectToNode();

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
