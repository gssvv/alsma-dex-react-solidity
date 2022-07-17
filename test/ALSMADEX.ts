import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract as EthersContract } from 'ethers';
import { expect } from 'chai';

/**
 * Polygon data feeds — https://docs.chain.link/docs/matic-addresses/
 *
 * @todo
 *  [ ] Custom token symbol support
 */

namespace ALSMADEX {
  export interface Token {
    address: string
    dataFeedAddress: string
    symbol: string
  }

  export interface TokenDetails extends Token {
    balance: number
    exchangeRate: number
    comissionRate: number
  }

  export interface Contract extends EthersContract {
    addToken(address: Token['address'], contractAddress: Token['dataFeedAddress']): Promise<Token>
    getTokenDetails(address: Token['address']): Promise<TokenDetails>
    getTokenList(): Promise<Token[]>
  }
}

/**
 * @description Returns true is error was throwed. Otherwise — returns false.
 * @param {Function} fn
 * @returns {Promise<boolean>}
 */
const isErrorThrowedAsync = (fn: Function): Promise<boolean> => new Promise((res) => {
  fn().then(res.bind(this, false)).catch(res.bind(this, true));
});

describe('ALSMADEX', () => {
  let contract: ALSMADEX.Contract;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  let kbtc: EthersContract;
  let kusdt: EthersContract;

  const BTC_TOKEN_SYMBOL = 'KBTC';
  const BTC_DATA_FEED_CONTRACT = '0x007A22900a3B98143368Bd5906f8E17e9867581b'; // to be replaced with mock
  const BTC_TO_USD_RATE = 2126577000000; // 8 decimals, used for mocking

  const USDT_TOKEN_SYMBOL = 'KUSDT';
  const USDT_DATA_FEED_CONTRACT = '0x92C09849638959196E976289418e5973CC96d645'; // to be replaced with mock
  const USDT_TO_USD_RATE = 99980000; // 8 decimals, used for mocking

  const deployContract = async () => await (await ethers.getContractFactory('ALSMADEX')).deploy() as ALSMADEX.Contract;

  before(async () => {
    kbtc = await (await ethers.getContractFactory('KindaBTC')).deploy();
    kusdt = await (await ethers.getContractFactory('KindaUSDT')).deploy();
  });

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();
    contract = await deployContract();
  });

  // describe('Deployment', () => {
  //   it('Should deploy without any errors', async () => {

  //   });
  // });

  describe('Configuration', () => {
    /**
     * @todo
     * [x] Add tokens
     *  [ ] Should not add tokens with symbol that already exists
     *  [x] Add contract to read token exchange rate from (<TOKEN> / USD)
     * [ ] Update tokens
     */
    beforeEach(async () => {
      contract = await deployContract();
    });

    describe('Token addition', () => {
      it('Should not add token as non-owner', async () => {
        expect(
          await isErrorThrowedAsync(
            contract.addToken.bind(
              { from: addr1 },
              kbtc.address, // token address
              BTC_DATA_FEED_CONTRACT, // data feed contract address
            ),
          ),
        ).to.equal(true, 'Throws an error');
      });

      it('Should add token as owner', async () => {
        const token = await contract.addToken.call(
          { from: owner },
          kbtc.address, // token address
          BTC_DATA_FEED_CONTRACT, // data feed contract address
        );

        const tokenList = await contract.getTokenList();
        const newToken = tokenList.find((t: ALSMADEX.Token) => t.symbol === BTC_TOKEN_SYMBOL);

        expect(token.symbol)
          .to.equal(newToken?.symbol).and.equal(BTC_TOKEN_SYMBOL);
        expect(token.address)
          .to.equal(newToken?.address).and.equal(kbtc.address);
        expect(token.dataFeedAddress)
          .to.equal(newToken?.dataFeedAddress).and.equal(BTC_DATA_FEED_CONTRACT);
      });

      it('Should not add token with contract that already exists', async () => {
        expect(
          await isErrorThrowedAsync(
            contract.addToken.bind(
              { from: owner },
              kbtc.address, // token address
              BTC_DATA_FEED_CONTRACT, // data feed contract address
            ),
          ),
        ).to.equal(true, 'Throws an error');
      });
    });
  });

  describe('Staking program', () => {
    /**
     * @todo
     * [ ] Stake tokens
     * [ ] Transfer comission to stakers` accounts (should find an optimal way)
     * [ ] Staking rates calculation (larger pools means less comission)
     */
    it('Should get profit estimation from staking', () => {});
    it('Should stake tokens', () => {});
    it('Should recalculate token comission after staking', () => {});
    it('Should distribute profits from swap comission among stakers and DEX', () => {});
    it('Should recalculate token comission after swap', () => {});
    it('Should get staking status (profits, time)', () => {});
    it('Should withdraw profits from staking', () => {});
    it('Should take tokens back from staking', () => {});
    it('Should not withdraw profits from DEX as non-owner', () => {});
    it('Should withdraw profits from DEX as owner', () => {});
  });

  describe('State', () => {
    /**
     * @todo
     * [x] Get list of tokens
     * [x] Get amount of tokens available
     * [x] Caculate swap (exchange rate)
     */

    before(async () => {
      /**
       * Adding tokens for testing
       */
      await contract.addToken.call(
        { from: owner },
        kbtc.address,
        BTC_DATA_FEED_CONTRACT,
      );
      await contract.addToken.call(
        { from: owner },
        kusdt.address, // token address
        USDT_DATA_FEED_CONTRACT, // data feed contract address
      );
    });

    it('Should return list of tokens', async () => {
      const tokenList = await contract.getTokenList.call({ from: addr1 });

      expect(tokenList.length).to.equal(2);

      tokenList.forEach((token) => {
        expect(token.symbol).to.be('string');
        expect(token.address).to.be('string');
        expect(token.dataFeedAddress).to.be('string');
      });
    });

    it('Should return token details by address', async () => {
      const token = await contract.getTokenDetails.call({ from: addr1 }, kbtc.address);

      expect(token.address).to.equal(kbtc.address);
      expect(token.dataFeedAddress).to.equal(BTC_DATA_FEED_CONTRACT);
      expect(token.balance).to.equal(0); // default balance
      expect(token.exchangeRate).to.be.equal(BTC_TO_USD_RATE);
      expect(token.comissionRate).to.be('number'); // to be tested in «Stacking program» part
    });
  });

  describe('Swap', () => {
    /**
     * @todo
     * [ ] Perform a token swap
     *    [ ] Recieve/transfer right tokens
     *    [ ] Transfer comission to stakers` accounts (should find an optimal way)
     */
    const SWAP_AMOUNT = 100_000;

    // do some staking beforehand

    it('Should return estimated swap details', async () => {
      const {
        0: swapRate,
        1: comissionRate,
        2: estimatedSwapOutput,
      } = await contract.getEstimatedSwapDetails.call(
        { from: addr1 },
        kbtc.address, // swap input token
        kusdt.address, // swap output token
        SWAP_AMOUNT, // swap input token amount
      );
      // todo
    });

    it('Should perform swap', () => {

    });

    it('Should not perform swap when not enough tokens on signer`s balance', () => {

    });

    it('Should not perform swap when not enough tokens on contract`s balance', () => {

    });
  });
});
