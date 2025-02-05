import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

const LOCAL_ENDPOINT_LIGHT_NODE = 'http://localhost:10102';

if (!process.env.CELESTIA_AUTH_KEY)
  console.error('CELESTIA_AUTH_KEY is not set!');

export default (req, res) => {
  console.log('POST /rpc', req.headers['x-api-key']);

  fetch(LOCAL_ENDPOINT_LIGHT_NODE, {
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
