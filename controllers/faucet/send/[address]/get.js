import { transaction } from 'starknet';
import config from '../../../../config.js';
import {
  checkIPAndWalletAddressLimit,
  updateRateLimitHistory,
} from '../../../../utils/rateLimitChecker.js';
import sendToken from '../../../../utils/sendToken.js';

export default (req, res) => {
  console.log('GET /faucet/send/:address', req.params.address);

  const address = req.params.address;

  if (!address || typeof address !== 'string' || !address.trim().length)
    return res.send({
      code: 0,
      result: 'address is required'
    });

  if (!address.startsWith(config.sender.option.prefix))
    return res.send({
      code: 0,
      result: `Address [${address}] is not supported.`
    });

  checkIPAndWalletAddressLimit(req.ip, address, (err) => {
    if (err) return res.send({
      code: 0,
      result: 'You requested too often'
    });

    updateRateLimitHistory(req.ip, (err, result) => {
      if (err) return res.send({
        code: 0,
        result: 'Failed, Please contact to admin.'
      });

      sendToken(address, (err, result) => {
        if (err) return res.send({
          code: 0,
          result: 'Failed, Please contact to admin.'
        });

        updateRateLimitHistory(address, (err, ret) => {
          if (err)
            return res.send({
              code: 0,
              result: 'Failed, Please contact to admin.'
            });

          return res.send({
            code: 1,
            result: 'Success',
            transactionHash: result.transactionHash
          });
        });
      });
    });
  });
};
