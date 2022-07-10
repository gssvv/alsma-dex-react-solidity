import { config } from 'dotenv';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';

config();

const {
  MUMBAI_PRIVATE_KEY, GOERLI_PRIVATE_KEY, GOERLI_RPC_URL, MUMBAI_RPC_URL,
} = process.env;

module.exports = {
  solidity: '0.8.9',
  networks: {
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [GOERLI_PRIVATE_KEY],
    },
    mumbai: {
      url: MUMBAI_RPC_URL,
      accounts: [MUMBAI_PRIVATE_KEY],
    },
  },
};
