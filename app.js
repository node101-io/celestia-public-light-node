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

const activeConnections = new Map(); // WebSocket bağlantılarını ve handler'ları saklamak için

const nodeWs = new ReconnectingWebSocket(LIGHT_NODE_ENDPOINT, [], {
  WebSocket: WebSocket,
  WebSocketOptions: {
    headers: {
      'Authorization': 'Bearer ' + process.env.CELESTIA_AUTH_KEY,
    }
  }
});

nodeWs.addEventListener('open', () => {
  console.log('✅ Successfully connected to light node');

  activeConnections.forEach((handler, ws) => {
    console.log(ws.readyState, WebSocket.OPEN);
    if (ws.readyState === WebSocket.OPEN)
      nodeWs.addEventListener('message', handler);
  });
});

wss.on('connection', (ws, req) => {  
  if (!req.headers['x-api-key'])
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (err, api_keys) => {
    if (err || !api_keys)
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

    if (await isNodeRestarting())
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));

    function handleNodeMessage(data) {
      ws.send(data.data);
    };

    nodeWs.addEventListener('message', handleNodeMessage);
    activeConnections.set(ws, handleNodeMessage); // Bağlantıyı ve handler'ı sakla

    ws.on('message', async (message) => {      
      if (await isNodeRestarting())
        return ws.send(JSON.stringify({ error: 'node_is_restarting' }));

      nodeWs.send(message);
    });

    ws.on('close', () => {
      nodeWs.removeEventListener('message', handleNodeMessage);
      activeConnections.delete(ws); // Bağlantı kapandığında Map'ten kaldır
    });
  });
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
