import { Wallet } from '../../models/wallet/Wallet.js';

export default (req, res) => {
  Wallet.createWallet({
    api_key: req.headers['x-api-key']
  })
    .then(wallet => res.json({
      address: wallet.address,
      mnemonic: wallet.mnemonic
    }))
    .catch(err => res.json({ error: err }));
};
