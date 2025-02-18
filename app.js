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

let nodeWs = null; // Light node WebSocket bağlantısı
const clients = new Map(); // Connected clients

const connectToNode = () => {
  try {
    nodeWs = new WebSocket(LIGHT_NODE_ENDPOINT);

    nodeWs.on('open', () => {
      console.log('Connected to light node');
    });

    nodeWs.on('message', (data) => {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    });

    nodeWs.on('close', () => {
      console.log('Disconnected from light node, attempting to reconnect...');
      setTimeout(connectToNode, 5000);
    });

    nodeWs.on('error', (error) => {
      console.error('Light node connection error:', error);
      nodeWs.close();
    });
  } catch (error) {
    console.error('Failed to connect to light node:', error);
    setTimeout(connectToNode, 5000);
  }
};

connectToNode();

wss.on('connection', (ws, req) => {
  if (!req.headers['x-api-key']) {
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));
  }

  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (err, api_keys) => {
    if (err || !api_keys) {
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));
    }

    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);

    if (await isNodeRestarting()) {
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));
    }

    ws.on('message', async (message) => {
      try {
        if (await isNodeRestarting()) {
          ws.send(JSON.stringify({ error: 'node_is_restarting' }));
          return;
        }

        if (nodeWs && nodeWs.readyState === WebSocket.OPEN) {
          nodeWs.send(message);
        }
      } catch (error) {
        ws.send(JSON.stringify({ error: 'internal_server_error' }));
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });

    const intervalId = setInterval(async () => {
      if (await isNodeRestarting()) {
        ws.send(JSON.stringify({ error: 'node_is_restarting' }));
      }
    }, 5000);

    ws.on('close', () => {
      clearInterval(intervalId);
    });
  });
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
