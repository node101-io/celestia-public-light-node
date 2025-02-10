import mongoose from 'mongoose';
import validator from 'validator';

import { ApiKey } from '../api-key/ApiKey.js';

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

  if (!data.api_key || typeof data.api_key !== 'string' || !validator.isUUID(data.api_key))
    return callback('bad_request');

  ApiKey.findApiKeysByFilters({
    key: data.api_key
  }, (err, apiKey) => {
    if (err)
      return callback(err);

    Wallet.countDocuments({
      api_key: apiKey._id
    })
      .then(wallet_count => {
        if (wallet_count >= MAX_WALLET_PER_API_KEY)
          return callback('max_wallet_count');

        const walletName = apiKey.team_name + Date.now();

        createWalletInLightNode({
          wallet_name: walletName
        }, (err, wallet) => {
          if (err)
            return callback(err);

          Wallet.create({
            api_key: apiKey._id,
            address: wallet.address,
            mnemonic: wallet.mnemonic
          })
            .then(wallet => callback(null, wallet))
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
  });
};

WalletSchema.statics.findWalletsByApiKey = function (api_key, callback) {
  ApiKey.findApiKeysByFilters({
    key: api_key,
  }, (err, apiKey) => {
    if (err)
      return callback(err);

    Wallet.find({
      api_key: apiKey._id
    })
      .then(wallets => callback(null, wallets))
      .catch(err => {
        console.error(err);
        return callback('database_error');
      });
  });
};

export const Wallet = mongoose.model('Wallet', WalletSchema);
