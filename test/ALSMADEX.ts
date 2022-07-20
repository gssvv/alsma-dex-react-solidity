import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract as EthersContract } from 'ethers';
import { expect } from 'chai';

/**
 * Polygon data feeds — https://docs.chain.link/docs/matic-addresses/
 *
 * @todo
 *  [ ] Custom token symbol support
 *  [ ] Make all tests independent
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

  export interface StakeDetails {
    staked: number
    earned: number
  }

  export interface Contract extends EthersContract {
    addToken(address: Token['address'], contractAddress: Token['dataFeedAddress']): Promise<Token>
    getTokenDetails(address: Token['address']): Promise<TokenDetails>
    getTokenList(): Promise<Token[]>

    stake(tokenAddress: Token['address'], amount: number): Promise<StakeDetails>
    getStakeDetails(tokenAddress: Token['address']): Promise<StakeDetails>
    getStakeDetailsForAddress(address: string, tokenAddress: Token['address']): Promise<StakeDetails>
    unstake(tokenAddress: Token['address'], amount: number): Promise<StakeDetails>

    getEstimatedSwapDetails(fromTokenAddress: Token['address'], toTokenAddress: Token['address'], fromTokenAmount: number): Promise<{
      0: number,
      1: number,
      2: number,
    }>
    swap(fromTokenAddress: Token['address'], toTokenAddress: Token['address'], fromTokenAmount: number): Promise<StakeDetails>
    swapWithSlippageCheck(fromTokenAddress: Token['address'], toTokenAddress: Token['address'], fromTokenAmount: number, expectedToTokenAmount: number): Promise<StakeDetails>
    withdrawAllStakingProfits(fromTokenAddress: Token['address']): Promise<StakeDetails['earned']>

    getTreasuryBalance(tokenAddress: Token['address']): Promise<number>
    withdrawTreasury(tokenAddress: Token['address']): Promise<number>
  }
}

/**
 * @description Returns true is error was throwed. Otherwise — returns false.
 * @param {Function} fn
 * @returns {Promise<boolean>}
 */
const isThrowingErrorAsync = (fn: Function): Promise<boolean> => new Promise((res) => {
  fn().then(res.bind(this, false)).catch(res.bind(this, true));
});

describe('ALSMADEX', () => {
  let contract: ALSMADEX.Contract;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  let kbtc: EthersContract;
  let kusdt: EthersContract;

  const BTC_TOKEN_SYMBOL = 'KBTC';
  const BTC_DATA_FEED_CONTRACT = '0x007A22900a3B98143368Bd5906f8E17e9867581b'; // to be replaced with mock
  const BTC_TO_USD_RATE = 2126577000000; // 8 decimals, used for mocking

  const USDT_TOKEN_SYMBOL = 'KUSDT';
  const USDT_DATA_FEED_CONTRACT = '0x92C09849638959196E976289418e5973CC96d645'; // to be replaced with mock
  const USDT_TO_USD_RATE = 99980000; // 8 decimals, used for mocking

  const ADDR1_KBTC_BALANCE = 100000000;
  const ADDR1_KUSDT_BALANCE = 100000000;

  const deployContract = async () => await (await ethers.getContractFactory('ALSMADEX')).deploy() as ALSMADEX.Contract;

  before(async () => {
    kbtc = await (await ethers.getContractFactory('KindaBTC')).deploy();
    kusdt = await (await ethers.getContractFactory('KindaUSDT')).deploy();

    await kbtc.transfer(addr1.address, ADDR1_KBTC_BALANCE);
    await kusdt.transfer(addr1.address, ADDR1_KUSDT_BALANCE);
  });

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();
    contract = await deployContract();
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      contract = await deployContract();
    });

    describe('Token addition', () => {
      beforeEach(async () => {
        contract = await deployContract();
      });

      it('Should fail to add token as non-owner', async () => {
        expect(
          await isThrowingErrorAsync(
            contract.addToken.bind(
              { from: addr1 },
              kbtc.address, // token address
              BTC_DATA_FEED_CONTRACT, // data feed contract address
            ),
          ),
        ).to.equal(true, 'Throws an error');
      });

      it('Should fail to add non-erc20 token', async () => {
        expect(
          await isThrowingErrorAsync(
            contract.addToken.bind(
              { from: addr1 },
              contract.address, // token address
              BTC_DATA_FEED_CONTRACT, // data feed contract address
            ),
          ),
        ).to.equal(true, 'Throws an error');
      });

      it('Should fail to add token with incorrect data feed contract', async () => {
        expect(
          await isThrowingErrorAsync(
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

      it('Should fail to add token with contract that already exists', async () => {
        await contract.addToken.call(
          { from: owner },
          kbtc.address, // token address
          BTC_DATA_FEED_CONTRACT, // data feed contract address
        );

        expect(
          await isThrowingErrorAsync(
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

  describe('Staking workflow', () => {
    const DEFAULT_STAKE_AMOUNT = 100_000;

    before(async () => {
      contract = await deployContract();
      await contract.addToken.call(
        { from: owner },
        kbtc.address,
        BTC_DATA_FEED_CONTRACT,
      );
      await contract.addToken.call(
        { from: owner },
        kusdt.address,
        USDT_DATA_FEED_CONTRACT,
      );
    });

    const approveAllTokensAndStake = async (
      from: SignerWithAddress,
      amount = DEFAULT_STAKE_AMOUNT,
    ): Promise<ALSMADEX.StakeDetails> => {
      await kusdt.approve.call(
        { from },
        contract.address,
        ADDR1_KUSDT_BALANCE,
      );
      await kbtc.approve.call(
        { from },
        contract.address,
        ADDR1_KBTC_BALANCE,
      );
      return await contract.stake.call(
        { from },
        kbtc.address,
        amount,
      );
    };

    it('Should fail to stake when there are not enough of them on signer`s balance', async () => {
      expect(
        await isThrowingErrorAsync(
          contract.stake.bind(
            { from: addr2 }, // address that does not have any tokens
            kbtc.address,
            DEFAULT_STAKE_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to stake when there are not enough approved tokens', async () => {
      expect(
        await isThrowingErrorAsync(
          contract.stake.bind(
            { from: addr1 },
            kbtc.address,
            DEFAULT_STAKE_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to stake token that does not exist', async () => {
      expect(
        await isThrowingErrorAsync(
          contract.stake.bind(
            { from: addr1 },
            contract.address, // there is no token with such contract
            DEFAULT_STAKE_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should stake tokens', async () => {
      const { staked, earned } = await approveAllTokensAndStake(addr1);

      expect(staked).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(earned).to.equal(0);
    });

    it('Should get staking details', async () => {
      await approveAllTokensAndStake(addr1);

      const { staked, earned } = await contract.getStakeDetails.call(
        { from: addr1 },
        kbtc.address,
      );

      expect(staked).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(earned).to.equal(0);
    });

    it('Should recalculate token comission after staking', async () => {
      const { comissionRate: initialComissionRate } = await contract.getTokenDetails.call(
        { from: addr1 },
        kbtc.address,
      );

      await approveAllTokensAndStake(addr1);

      const { comissionRate: nextComissionRate } = await contract.getTokenDetails.call(
        { from: addr1 },
        kbtc.address,
      );

      expect(nextComissionRate).to.be.greaterThan(initialComissionRate);
    });

    it('Should distribute profits from swap comission among stakers and DEX', async () => {
      await approveAllTokensAndStake(addr1);
      await approveAllTokensAndStake(
        owner,
        DEFAULT_STAKE_AMOUNT / 2,
      ); // less stake means less profits

      await contract.swap.call(
        { from: owner },
        kbtc.address,
        kusdt.address,
        DEFAULT_STAKE_AMOUNT,
      );

      const { earned: earnedOnAddr1 } = await contract.getStakeDetailsForAddress.call(
        { from: addr1 },
        addr1.address,
        kbtc.address,
      );

      const { earned: earnedOnOwner } = await contract.getStakeDetailsForAddress.call(
        { from: addr1 },
        owner.address,
        kbtc.address,
      );

      const treasuryBalance = await contract.getTreasuryBalance.call(
        { from: owner },
        kbtc.address,
      );

      expect(earnedOnAddr1).to.be.greaterThan(0);
      expect(earnedOnOwner).to.be.greaterThan(0);
      expect(earnedOnAddr1).to.be.greaterThan(earnedOnOwner); // as owner staked less than addr1
      expect(treasuryBalance).to.be.greaterThan(0); // as owner staked less than addr1
    });

    it('Should withdraw staking profits', async () => {
      await approveAllTokensAndStake(addr1);

      const initialBalance = kbtc.balanceOf(addr1.address);

      await contract.swap.call(
        { from: owner },
        kbtc.address,
        kusdt.address,
        DEFAULT_STAKE_AMOUNT,
      );

      const { earned: earnedAfterSwap } = await contract.getStakeDetails
        .call({ from: addr1 }, kbtc.address);

      const nextBalance = kbtc.balanceOf(addr1.address);

      const earnedAfterWithdrawal = await contract.withdrawAllStakingProfits
        .call({ from: addr1 }, kbtc.address);

      expect(earnedAfterSwap).to.be.greaterThan(0); // earned something
      expect(nextBalance).to.be.greaterThan(initialBalance); // received profit to the wallet
      expect(earnedAfterWithdrawal).to.equal(0);
    });

    it('Should fail to unstake more than staked', async () => {
      // nothing is staked at this point
      expect(
        await isThrowingErrorAsync(
          contract.unstake.bind({ from: addr1 }, kbtc.address, 100),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should unstake and upadted balances correctly', async () => {
      await approveAllTokensAndStake(addr1);

      const beforeUnstakeBalance = kbtc.balanceOf(addr1.address);
      const { staked: beforeUnstakeStakingBalance } = await contract.getStakeDetails
        .call({ from: addr1 }, kbtc.address);

      await contract.unstake.bind({ from: addr1 }, kbtc.address, DEFAULT_STAKE_AMOUNT);

      const afterUnstakeBalance = kbtc.balanceOf(addr1.address);
      const { staked: afterUnstakeStakingBalance } = await contract.getStakeDetails
        .call({ from: addr1 }, kbtc.address);

      expect(afterUnstakeBalance - beforeUnstakeBalance).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(beforeUnstakeStakingBalance).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(afterUnstakeStakingBalance).to.equal(0); // balance is 0 again
    });
  });

  describe('Tokens info', () => {
    beforeEach(async () => {
      /**
       * Adding tokens for testing
       */
      contract = await deployContract();
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

  describe('Treasury', () => {
    it('Should return balance of a particular token', async () => {});
    it('Should fail to withdraw as non-owner', async () => {});
    it('Should fail to withdraw when there are not enough balance', async () => {});
    it('Should withdraw particular sum as owner', async () => {});
    it('Should withdraw all as owner', async () => {});
  });

  describe('Swap', () => {
    const SWAP_AMOUNT = 100_000;
    const DEFAULT_STAKE_AMOUNT = 100_000_000_000;

    // do some staking beforehand

    beforeEach(async () => {
      contract = await deployContract();
      await contract.stake.call(
        { from: owner },
        kbtc.address,
        DEFAULT_STAKE_AMOUNT,
      );
      await contract.stake.call(
        { from: owner },
        kusdt.address,
        DEFAULT_STAKE_AMOUNT,
      );
    });

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

      expect(swapRate).to.be.greaterThan(0);
      expect(comissionRate).to.be.greaterThan(0);
      expect(estimatedSwapOutput).to.be.greaterThan(0);
    });

    it('Should perform swap', async () => {
      await kbtc.approve.call(
        { from: addr1 },
        contract.address,
        ADDR1_KBTC_BALANCE,
      );

      const kbtcBalanceBeforeSwap = await kbtc.balanceOf(addr1.address);
      const kusdtBalanceBeforeSwap = await kusdt.balanceOf(addr1.address);

      const {
        2: estimatedSwapOutput,
      } = await contract.getEstimatedSwapDetails.call(
        { from: addr1 },
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      await contract.swap.call(
        { from: addr1 },
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      const kbtcBalanceAfterSwap = await kbtc.balanceOf(addr1.address);
      const kusdtBalanceAfterSwap = await kusdt.balanceOf(addr1.address);

      expect(kbtcBalanceBeforeSwap).to.be.greaterThan(kbtcBalanceAfterSwap);
      expect(kusdtBalanceAfterSwap).to.be.greaterThan(kusdtBalanceBeforeSwap);
      expect(kusdtBalanceBeforeSwap + estimatedSwapOutput).to.equal(kusdtBalanceAfterSwap);
    });

    it('Should fail to swap with wrong fromToken', async () => {
      expect(
        isThrowingErrorAsync(
          await contract.swap.bind(
            { from: addr1 },
            contract.address, // this contract is not a token
            kusdt.address,
            SWAP_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to swap with wrong toToken', async () => {
      expect(
        isThrowingErrorAsync(
          await contract.swap.bind(
            { from: addr1 },
            kusdt.address,
            contract.address, // this contract is not a token
            SWAP_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to swap when not enough tokens on signer`s balance', async () => {
      const balance = await kbtc.balanceOf(addr1.address);

      // otherwise the error may come from other reason
      expect(DEFAULT_STAKE_AMOUNT).to.be.greaterThan(balance);

      expect(
        isThrowingErrorAsync(
          await contract.swap.bind(
            { from: addr1 },
            kbtc.address,
            kusdt.address,
            balance + 1, // more than available
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to swap when not enough tokens on contract`s balance', async () => {
      await kbtc.mint(addr1.address, DEFAULT_STAKE_AMOUNT + 1);

      expect(
        isThrowingErrorAsync(
          await contract.swap.bind(
            { from: addr1 },
            kbtc.address,
            kusdt.address,
            DEFAULT_STAKE_AMOUNT + 1, // more than available
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to swap with more than 0.5% slippage', async () => {
      const {
        2: estimatedSwapOutput,
      } = await contract.getEstimatedSwapDetails.call(
        { from: addr1 },
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      expect(
        isThrowingErrorAsync(
          contract.swapWithSlippageCheck.bind(
            { from: addr1 },
            kbtc.address,
            kusdt.address,
            Math.round(SWAP_AMOUNT * 0.994), // substracting 0.6% to make it fail
            estimatedSwapOutput,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });
  });
});
