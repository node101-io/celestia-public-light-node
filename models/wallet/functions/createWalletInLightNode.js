import childProcess from 'child_process';

const CREATE_WALLET_IN_LIGHT_NODE_COMMAND = data => `
  docker exec celestia-light-node bash -c '
    cel-key add ${data.wallet_name} \
      --keyring-backend test \
      --node.type light \
      --p2p.network mocha \
      --output json
  '
`;

export const createWalletInLightNode = (data, callback) => {
  if (!data || typeof data !== 'object')
    return callback('bad_request');

  if (!data.wallet_name || typeof data.wallet_name !== 'string')
    return callback('bad_request');

  childProcess.exec(CREATE_WALLET_IN_LIGHT_NODE_COMMAND(data), (err, stderr, stdout) => {
    if (err)
      return callback('light_node_error');

    const wallet = JSON.parse(stdout);

    return callback(null, {
      address: wallet.address,
      mnemonic: wallet.mnemonic
    });
  });
};
