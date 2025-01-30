const appconfig = require("../config");
const config = appconfig.InitConfig();

const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { SigningStargateClient } = require("@cosmjs/stargate");

module.exports = (recipient, callback) => {
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
          .then((result) => callback(null, result));
      });
    })
    .catch((err) => callback(err));
};
