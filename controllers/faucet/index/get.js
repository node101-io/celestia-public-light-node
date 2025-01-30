module.exports = (req, res) => {
  return res.render('faucet/index', {
    page: 'faucet/index',
    title: 'Faucet',
    includes: {
      external: {
        css: [],
        js: []
      }
    },
  });
};