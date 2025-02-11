import 'dotenv/config';

export default {
  port: 3000,
  db: {
    path: './db/faucet.db',
  },
  project: {
    name: 'Celestia Mammothon',
    logo: '/img/logo.webp',
  },
  blockchain: {
    rpcendpoint: 'https://rpc-mocha.pops.one',
  },
  sender: {
    mnemonic: process.env.MNEMONIC || '',
    option: {
      prefix: 'celestia',
    },
  },
  tx: {
    amount: {
      denom: 'utia',
      amount: '10000000',
    },
    fee: {
      amount: [
        {
          amount: '20000',
          denom: 'utia',
        },
      ],
      gas: '200000',
    },
  },
  limit: {
    hours: 24,
    address: 1,
    ip: 10,
  }
};
