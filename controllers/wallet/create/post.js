import { Wallet } from '../../../models/wallet/Wallet.js';

export default (req, res) => {
  console.log('POST /create-wallet', req.headers['x-api-key']);

  Wallet.createWallet({
    api_key: req.headers['x-api-key']
  }, (err, wallet) => {
    if (err)
      return res.json({ error: err });

    return res.json({
      address: wallet.address,
      mnemonic: wallet.mnemonic
    });
  });
};
