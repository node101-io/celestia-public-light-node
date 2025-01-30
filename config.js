require('dotenv').config();

var appconfig = {
  port: 3000,
  db: {
    path: "./db/faucet.db",
  },
  project: {
    name: "Celestia Mammothon Faucet Light Node Interface",
    logo: "",
    deployer: '',
  },
  blockchain: {
    rpcendpoint: process.env.RPC_ENDPOINT || "",
  },
  sender: {
    mnemonic: process.env.MNEMONIC || "",
    option: {
      prefix: "celestia",
    },
  },
  tx: {
    amount: {
      denom: "utia",
      amount: "10000",
    },
    fee: {
      amount: [
        {
          amount: "20000",
          denom: "utia",
        },
      ],
      gas: "200000",
    },
  },
  limit: {
    hours: 24,
    address: 10,
    ip: 10,
  },
};

var initialized = false;

appconfig.get = function (key) {
  const keyParts = key
    .replace(/^COSMOS_FAUCET_/, "")
    .toLowerCase()
    .split("_");

  let current = this;
  for (let i = 0; i < keyParts.length - 1; i++) {
    current = current[keyParts[i]];
  }

  return current[keyParts[keyParts.length - 1]];
};

appconfig.set = function (key, value) {
  const keyParts = key
    .replace(/^COSMOS_FAUCET_/, "")
    .toLowerCase()
    .split("_");

  let current = this;
  for (let i = 0; i < keyParts.length - 1; i++) {
    current = current[keyParts[i]];
  }

  current[keyParts[keyParts.length - 1]] = value.replace(/^"|"$/g, "");
};

function InitConfig() {
  if (initialized) {
    return appconfig;
  }

  Object.entries(process.env)
    .map(([key, value]) => ({
      key,
      value,
    }))
    .filter(
      (x) =>
        x.key.startsWith("COSMOS_FAUCET_") &&
        x.value != null &&
        x.value.trim() != "" &&
        x.value != undefined
    )
    .forEach((x) => {
      console.log("Setting", x.key, x.value);
      appconfig.set(x.key, x.value);
    });

  console.log(appconfig);

  initialized = true;

  return appconfig;
}

module.exports = { InitConfig };
