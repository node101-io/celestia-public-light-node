import { ApiKey } from '../models/api-key/ApiKey.js';

export default (req, res, next) => {
  if (!req.headers['x-api-key'])
    return res.json({ error: 'unauthorized' });

  ApiKey.findApiKeysByFilters({
    key: req.headers['x-api-key']
  }, (err, api_keys) => {
    if (err || !api_keys)
      return res.json({ error: 'unauthorized' });

    return next();
  });
};
