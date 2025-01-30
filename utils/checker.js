const { Level } = require("level");

const appconfig = require("../config");

const config = appconfig.InitConfig();

const LIMIT_TIME = config.limit.hours * 60 * 60 * 1000;

function isUnderLimit(value, limit) {
  return (
    value && value.filter((x) => Date.now() - x < LIMIT_TIME).length < limit
  );
}

const db = new Level(config.db.path, { valueEncoding: "json" });

module.exports = {
  checkIPAndWalletAddressLimit(ip, address, callback) {
    console.log("checkIPAndWalletAddressLimit");
    db.get(ip, (err, ip_history) => {
      if (!err && !isUnderLimit(ip_history, config.limit.ip))
        return callback("You requested too often");
      console.log(ip_history);
      db.get(address, (err, address_history) => {
        if (!err && !isUnderLimit(address_history, config.limit.address))
          return callback("You requested too often");

        return callback(null);
      });
    });
  },
  update(key, callback) {
    db.get(key, (err, history) => {
      if (!history || !Array.isArray(history)) history = [];

      history.push(Date.now());

      db.put(key, history, (err, result) => {
        if (err) return callback(err);

        return callback(null, result);
      });
    });
  },
};
