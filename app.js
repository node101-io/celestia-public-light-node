import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';

import config from './config.js';

import isAuthenticated from './middlewares/isAuthenticated.js';

import faucetIndexGetController from './controllers/faucet/index/get.js';
import faucetSendGetController from './controllers/faucet/send/[address]/get.js';
import createWalletPostController from './controllers/create-wallet/post.js';
import rpcPostController from './controllers/rpc/post.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celestia');

const app = express();

const PORT = config.port || 3000;

app.use(express.json());

app.get('/faucet', faucetIndexGetController);
app.get('/faucet/send/:address', faucetSendGetController);

app.post('/create-wallet',
  isAuthenticated,
  createWalletPostController
);

app.use('/rpc',
  isAuthenticated,
  rpcPostController
);

app.listen(PORT, () => {
  console.log(`Faucet app listening on port ${PORT}`);
});
