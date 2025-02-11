import { Wallet } from '../../../models/wallet/Wallet.js';
import { isNodeRestarting } from '../../../utils/nodeStatus.js';

export default async (req, res) => {
  console.log('POST /create-wallet', req.headers['x-api-key']);

  if (await isNodeRestarting())
    return res.json({ error: 'node_is_restarting' });

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
