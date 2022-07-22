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
    tokenAddress: string
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

  export enum RevertReason {
    CALLER_IS_NOT_OWNER = 'Ownable: caller is not the owner',
    UNEXPECTED_AMOUNT_OF_DATA = 'function returned an unexpected amount of data'
  }

  export interface Contract extends EthersContract {
    addToken(address: Token['tokenAddress'], contractAddress: Token['dataFeedAddress']): Promise<Token>
    getTokenDetails(address: Token['tokenAddress']): Promise<TokenDetails>
    getTokenList(): Promise<Token[]>

    stake(tokenAddress: Token['tokenAddress'], amount: number): Promise<StakeDetails>
    getStakeDetails(tokenAddress: Token['tokenAddress']): Promise<StakeDetails>
    getStakeDetailsForAddress(address: string, tokenAddress: Token['tokenAddress']): Promise<StakeDetails>
    unstake(tokenAddress: Token['tokenAddress'], amount: number): Promise<StakeDetails>

    getEstimatedSwapDetails(fromTokenAddress: Token['tokenAddress'], toTokenAddress: Token['tokenAddress'], fromTokenAmount: number): Promise<{
      swapRate: number,
      comissionRate: number,
      estimatedSwapOutput: number,
    }>
    swap(fromTokenAddress: Token['tokenAddress'], toTokenAddress: Token['tokenAddress'], fromTokenAmount: number): Promise<StakeDetails>
    swapWithSlippageCheck(fromTokenAddress: Token['tokenAddress'], toTokenAddress: Token['tokenAddress'], fromTokenAmount: number, expectedToTokenAmount: number): Promise<StakeDetails>
    withdrawAllStakingProfits(fromTokenAddress: Token['tokenAddress']): Promise<StakeDetails['earned']>

    getTreasuryBalance(tokenAddress: Token['tokenAddress']): Promise<number>
    withdrawTreasury(tokenAddress: Token['tokenAddress']): Promise<number>

    connect(address: SignerWithAddress): Contract
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

  let BTC_TOKEN_SYMBOL: string;
  let BTC_DATA_FEED_CONTRACT: EthersContract;
  let BTC_TO_USD_RATE: number;

  // const USDT_TOKEN_SYMBOL = 'KUSDT';
  let USDT_DATA_FEED_CONTRACT: EthersContract;
  // let USDT_TO_USD_RATE: number;

  const ADDR1_KBTC_BALANCE = 100000000;
  const ADDR1_KUSDT_BALANCE = 100000000;

  const deployContract = async () => await (await ethers.getContractFactory('ALSMADEX')).deploy() as ALSMADEX.Contract;

  before(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    kbtc = await (await ethers.getContractFactory('KindaBTC')).deploy();
    kusdt = await (await ethers.getContractFactory('KindaUSDT')).deploy();

    await kbtc.transfer(addr1.address, ADDR1_KBTC_BALANCE);
    await kusdt.transfer(addr1.address, ADDR1_KUSDT_BALANCE);

    BTC_DATA_FEED_CONTRACT = await (await ethers.getContractFactory('DataFeedBTCUSDMock')).deploy();
    BTC_TO_USD_RATE = (await BTC_DATA_FEED_CONTRACT.latestRoundData()).answer;
    BTC_TOKEN_SYMBOL = await kbtc.symbol();

    USDT_DATA_FEED_CONTRACT = await (await ethers.getContractFactory('DataFeedUSDTUSDMock')).deploy();
    // USDT_TO_USD_RATE = (await USDT_DATA_FEED_CONTRACT.latestRoundData())['1'];
  });

  beforeEach(async () => {
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
        await expect(
          contract.connect(addr1).addToken(
            kbtc.address, // token address
            BTC_DATA_FEED_CONTRACT.address, // data feed contract address
          ),
        ).to.be.revertedWith(ALSMADEX.RevertReason.CALLER_IS_NOT_OWNER);
      });

      it('Should fail to add non-erc20 token', async () => {
        await expect(
          contract.addToken(
            contract.address, // token address
            BTC_DATA_FEED_CONTRACT.address, // data feed contract address
          ),
        ).to.be.revertedWith(ALSMADEX.RevertReason.UNEXPECTED_AMOUNT_OF_DATA);
      });

      it('Should fail to add token with incorrect data feed contract', async () => {
        await expect(
          contract.addToken(
            kbtc.address, // token address
            contract.address, // is not data feed
          ),
        ).to.be.revertedWith(ALSMADEX.RevertReason.UNEXPECTED_AMOUNT_OF_DATA);
      });

      it('Should add token as owner', async () => {
        expect(contract.addToken(
          kbtc.address, // token address
          BTC_DATA_FEED_CONTRACT.address, // data feed contract address
        )).to
          .emit(contract, 'TokenCreate')
          .withArgs(kbtc.address, BTC_DATA_FEED_CONTRACT.address, BTC_TOKEN_SYMBOL);
      });

      it('Should fail to add token with contract that already exists', async () => {
        await contract.addToken(
          kbtc.address,
          BTC_DATA_FEED_CONTRACT.address,
        );

        await expect(
          contract.addToken(
            kbtc.address,
            BTC_DATA_FEED_CONTRACT.address,
          ),
        ).to.be.revertedWith('Add the token that already exists');
      });

      it('Should return list of tokens', async () => {
        await contract.addToken(
          kbtc.address,
          BTC_DATA_FEED_CONTRACT.address,
        );
        await contract.addToken(
          kusdt.address, // token address
          USDT_DATA_FEED_CONTRACT.address, // data feed contract address
        );

        const tokenList = await contract.getTokenList.call({ from: addr1 });

        expect(tokenList.length).to.equal(2);

        tokenList.forEach((token) => {
          expect(token.tokenAddress).to.be('string');
          expect(token.dataFeedAddress).to.be('string');
          expect(token.symbol).to.be('string');
        });
      });

      it('Should return token details by address', async () => {
        await contract.addToken(
          kbtc.address,
          BTC_DATA_FEED_CONTRACT.address,
        );

        const token = await contract.connect(addr1).getTokenDetails(kbtc.address);

        expect(token.tokenAddress).to.equal(kbtc.address);
        expect(token.dataFeedAddress).to.equal(BTC_DATA_FEED_CONTRACT.address);
        expect(token.symbol).to.equal(0); // default balance
        expect(token.balance).to.be.equal(BTC_TO_USD_RATE);
        expect(token.exchangeRate).to.be('number'); // to be tested in «Stacking program» part
      });
    });
  });

  describe('Staking workflow', () => {
    const DEFAULT_STAKE_AMOUNT = 100_000;

    before(async () => {
      contract = await deployContract();
      await contract.addToken(
        kbtc.address,
        BTC_DATA_FEED_CONTRACT.address,
      );
      await contract.addToken(
        kusdt.address,
        USDT_DATA_FEED_CONTRACT.address,
      );
    });

    const approveAllTokensAndStake = async (
      addr: SignerWithAddress,
      amount = DEFAULT_STAKE_AMOUNT,
    ): Promise<ALSMADEX.StakeDetails> => {
      await kusdt.connect(addr1).approve(
        contract.address,
        ADDR1_KUSDT_BALANCE,
      );
      await kbtc.connect(addr1).approve(
        contract.address,
        ADDR1_KBTC_BALANCE,
      );
      return await contract.connect(addr).stake(
        kbtc.address,
        amount,
      );
    };

    it('Should fail to stake when there are not enough of them on signer`s balance', async () => {
      expect(
        await isThrowingErrorAsync(
          contract.connect(addr2).stake.bind(
            this,
            kbtc.address,
            DEFAULT_STAKE_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to stake when there are not enough approved tokens', async () => {
      expect(
        await isThrowingErrorAsync(
          contract.connect(addr1).stake.bind(
            this,
            kbtc.address,
            DEFAULT_STAKE_AMOUNT,
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to stake token that does not exist', async () => {
      expect(
        await isThrowingErrorAsync(
          contract.connect(addr1).stake.bind(
            this,
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

      const { staked, earned } = await contract.connect(addr1).getStakeDetails(
        kbtc.address,
      );

      expect(staked).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(earned).to.equal(0);
    });

    it('Should recalculate token comission after staking', async () => {
      const { comissionRate: initialComissionRate } = await contract.connect(addr1).getTokenDetails(
        kbtc.address,
      );

      await approveAllTokensAndStake(addr1);

      const { comissionRate: nextComissionRate } = await contract.connect(addr1).getTokenDetails(
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

      const { earned: earnedOnAddr1 } = await contract.connect(addr1).getStakeDetailsForAddress(
        addr1.address,
        kbtc.address,
      );

      const { earned: earnedOnOwner } = await contract.connect(addr1).getStakeDetailsForAddress(
        owner.address,
        kbtc.address,
      );

      const treasuryBalance = await contract.getTreasuryBalance(
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

      await contract.swap(
        kbtc.address,
        kusdt.address,
        DEFAULT_STAKE_AMOUNT,
      );

      const { earned: earnedAfterSwap } = await contract.connect(addr1)
        .getStakeDetails(kbtc.address);

      const nextBalance = kbtc.balanceOf(addr1.address);

      const earnedAfterWithdrawal = await contract.connect(addr1)
        .withdrawAllStakingProfits(kbtc.address);

      expect(earnedAfterSwap).to.be.greaterThan(0); // earned something
      expect(nextBalance).to.be.greaterThan(initialBalance); // received profit to the wallet
      expect(earnedAfterWithdrawal).to.equal(0);
    });

    it('Should fail to unstake more than staked', async () => {
      // nothing is staked at this point
      expect(
        await isThrowingErrorAsync(
          contract.connect(addr1).unstake.bind(this, kbtc.address, 100),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should unstake and upadted balances correctly', async () => {
      await approveAllTokensAndStake(addr1);

      const beforeUnstakeBalance = kbtc.balanceOf(addr1.address);
      const { staked: beforeUnstakeStakingBalance } = await contract.connect(addr1).getStakeDetails
        .call(this, kbtc.address);

      await contract.connect(addr1).unstake.bind(this, kbtc.address, DEFAULT_STAKE_AMOUNT);

      const afterUnstakeBalance = kbtc.balanceOf(addr1.address);
      const { staked: afterUnstakeStakingBalance } = await contract.connect(addr1).getStakeDetails
        .call(this, kbtc.address);

      expect(afterUnstakeBalance - beforeUnstakeBalance).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(beforeUnstakeStakingBalance).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(afterUnstakeStakingBalance).to.equal(0); // balance is 0 again
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
      await contract.stake(
        kbtc.address,
        DEFAULT_STAKE_AMOUNT,
      );
      await contract.stake(
        kusdt.address,
        DEFAULT_STAKE_AMOUNT,
      );
    });

    it('Should return estimated swap details', async () => {
      const {
        swapRate,
        comissionRate,
        estimatedSwapOutput,
      } = await contract.getEstimatedSwapDetails(
        kbtc.address, // swap input token
        kusdt.address, // swap output token
        SWAP_AMOUNT, // swap input token amount
      );

      expect(swapRate).to.be.greaterThan(0);
      expect(comissionRate).to.be.greaterThan(0);
      expect(estimatedSwapOutput).to.be.greaterThan(0);
    });

    it('Should perform swap', async () => {
      await kbtc.approve(
        contract.address,
        ADDR1_KBTC_BALANCE,
      );

      const kbtcBalanceBeforeSwap = await kbtc.balanceOf(addr1.address);
      const kusdtBalanceBeforeSwap = await kusdt.balanceOf(addr1.address);

      const {
        estimatedSwapOutput,
      } = await contract.connect(addr1).getEstimatedSwapDetails(
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      await contract.connect(addr1).swap(
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
          await contract.connect(addr1).swap.bind(
            this,
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
          await contract.connect(addr1).swap.bind(
            this,
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
          await contract.connect(addr1).swap.bind(
            this,
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
          await contract.connect(addr1).swap.bind(
            this,
            kbtc.address,
            kusdt.address,
            DEFAULT_STAKE_AMOUNT + 1, // more than available
          ),
        ),
      ).to.equal(true, 'Throws an error');
    });

    it('Should fail to swap with more than 0.5% slippage', async () => {
      const {
        estimatedSwapOutput,
      } = await contract.connect(addr1).getEstimatedSwapDetails.call(
        this,
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      expect(
        isThrowingErrorAsync(
          contract.connect(addr1).swapWithSlippageCheck.bind(
            this,
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
