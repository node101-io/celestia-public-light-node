import childProcess from 'child_process';

const RESTART_LIGHT_NODE_COMMAND = `docker restart celestia-light-node`;

export default (callback) => {
  childProcess.exec(RESTART_LIGHT_NODE_COMMAND, (err, stderr, stdout) => {
    if (err)
      return callback('light_node_error');

    return callback(null);
  });
};
