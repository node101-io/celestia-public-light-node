import childProcess from 'child_process';

import { setNodeRestarting } from '../../../utils/nodeStatus.js';

const CREATE_WALLET_IN_LIGHT_NODE_COMMAND = data => `
  docker exec celestia-light-node bash -c '
    cel-key add ${data.wallet_name} \
      --keyring-backend test \
      --node.type light \
      --p2p.network mocha \
      --output json
  '
`;
const RESTART_LIGHT_NODE_COMMAND = `docker restart celestia-light-node`;

export const createWalletInLightNode = (data, callback) => {
  if (!data || typeof data !== 'object')
    return callback('bad_request');

  if (!data.wallet_name || typeof data.wallet_name !== 'string')
    return callback('bad_request');

  childProcess.exec(CREATE_WALLET_IN_LIGHT_NODE_COMMAND(data), (err, stderr, stdout) => {
    if (err)
      return callback('light_node_error');

    const wallet = JSON.parse(stdout);

    setNodeRestarting(true);
    childProcess.exec(RESTART_LIGHT_NODE_COMMAND, (err, stderr, stdout) => {
      setNodeRestarting(false);

      if (err)
        return callback('light_node_error');

      return callback(null, {
        address: wallet.address,
        mnemonic: wallet.mnemonic
      });
    });
  });
};
