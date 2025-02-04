import mongoose from 'mongoose';
import validator from 'validator';

import { createWalletInLightNode } from './functions/createWalletInLightNode.js';

const MAX_WALLET_PER_API_KEY = 3;

const WalletSchema = new mongoose.Schema({
  api_key: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey',
    required: true,
  },
  address: {
    type: String,
    required: true
  },
  mnemonic: {
    type: String,
    required: true
  }
});

WalletSchema.statics.createWallet = function (data, callback) {
  if (!data || typeof data !== 'object')
    return callback('bad_request');

  if (!data.api_key || !validator.isMongoId(data.api_key.toString()))
    return callback('bad_request');

  Wallet.find({
    api_key: data.api_key.toString()
  })
    .then(wallet_count => {
      if (wallet_count > MAX_WALLET_PER_API_KEY)
        return callback('max_wallet_count');

      createWalletInLightNode((err, wallet) => {
        if (err)
          return callback(err);

        Wallet.create({
          api_key: data.api_key,
          address: wallet.address,
          mnemonic: wallet.mnemonic
        })
          .then(wallet => callback(null, wallet._id.toString()))
          .catch(err => {
            console.error(err);
            return callback('database_error');
          });
      });
    })
    .catch(err => {
      console.error(err);
      return callback('database_error');
    });
};

export const Wallet = mongoose.model('Wallet', WalletSchema);
