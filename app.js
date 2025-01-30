const express = require("express");
const path = require("path");

const frequencyChecker = require("./utils/checker");
const sendToken = require("./utils/sendToken");

const { InitConfig } = require("./config");

const app = express();

const appconfig = InitConfig();
const PORT = appconfig.port || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

const faucetIndexController = require('./routes/indexRoute');
app.use('/', faucetIndexController);

app.get("/config", (req, res) => {
  return res.send({
    ...appconfig.project,
    prefix: appconfig.sender.option.prefix,
  });
});

app.get("/send/:address", (req, res) => {
  const address = req.params.address;

  if (!address || typeof address !== "string" || !address.trim().length)
    return res.send({ result: "address is required" });

  if (!address.startsWith(appconfig.sender.option.prefix))
    return res.send({ result: `Address [${address}] is not supported.` });

  frequencyChecker.checkIPAndWalletAddressLimit(req.ip, address, (err) => {
    if (err) return res.send({ result: "You requested too often" });

    frequencyChecker.update(req.ip, (err, result) => {
      if (err) return res.send({ result: "Failed, Please contact to admin." });

      sendToken(address, (err, result) => {
        console.log(err, result);
        if (err) return res.send({ result: "Failed, Please contact to admin." });

        frequencyChecker.update(address, (err, ret) => {
          if (err)
            return res.send({ result: "Failed, Please contact to admin." });

          return res.send({ result: ret });
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Faucet app listening on port ${PORT}`);
});
