const nearAPI = require('near-api-js');
const {ls} = require("./storage");

// TODO fixme
// TODO fix process.env ??
const CONTRACT_NAME = 'near4.isonar.testnet';

module.exports.wallet = (function() {
  const self = {
    elems: {
      connectWalletButton: null
    },
    walletConnection: null,
    init() {

      self.elems.connectWalletButton = document.querySelector('#connect_wallet');
      console.log(self.elems.connectWalletButton)
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
        console.log(walletConnection.isSignedIn());
        self.walletConnection = walletConnection;
      })

      self.elems.connectWalletButton.addEventListener('click', function(e) {
        self.walletConnection.requestSignIn({
          contractId: CONTRACT_NAME, // optional, contract requesting access
          methodNames: ['hello', 'goodbye'], // optional
          successUrl: 'http://localhost:4567/auth/near?json=1', // optional
          failureUrl: 'http://localhost:4567/auth/near-failed?json=1' // optional
        });
      });
    }
  };
  return {
    init: self.init
  };
})();
