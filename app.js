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
// İstemci bazında ayrı handler yönetimi

// Her istemci için handler referanslarını saklamak için Map
const activeConnections = new Map();

// Her istemci için özel handler oluşturma fonksiyonu
function createClientHandler(clientWs) {
  return function handleNodeMessage(event) {
    try {
      const messageData = JSON.parse(event.data);
      // Burada mesaj içeriğine göre filtreleme yapabilirsiniz.
      // Örneğin, mesajın bir requestId'si varsa ve bu client'a aitse,
      // sadece o durumda mesajı iletebilirsiniz.
      // Aşağıdaki örnekte tüm gelen mesajı ilgili client'a gönderiyoruz.
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(messageData));
      }
    } catch (err) {
      console.error('Hata: İstemci mesajı işlenirken:', err);
    }
  };
}

// Light node ile reconnect olduğunda, tüm aktif client handler'larını yeniden ekliyoruz
nodeWsSetup();

function nodeWsSetup() {
  const nodeWs = new ReconnectingWebSocket(LIGHT_NODE_ENDPOINT, [], {
    WebSocket: WebSocket,
    WebSocketOptions: {
      headers: {
        'Authorization': 'Bearer ' + process.env.CELESTIA_AUTH_KEY
      }
    }
  });

  nodeWs.addEventListener('open', () => {
    console.log('✅ Successfully connected to light node');
    // Bağlı tüm istemciler için handler'ları yeniden ekle
    activeConnections.forEach((handler, clientWs) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        // Önce eski handler'ı kaldırıp, aynı handler'ı yeniden ekleyelim
        nodeWs.removeEventListener('message', handler);
        nodeWs.addEventListener('message', handler);
      }
    });
  });

  // Gerekirse nodeWs üzerinde hata ya da reconnect event'lerini de dinleyebilirsiniz

  // İstemciden gelen mesajları nodeWs'e iletirken kullanılacak referansa erişmek için
  // nodeWs örneğini dışa aktarabilir veya active reconnection kontrolü yapabilirsiniz.
  return nodeWs;
}

// nodeWs değişkenini dışarıda görmek için:
const nodeWs = nodeWsSetup();

wss.on('connection', (ws, req) => {
  // API key kontrolü
  if (!req.headers['x-api-key'])
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

  // API key doğrulamasını gerçekleştirme
  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (
    err,
    api_keys
  ) => {
    if (err || !api_keys)
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

    if (await isNodeRestarting())
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));

    // Client'e özel mesaj handler'ını oluştur
    const clientHandler = createClientHandler(ws);
    nodeWs.addEventListener('message', clientHandler);
    activeConnections.set(ws, clientHandler);

    // İstemciden gelen mesajları light node'a gönder
    ws.on('message', async (message) => {
      if (await isNodeRestarting())
        return ws.send(JSON.stringify({ error: 'node_is_restarting' }));

      // Gerekirse burada client mesajı üzerinde ön işleme yapabilirsiniz
      nodeWs.send(message);
    });

    // Client bağlantısı kapandığında handler'ı kaldır ve Map'ten temizle
    ws.on('close', () => {
      nodeWs.removeEventListener('message', clientHandler);
      activeConnections.delete(ws);
    });
  });
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
