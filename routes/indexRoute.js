const express = require('express');

const router = express.Router();

const faucetIndexGetController = require('../controllers/faucet/index/get');


router.get(
  '/',
  faucetIndexGetController
);

module.exports = router;
