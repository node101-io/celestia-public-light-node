import config from '../../config.js';

export default (req, res) => {
  return res.send({
    ...config.project,
    prefix: config.sender.option.prefix,
  });
};
