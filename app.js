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
// İstemci Bazında Ayrı İşlem Yönetimi için Gerekli Yapı

// Her client bağlantısına ait; handler ile saklayacağımız ek state nesnesi
// buradaki obje, örneğin abonelik/subscribe mesajını saklamak için kullanılıyor.
const activeConnections = new Map();

/**
 * Her istemci (client) için node'dan gelecek mesajları dinleyen handler döndürür.
 * Eğer mesaj, client'a ait işlem veya sorgu içeriyorsa filtreleme yapabilirsiniz.
 */
function createClientHandler(clientWs) {
  return function handleNodeMessage(event) {
    try {
      const messageData = JSON.parse(event.data);
      // Eğer mesajın içinde abonelik kimliği ya da client'a ait başka tanımlayıcı varsa
      // burada filtreleme yapabilirsiniz.
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(messageData));
      }
    } catch (error) {
      console.error('İstemci mesajı işlenirken hata oluştu:', error);
    }
  };
}

/**
 * Node (light node) ile yeniden bağlanmayı (reconnect) yöneten fonksiyon.
 * ReconnectingWebSocket nesnesini oluşturuyor ve 'open' eventinde,
 * mevcut tüm client handler'larını yeniden ekleyip, eğer varsa saklanan abonelik mesajını
 * node'a yeniden gönderiyor.
 */
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
    console.log('✅ Light node ile bağlantı kuruldu (veya yeniden bağlanıldı).');

    // Tüm aktif client bağlantıları için:
    activeConnections.forEach((clientData, clientWs) => {
      // Önce eski handler'ı kaldırıp, aynı handler'ı yeniden ekliyoruz.
      nodeWs.removeEventListener('message', clientData.handler);
      nodeWs.addEventListener('message', clientData.handler);

      // Eğer client, daha önce bir abonelik mesajı (örneğin "blob.Subscribe") gönderdiyse,
      // node restart sonrası bu mesajı yeniden göndermek gerekebilir.
      if (clientData.lastMessage) {
        console.log('Client için abonelik mesajı yeniden gönderiliyor:', clientData.lastMessage);
        nodeWs.send(clientData.lastMessage);
      }
    });
  });

  nodeWs.addEventListener('close', () => {
    console.log('Light node ile bağlantı kapandı.');
  });
  nodeWs.addEventListener('error', (err) => {
    console.error('Light node bağlantı hatası:', err);
  });

  return nodeWs;
}

// Tek bir global nodeWs örneği kullanıyoruz:
const nodeWs = nodeWsSetup();

////////////////////////////////////////////////////////////////////////////
// WebSocket Sunucu (wss) ile İstemci Bağlantılarının Yönetimi

wss.on('connection', (ws, req) => {
  // İstemciden x-api-key header'ı gelmiyorsa bağlantıyı hemen kapatıyoruz.
  if (!req.headers['x-api-key']) {
    return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));
  }

  // API key doğrulaması (model üzerinden)
  ApiKey.findApiKeysByFilters({ key: req.headers['x-api-key'] }, async (
    err,
    api_keys
  ) => {
    if (err || !api_keys)
      return ws.close(1000, JSON.stringify({ error: 'unauthorized' }));

    if (await isNodeRestarting())
      ws.send(JSON.stringify({ error: 'node_is_restarting' }));

    // Her client için node mesajlarını dinleyecek özel handler'ı oluşturuyoruz.
    const clientHandler = createClientHandler(ws);

    // Her client bağlantısı için; handler ve client'a ait state bilgisini saklıyoruz.
    activeConnections.set(ws, { handler: clientHandler, lastMessage: null });

    // İstemciden gelen mesajları; nodeWs üzerinden light node'a iletmek için:
    ws.on('message', async (message) => {
      if (await isNodeRestarting())
        return ws.send(JSON.stringify({ error: 'node_is_restarting' }));

      // Gönderilen mesajı parse edip, örneğin "blob.Subscribe" gibi mesajları
      // saklamak için kullanıyoruz. Böylece node restart sonrası aynı mesajı yeniden
      // gönderebiliriz.
      try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.method === 'blob.Subscribe') {
          // Client'ın abonelik mesajını saklıyoruz.
          const clientData = activeConnections.get(ws);
          if (clientData) clientData.lastMessage = message;
        }
      } catch (e) {
        console.error('Client mesajı parse edilirken hata:', e);
      }

      // İstemci mesajını light node'a gönderiyoruz:
      nodeWs.send(message);
    });

    // Client bağlantısı kapandığında; handler'ı kaldırıp, saklanan state bilgisini temizliyoruz.
    ws.on('close', () => {
      nodeWs.removeEventListener('message', clientHandler);
      activeConnections.delete(ws);
    });
  });
});

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
