const nearAPI = require('near-api-js');
const {ls} = require("./storage");

// TODO fixme
// TODO fix process.env ??
const CONTRACT_NAME = 'dev-1641300446718-52938685671056';

module.exports.wallet = (function() {
  const self = {
    elems: {
      connectWalletButton: null
    },
    walletConnection: null,
    contract: null,

    getContract: function() {
      return self.contract
    },

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

        self.contract = new nearAPI.Contract(
            // User's accountId as a string
            self.walletConnection.account(),
            // accountId of the contract we will be loading
            // NOTE: All contracts on NEAR are deployed to an account and
            // accounts can only have one contract deployed to them.
            CONTRACT_NAME,
            {
              // View methods are read-only – they don't modify the state, but usually return some value
              viewMethods: ['get_pixel'],
              // Change methods can modify the state, but you don't receive the returned value when called
              changeMethods: ['put_pixel'],
              // Sender is the account ID to initialize transactions.
              // getAccountId() will return empty string if user is still unauthorized
              sender: self.walletConnection.getAccountId(),
            });
      });


      self.elems.connectWalletButton.addEventListener('click', function(e) {
        self.walletConnection.requestSignIn({
          contractId: CONTRACT_NAME, // optional, contract requesting access
          methodNames: ['put_pixel'], // optional
          successUrl: 'http://localhost:4567/auth/near?json=1', // optional
          failureUrl: 'http://localhost:4567/auth/near-failed?json=1' // optional
        });
      });
    }
  };
  return {
    init: self.init,
    getContract: self.getContract
  };
})();
