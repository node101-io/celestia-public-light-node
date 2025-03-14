# gMammoth 🦣

Welcome to **Mammothon**—happy coding! ��

## Introduction

Building on blockchains can be challenging, especially when it comes to handling **nodes**—particularly **light nodes**. While running a light node is relatively simple, developers often prefer to focus on building rather than managing infrastructure, especially during high-stakes hackathons like **Mammothon**.

To ease this burden, **[node101](https://node101.io)** is offering you access to a **public [Celestia](https://celestia.org) light node**. But that's not all! We also provide:

- A **faucet interface** for requesting testnet $TIA.
- A **wallet creation service** on top of our light node RPC.
- A **public API** for interacting with Celestia's network.

This guide will walk you through how to use these resources efficiently.

## 1. Create a Remote Wallet on the Node 🔐

To ensure fair usage and prevent overload, access to the Celestia node requires an **API key**.

### Requesting an API Key

To interact with the Celestia node (including **wallet creation** and **API operations**), you need to **request an API key** from us. This ensures that only **you and your team** can access your registered wallet.

### Creating a Wallet

Once you have received your **API key**, you can create a wallet by running the following command in your terminal:

```sh
curl -X POST "https://mammothon-public-light.node101.io/wallet/create" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $YOUR_API_KEY"
```

### Expected Response

Upon successful wallet creation, you will receive a response similar to this:

```json
{
  "address": "celestia1jncle3qpcr0e9xnaqzpzhkyf4yaw8wvfepulua",
  "mnemonic": "rent emotion abuse leg embark grocery anchor anger street summer practice swing title hip taste tackle artwork table day load clarify accident can clean"
}
```

> **Important:** Keep your **mnemonic phrase** secure, as it is required to access your wallet.

### Listing Wallets

To list the wallets you have created, run the following command:

```sh
curl -X POST "https://mammothon-public-light.node101.io/wallet/list" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $YOUR_API_KEY"
```

You will receive a response like this:

```json
{
  "wallets": [
    {
      "address": "celestia1jncle3qpcr0e9xnaqzpzhkyf4yaw8wvfepulua",
      "mnemonic": "rent emotion abuse leg embark grocery anchor anger street summer practice swing title hip taste tackle artwork table day load clarify accident can clean"
    }
  ]
}
```

## 2. Request Testnet $TIA via the Faucet 🚰

To request testnet $TIA, follow these simple steps:

1. Go to [Faucet](https://mammothon-public-light.node101.io/faucet).
2. Enter your **Celestia wallet address** (must start with the prefix **"celestia"**).
3. Click the **"Request Tokens"** button.
4. Your tokens will arrive in approximately **6 seconds**.
5. You can verify your transaction via **[Celenium](https://mocha-4.celenium.io)** once it is processed.

> **Note:**
> - You can request tokens **only once every 24 hours**.
> - Each request provides **10 $TIA**.

## 3. Send Celestia Node API Requests to the Public Light Node 🌐

Once you have a funded wallet on the node and your API key, you are ready to send API requests freely.

> **Note 1:** We do not require a Celestia Authorization Key as we handle authentication through the API key provided to you.

> **Note 2:** To prevent overload, you can send 10 requests per minute.

### WebSocket Connection

For real-time communication with the node, you can use our WebSocket endpoint:

```javascript
const ws = new WebSocket('wss://mammothon-public-light.node101.io/ws', {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});

// Handle incoming messages
ws.on('message', (event) => {
  console.log('Received:', event.data);
});

// Handle connection closure
ws.on('close', (event) => {
  if (event.code === 1000)
    console.log('Connection closed. Please reconnect after 10 seconds.');
});

// Send messages to the node
ws.send(yourMessage);
```

> **Important:** The WebSocket connection will be terminated if the node undergoes a restart. These restarts are necessary to integrate newly created wallets into the node's keyring. When this happens, you'll receive a closure event with the reason `node_is_restarting`. It's recommended to implement a reconnection strategy with an appropriate delay.

### Example API Requests

Below are some example requests to help you interact with Celestia using your API key.

#### Check Node Readiness

```sh
curl -X POST "https://mammothon-public-light.node101.io/rpc" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $YOUR_API_KEY" \
    --data '{
        "id": 1,
        "jsonrpc": "2.0",
        "method": "node.Ready",
        "params": []
    }'
```

Expected Response:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": true
}
```

#### Check Wallet Balance

```sh
curl -X POST "https://mammothon-public-light.node101.io/rpc" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $YOUR_API_KEY" \
    --data '{
        "id": 1,
        "jsonrpc": "2.0",
        "method": "state.BalanceForAddress",
        "params": [
            "celestia1qyuwqj0cxe6hlzjru587nygwwmgh03haqnmut7"
        ]
    }'
```

Expected Response:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "denom": "utia",
    "amount": "3495502772"
  }
}
```

#### Submit a Blob

```sh
curl -X POST "https://mammothon-public-light.node101.io/rpc" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    --data '{
        "id": 1,
        "jsonrpc": "2.0",
        "method": "blob.Submit",
        "params": [
            [
                {
                    "namespace": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAMJ/xGlNMdE=",
                    "data": "$HEX_ENCODED_DATA"
                }
            ],
            {
                "gas_price": 0.002,
                "is_gas_price_set": true,
                "signer_address": "$YOUR_WALLET_ADDRESS"
            }
        ]
    }'
```

Expected Response:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": 4635443
}
```

#### Get All Blobs under a given Namespace by Block Height

```sh
curl -X POST "https://mammothon-public-light.node101.io/rpc" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    --data '{
        "id": 1,
        "jsonrpc": "2.0",
        "method": "blob.GetAll",
        "params": [
            4635443,
            [
               "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAMJ/xGlNMdE="
            ]
        ]
    }'
```

Expected Response:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": [
    {
      "namespace": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAMJ/xGlNMdE=",
      "data": "$HEX_ENCODED_DATA",
      "share_version": 0,
      "commitment": "aHlbp+J9yub6hw/uhK6dP8hBLR2mFy78XNRRdLf2794=",
      "index": 9
    }
  ]
}
```

---

For further API calls and documentation, please refer to: [Celestia Node RPC Docs](https://node-rpc-docs.celestia.org)

Happy hacking at **Mammothon**! 🚀🔥
