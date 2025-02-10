import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';

import config from './config.js';

import isAuthenticated from './middlewares/isAuthenticated.js';

import configGetController from './controllers/config/get.js';
import faucetSendGetController from './controllers/faucet/send/[address]/get.js';

import createWalletPostController from './controllers/create-wallet/post.js';
import rpcPostController from './controllers/rpc/post.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/celestia');

const app = express();

const PORT = config.port || 3000;

app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

app.get('/faucet/send/:address',
  faucetSendGetController
);
app.get('/config',
  configGetController
);

app.post('/create-wallet',
  isAuthenticated,
  createWalletPostController
);
app.post('/rpc',
  isAuthenticated,
  rpcPostController
);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
