import {
  checkIPAndWalletAddressLimit,
  updateRateLimitHistory,
} from '../../../../utils/checker.js';
import sendToken from '../../../../utils/sendToken.js';

export default (req, res) => {
  const address = req.params.address;

  if (!address || typeof address !== 'string' || !address.trim().length)
    return res.send({ result: 'address is required' });

  if (!address.startsWith(config.sender.option.prefix))
    return res.send({ result: `Address [${address}] is not supported.` });

  checkIPAndWalletAddressLimit(req.ip, address, (err) => {
    if (err) return res.send({ result: 'You requested too often' });

    updateRateLimitHistory(req.ip, (err, result) => {
      if (err) return res.send({ result: 'Failed, Please contact to admin.' });

      sendToken(address, (err, result) => {
        console.log(err, result);
        if (err) return res.send({ result: 'Failed, Please contact to admin.' });

        updateRateLimitHistory(address, (err, ret) => {
          if (err)
            return res.send({ result: 'Failed, Please contact to admin.' });

          return res.send({ result: ret });
        });
      });
    });
  });
};
