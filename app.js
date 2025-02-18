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

let nodeWs = new ReconnectingWebSocket(LIGHT_NODE_ENDPOINT, [], {
  WebSocket: WebSocket,
  WebSocketOptions: {
    headers: {
      'Authorization': 'Bearer ' + process.env.CELESTIA_AUTH_KEY,
    }
  }
});

console.log('Attempting initial connection to light node...');

nodeWs.addEventListener('open', () => {
  console.log('✅ Successfully connected to light node', {
    wsExists: !!nodeWs.ws,
    readyState: nodeWs.ws ? nodeWs.ws.readyState : 'no websocket'
  });
});
nodeWs.addEventListener('reconnect', () => {
  console.log('🔄 Attempting to reconnect to light node...', {
    wsExists: !!nodeWs.ws,
    readyState: nodeWs.ws ? nodeWs.ws.readyState : 'no websocket'
  });
});
nodeWs.addEventListener('error', (error) => {
  console.error('❌ Light node connection error:', error, {
    wsExists: !!nodeWs.ws,
    readyState: nodeWs.ws ? nodeWs.ws.readyState : 'no websocket'
  });
});
nodeWs.addEventListener('close', () => {
  console.log('❌ Disconnected from light node', {
    wsExists: !!nodeWs.ws,
    readyState: nodeWs.ws ? nodeWs.ws.readyState : 'no websocket'
  });
});

wss.on('connection', (ws, req) => {
  console.log('📱 New client connection attempt from IP:', req.socket.remoteAddress);
  
  if (!req.headers['x-api-key']) {
    console.log('❌ Client connection rejected: No API key provided');
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));
  }

  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (err, api_keys) => {
    if (err || !api_keys) {
      console.log('❌ Client connection rejected: Invalid API key');
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));
    }

    console.log('✅ Client authenticated successfully');

    if (await isNodeRestarting()) {
      console.log('⚠️ Warning client: Node is restarting');
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));
    }

    const handleNodeMessage = (data) => {
      ws.send(data.data);
    };

    nodeWs.addEventListener('message', handleNodeMessage);

    ws.on('message', async (message) => {
      console.log('📥 Received message from client:', message.toString().substring(0, 100) + '...');
      
      if (await isNodeRestarting()) {
        console.log('⚠️ Rejecting client message: Node is restarting');
        return ws.send(JSON.stringify({ error: 'node_is_restarting' }));
      }

      const tryToSendMessage = () => {
        nodeWs.send(message);
      };

      tryToSendMessage();
    });

    ws.on('close', () => {
      console.log('👋 Client disconnected, cleaning up listeners');
      nodeWs.removeListener('message', handleNodeMessage);
    });

    const intervalId = setInterval(async () => {
      if (await isNodeRestarting()) {
        console.log('⚠️ Periodic check: Warning client about node restart');
        ws.send(JSON.stringify({ error: 'node_is_restarting' }));
      }
    }, 5000);

    ws.on('close', () => {
      console.log('🧹 Clearing periodic restart check interval');
      clearInterval(intervalId);
    });
  });
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
