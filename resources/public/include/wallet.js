const nearAPI = require('near-api-js');

// TODO fixme
// TODO fix process.env ??
const CONTRACT_NAME = 'near4.isonar.testnet';

module.exports.wallet = (function() {
  const self = {
    elems: {
      connectWalletButton: document.querySelector('.connect_wallet')
    },
    init() {
      // create a keyStore for signing transactions using the user's key
      // which is located in the browser local storage after user logs in
      const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();

      // Initializing connection to the NEAR testnet
      nearAPI.connect({ keyStore, ...{
          networkId: 'testnet',
          nodeUrl: 'https://rpc.testnet.near.org',
          contractName: CONTRACT_NAME,
          walletUrl: 'https://wallet.testnet.near.org',
          helperUrl: 'https://helper.testnet.near.org'
        } }).then( function(near) {
        // Initialize wallet connection
        const walletConnection = new nearAPI.WalletConnection(near);
        console.log(walletConnection);
      })
    }
  };
  return {
    init: self.init
  };
})();
