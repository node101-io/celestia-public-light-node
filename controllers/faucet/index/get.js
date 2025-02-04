import path from 'path';

export default (_req, res) => {
  return res.sendFile(path.resolve('./index.html'));
};
