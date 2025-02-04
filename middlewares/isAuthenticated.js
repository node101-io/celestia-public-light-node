import { ApiKey } from '../models/api-key/ApiKey.js';

export default (req, res, next) => {
  ApiKey.findApiKeysByFilters({
    key: req.headers['x-api-key']
  }, (err) => {
    if (err)
      return res.json({ error: 'unauthorized' });

    return next();
  });
};
