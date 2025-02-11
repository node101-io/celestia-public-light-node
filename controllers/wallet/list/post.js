import { Wallet } from '../../../models/wallet/Wallet.js';

export default async (req, res) => {
  console.log('POST /list-wallet', req.headers['x-api-key']);

  if (await isNodeRestarting())
    return res.json({ error: 'node_is_restarting' });

  Wallet.findWalletsByApiKey(req.headers['x-api-key'], (err, wallets) => {
    if (err)
      return res.json({ error: err });

    return res.json({
      wallets: wallets
    });
  });
};
