import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';

import config from '../config.js';

export default (recipient, callback) => {
  DirectSecp256k1HdWallet.fromMnemonic(config.sender.mnemonic, {
    prefix: config.sender.option.prefix,
  })
    .then((wallet) => {
      return wallet.getAccounts().then((accounts) => {
        return SigningStargateClient.connectWithSigner(
          config.blockchain.rpcendpoint,
          wallet
        )
          .then((client) =>
            client.sendTokens(
              accounts[0].address,
              recipient,
              [config.tx.amount],
              config.tx.fee
            )
          )
          .then((result) => {
            console.log("Result:", result);
            callback(null, result);
        });
      });
    })
    .catch((err) => callback(err));
};
