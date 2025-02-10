import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit'

import config from './config.js';

import isAuthenticated from './middlewares/isAuthenticated.js';

import configGetController from './controllers/config/get.js';
import faucetSendGetController from './controllers/faucet/send/[address]/get.js';

import createWalletPostController from './controllers/create-wallet/post.js';
import listWalletPostController from './controllers/list-wallet/post.js';
import rpcPostController from './controllers/rpc/post.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/celestia');

const app = express();

const PORT = config.port || 3000;

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2,
  message: {
    error: 'Too many requests, please try again in a minute.'
  }
});

app.use(express.json());
app.use(express.static('public', { extensions: ['html'] }));

app.get('/faucet/send/:address',
  faucetSendGetController
);
app.get('/config',
  configGetController
);

app.post('/list-wallet',
  isAuthenticated,
  listWalletPostController
);
app.post('/create-wallet',
  isAuthenticated,
  createWalletPostController
);
app.post('/rpc',
  isAuthenticated,
  rateLimiter,
  rpcPostController
);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
