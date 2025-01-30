# Faucet

Genel Cosmos SDK blokzincirleri için bir facuet, bzlab için refactor edilmiştir.

## Kurulum
 - `./config.json` içindeki her şeyi ihtiyacınıza göre değiştirin:
 ```json
{
    "port": 3000, // faucet'in serve edileceği port
    "db": {
        "path": "./db/faucet.db" // veritabanı yolu
    },
    "project": {
        "name": "BZLab Chain", // proje adı, frontendde görünecek
        "logo": "https://tubitak.gov.tr/sites/default/files/2023-08/logo.svg", // proje logosu, frontendde görünecek
        "deployer": "<a href=\"https://blokzincir.bilgem.tubitak.gov.tr/\">BZLAB</a>" // proje deployerı, frontendde görünecek
    },
    "blockchain": {
        "rpc_endpoint": "https://rpc.sentry-02.theta-testnet.polypore.xyz" // tx göndermek için kullanılacak rpc endpointi
    },
    "sender": {
        "mnemonic": "surround miss nominee dream gap cross assault thank captain prosper drop duty group candy wealth weather scale put", // faucetin tx göndermek için kullanacağı cüzdanın mnemonic'i
        "option": {
            "prefix": "cosmos" // cüzdan adresinin prefixi
        }
    },
    "tx": {
        "amount": {
            "denom": "uatom", // gönderilecek tokenin denomu
            "amount": "10000" // gönderilecek token miktarı
        },
        "fee": {
            "amount": [
                {
                    "amount": "1000", // tx ücreti
                    "denom": "uatom" // tx ücreti
                }
            ],
            "gas": "200000" // tx gas limiti
        }
    },
    "limit": {
        "hours": 24, // kaç saatte bir faucet kullanılabileceği
        "address": 1, // bir adresin belirtilen süre içinde kaç kez faucet kullanabileceği
        "ip": 10 // bir ip adresinin belirtilen süre içinde kaç kez faucet kullanabileceği
    }
}
```
