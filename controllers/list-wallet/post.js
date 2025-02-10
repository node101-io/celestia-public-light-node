import { Wallet } from '../../models/wallet/Wallet.js';

export default (req, res) => {
  console.log('POST /list-wallet', req.headers['x-api-key']);

  Wallet.findWalletsByApiKey(req.headers['x-api-key'], (err, wallets) => {
    if (err)
      return res.json({ error: err });

    return res.json({
      wallets: wallets
    });
  });
};
