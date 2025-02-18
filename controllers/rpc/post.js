import path from 'path';
import dotenv from 'dotenv';

import { isNodeRestarting } from '../../utils/nodeStatus.js';
import { LIGHT_NODE_ENDPOINT } from '../../app.js';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

if (!process.env.CELESTIA_AUTH_KEY)
  console.error('CELESTIA_AUTH_KEY is not set!');

export default async (req, res) => {
  console.log('POST /rpc', req.headers['x-api-key']);

  if (await isNodeRestarting())
    return res.json({ error: 'node_is_restarting' });

  fetch(LIGHT_NODE_ENDPOINT, {
    method: req.method,
    headers: {
      'Authorization': 'Bearer ' + process.env.CELESTIA_AUTH_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  })
    .then(response => response.json())
    .then(data => res.json(data))
    .catch(_ => res.json({ error: 'light_node_error' }));
};
