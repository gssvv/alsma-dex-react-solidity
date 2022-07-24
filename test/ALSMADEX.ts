import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract as EthersContract } from 'ethers';
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
    decimals: BigNumber
  }

  export interface TokenDetails {
    token: Token,
    balance: BigNumber
    exchangeRate: BigNumber
    comissionRate: BigNumber
  }

  export interface StakeDetails {
    staked: BigNumber
    earned: BigNumber
  }

  export enum RevertReason {
    CALLER_IS_NOT_OWNER = 'Ownable: caller is not the owner',
    UNEXPECTED_AMOUNT_OF_DATA = 'function returned an unexpected amount of data'
  }

  export interface Contract extends EthersContract {
    addToken(address: Token['tokenAddress'], contractAddress: Token['dataFeedAddress']): Promise<Token>
    getTokenDetailsWithComission(address: Token['tokenAddress']): Promise<TokenDetails>
    getTokenList(): Promise<Token[]>

    stake(tokenAddress: Token['tokenAddress'], amount: number): Promise<StakeDetails>
    getStakeDetails(tokenAddress: Token['tokenAddress']): Promise<StakeDetails>
    getStakeDetailsForAccount(tokenAddress: Token['tokenAddress'], accountAddress: string,): Promise<StakeDetails>
    unstake(tokenAddress: Token['tokenAddress'], amount: number): Promise<StakeDetails>

    getEstimatedSwapDetails(fromTokenAddress: Token['tokenAddress'], toTokenAddress: Token['tokenAddress'], fromTokenAmount: number): Promise<{
      exchangeRate: BigNumber,
      toAmount: BigNumber,
      comissionTo: BigNumber,
    }>
    swap(fromTokenAddress: Token['tokenAddress'], toTokenAddress: Token['tokenAddress'], fromTokenAmount: number): Promise<StakeDetails>
    swapWithSlippageCheck(fromTokenAddress: Token['tokenAddress'], toTokenAddress: Token['tokenAddress'], fromTokenAmount: number, expectedToTokenAmount: number): Promise<StakeDetails>
    withdrawAllStakingProfits(fromTokenAddress: Token['tokenAddress']): Promise<StakeDetails['earned']>

    getTreasuryBalance(tokenAddress: Token['tokenAddress']): Promise<BigNumber>
    withdrawTreasury(tokenAddress: Token['tokenAddress']): Promise<number>

    connect(address: SignerWithAddress): Contract
  }
}

describe.only('ALSMADEX', () => {
  let contract: ALSMADEX.Contract;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  let kbtc: EthersContract;
  let kusdt: EthersContract;

  let BTC_TOKEN_SYMBOL: string;
  let BTC_DATA_FEED_CONTRACT: EthersContract;
  let BTC_TO_USD_RATE: number;
  let BTC_DECIMALS: number;

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
    BTC_DECIMALS = await kbtc.decimals();

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
        await expect(contract.addToken(
          kbtc.address, // token address
          BTC_DATA_FEED_CONTRACT.address, // data feed contract address
        )).to
          .emit(contract, 'TokenCreate')
          .withArgs(kbtc.address, BTC_DATA_FEED_CONTRACT.address, BTC_TOKEN_SYMBOL, BTC_DECIMALS);
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

        const tokenList = await contract.connect(addr1).getTokenList();

        expect(tokenList.length).to.equal(2);

        tokenList.forEach((token) => {
          expect(token.tokenAddress).to.be.a('string');
          expect(token.dataFeedAddress).to.be.a('string');
          expect(token.symbol).to.be.a('string');
          expect(token.decimals).to.be.equal(BTC_DECIMALS);
        });
      });
    });

    it('Should fail to return details for token that does not exist', async () => {
      expect(
        contract.connect(addr1).getTokenDetailsWithComission(kbtc.address),
      ).to.be.revertedWith('Token does not exist');
    });

    it('Should return token details by address', async () => {
      await contract.addToken(
        kbtc.address,
        BTC_DATA_FEED_CONTRACT.address,
      );

      const token = await contract.connect(addr1).getTokenDetailsWithComission(kbtc.address);

      expect(token.token.tokenAddress).to.equal(kbtc.address);
      expect(token.token.dataFeedAddress).to.equal(BTC_DATA_FEED_CONTRACT.address);
      expect(token.token.symbol).to.equal(BTC_TOKEN_SYMBOL); // default balance
      expect(token.balance).to.be.equal(0);
      expect(token.exchangeRate).to.equal(BTC_TO_USD_RATE);
      // comissionRate to be tested in «Stacking program» part
      expect(token.comissionRate.toNumber()).to.greaterThanOrEqual(0);
    });
  });

  describe('Staking workflow', () => {
    const DEFAULT_STAKE_AMOUNT = 100_000;

    beforeEach(async () => {
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

    it('Should fail to stake token that does not exist', async () => {
      expect(
        contract.connect(addr1).stake(
          contract.address, // there is no token with such contract
          DEFAULT_STAKE_AMOUNT,
        ),
      ).to.be.revertedWith('Token does not exist');
    });

    it('Should fail to stake when there are not enough of them on signer`s balance', async () => {
      expect(
        contract.connect(addr2).stake(
          kbtc.address,
          DEFAULT_STAKE_AMOUNT,
        ),
      ).to.be.revertedWith('Not enough tokens on balance');
    });

    it('Should fail to stake when there are not enough approved tokens', async () => {
      expect(
        contract.connect(addr1).stake(
          kbtc.address,
          DEFAULT_STAKE_AMOUNT,
        ),
      ).to.be.revertedWith('Not enough approved tokens');
    });

    it('Should stake tokens', async () => {
      await expect(await approveAllTokensAndStake(addr1)).to
        .emit(contract, 'Stake')
        .withArgs([DEFAULT_STAKE_AMOUNT, 0]);
    });

    it('Should get stake details', async () => {
      await approveAllTokensAndStake(addr1);

      const { staked, earned } = await contract.connect(addr1).getStakeDetails(
        kbtc.address,
      );

      expect(staked).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(earned).to.equal(0);
    });

    it('Should recalculate token comission after staking', async () => {
      const { comissionRate: initialComissionRate } = await contract.connect(addr1)
        .getTokenDetailsWithComission(
          kbtc.address,
        );

      await approveAllTokensAndStake(addr1, DEFAULT_STAKE_AMOUNT);
      // stake more kusdt to increase the comission for kbtc
      await contract.connect(addr1).stake(
        kusdt.address,
        DEFAULT_STAKE_AMOUNT * 4,
      );

      const { comissionRate: nextComissionRate } = await contract.connect(addr1)
        .getTokenDetailsWithComission(
          kbtc.address,
        );

      expect(nextComissionRate.toNumber()).to.be.greaterThan(initialComissionRate.toNumber());
    });

    it('Should distribute profits from swap comission among stakers and DEX', async () => {
      await approveAllTokensAndStake(addr1);

      await kbtc.approve(contract.address, DEFAULT_STAKE_AMOUNT);
      await contract.stake(kbtc.address, DEFAULT_STAKE_AMOUNT / 2); // less share to earn less

      const SWAP_AMOUNT = 1_000_000_000;
      await kusdt.mint(addr1.address, SWAP_AMOUNT);
      await kusdt.connect(addr1).approve(contract.address, SWAP_AMOUNT);

      await contract.connect(addr1).swap(
        kusdt.address,
        kbtc.address,
        SWAP_AMOUNT,
      );

      const { earned: earnedOnAddr1 } = await contract.connect(addr1).getStakeDetailsForAccount(
        kbtc.address,
        addr1.address,
      );

      const { earned: earnedOnOwner } = await contract.connect(addr1).getStakeDetailsForAccount(
        kbtc.address,
        owner.address,
      );

      const treasuryBalance = await contract.getTreasuryBalance(
        kbtc.address,
      );

      expect(earnedOnAddr1.toNumber()).to.be.greaterThan(0);
      expect(earnedOnOwner.toNumber()).to.be.greaterThan(0);
      expect(earnedOnAddr1.toNumber()).to.be
        .greaterThan(earnedOnOwner.toNumber()); // as owner staked less than addr1
      expect(treasuryBalance.toNumber()).to.be.greaterThan(0); // as owner staked less than addr1
    });

    it('Should withdraw staking profits', async () => {
      const SWAP_AMOUNT = 1_000_000_000;
      await approveAllTokensAndStake(addr1);

      const initialBalance = await kbtc.balanceOf(addr1.address);

      await kusdt.approve(contract.address, SWAP_AMOUNT);
      await contract.swap(
        kusdt.address,
        kbtc.address,
        SWAP_AMOUNT,
      );

      const { earned: earnedAfterSwap } = await contract.connect(addr1)
        .getStakeDetails(kbtc.address);

      await expect(contract.connect(addr1)
        .withdrawAllStakingProfits(kbtc.address)).to
        .emit(contract, 'WithdrawStakingProfits')
        .withArgs(earnedAfterSwap);

      const nextBalance = await kbtc.balanceOf(addr1.address);

      expect(earnedAfterSwap.toNumber()).to.be
        .greaterThan(0); // earned something
      expect(nextBalance.toNumber()).to.be
        .greaterThan(initialBalance.toNumber()); // received profit to the wallet
    });

    it('Should fail to unstake more than staked', async () => {
      expect(
        contract.connect(addr1).unstake(kbtc.address, 100),
      ).to.be.revertedWith('Nothing to unstake');
    });

    it('Should unstake and update balances accordingly', async () => {
      await approveAllTokensAndStake(addr1);

      const beforeUnstakeBalance = await kbtc.balanceOf(addr1.address);
      const { staked: beforeUnstakeStakingBalance } = await contract.connect(addr1)
        .getStakeDetails(kbtc.address);

      await expect(contract.connect(addr1)
        .unstake(kbtc.address, DEFAULT_STAKE_AMOUNT))
        .to.emit(contract, 'Unstake');

      const afterUnstakeBalance: BigNumber = await kbtc.balanceOf(addr1.address);
      const { staked: afterUnstakeStakingBalance } = await contract.connect(addr1)
        .getStakeDetails(kbtc.address);

      expect(afterUnstakeBalance.sub(beforeUnstakeBalance)).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(beforeUnstakeStakingBalance).to.equal(DEFAULT_STAKE_AMOUNT);
      expect(afterUnstakeStakingBalance).to.equal(0); // balance is 0 again
    });
  });

  describe.skip('Treasury', () => {
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

      await contract.addToken(kbtc.address, BTC_DATA_FEED_CONTRACT.address);
      await contract.addToken(kusdt.address, USDT_DATA_FEED_CONTRACT.address);

      await kbtc.approve(contract.address, DEFAULT_STAKE_AMOUNT);
      await kusdt.approve(contract.address, DEFAULT_STAKE_AMOUNT);

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
        exchangeRate,
        comissionTo,
        toAmount,
      } = await contract.getEstimatedSwapDetails(
        kbtc.address, // swap input token
        kusdt.address, // swap output token
        SWAP_AMOUNT, // swap input token amount
      );

      expect(exchangeRate.toNumber()).to.be.greaterThan(0);
      expect(comissionTo.toNumber()).to.be.greaterThan(0);
      expect(toAmount.toNumber()).to.be.greaterThan(0);
    });

    it('Should perform swap', async () => {
      await kbtc.connect(addr1).approve(
        contract.address,
        ADDR1_KBTC_BALANCE,
      );

      const kbtcBalanceBeforeSwap = await kbtc.balanceOf(addr1.address);
      const kusdtBalanceBeforeSwap: BigNumber = await kusdt.balanceOf(addr1.address);

      const {
        toAmount,
      } = await contract.connect(addr1).getEstimatedSwapDetails(
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      await expect(contract.connect(addr1).swap(
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      )).to.emit(contract, 'Swap');

      const kbtcBalanceAfterSwap = await kbtc.balanceOf(addr1.address);
      const kusdtBalanceAfterSwap = await kusdt.balanceOf(addr1.address);

      expect(kbtcBalanceBeforeSwap.sub(SWAP_AMOUNT)).to.be.equal(kbtcBalanceAfterSwap);
      // BTC costs approximately x20000 more that USDT
      expect(kusdtBalanceAfterSwap.toNumber()).to.be
        .greaterThan(kusdtBalanceBeforeSwap.add(SWAP_AMOUNT * 20000).toNumber());
      expect(kusdtBalanceBeforeSwap.add(toAmount)).to.equal(kusdtBalanceAfterSwap);
    });

    it('Should fail to swap with wrong fromToken', async () => {
      await expect(
        contract.connect(addr1).swap(
          contract.address, // this contract is not a token
          kusdt.address,
          SWAP_AMOUNT,
        ),
      ).to.be.revertedWith('From token does not exist');
    });

    it('Should fail to swap with wrong toToken', async () => {
      await expect(
        contract.connect(addr1).swap(
          kusdt.address,
          contract.address, // this contract is not a token
          SWAP_AMOUNT,
        ),
      ).to.be.revertedWith('To token does not exist');
    });

    it('Should fail to swap when not enough tokens on signer`s balance', async () => {
      const balance = await kbtc.balanceOf(addr1.address);

      await expect(
        contract.connect(addr1).swap(
          kbtc.address,
          kusdt.address,
          balance + 1, // more than available
        ),
      ).to.be.revertedWith('Not enough tokens on balance');
    });

    it('Should fail to swap when not enough tokens on contract`s balance', async () => {
      await kbtc.mint(addr1.address, DEFAULT_STAKE_AMOUNT + 1);
      await kbtc.connect(addr1).approve(
        contract.address,
        DEFAULT_STAKE_AMOUNT + 1,
      );

      await expect(
        contract.connect(addr1).swap(
          kbtc.address,
          kusdt.address,
          DEFAULT_STAKE_AMOUNT + 1, // more than available
        ),
      ).to.be.revertedWith('Not enough tokens in supply');
    });

    it('Should fail to swap with slippage more than 0.5%', async () => {
      await kbtc.connect(addr1).approve(
        contract.address,
        SWAP_AMOUNT * 2,
      );

      const {
        toAmount,
      } = await contract.connect(addr1).getEstimatedSwapDetails(
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      await expect(
        contract.connect(addr1).swapWithSlippageCheck(
          kbtc.address,
          kusdt.address,
          Math.round(SWAP_AMOUNT * 0.994), // adding 0.6% to make it fail
          toAmount.toNumber(),
        ),
      ).to.be.revertedWith('Slippage is more than 0.5%');
    });

    it('Should swap with slippage equal to 0.5%', async () => {
      await kbtc.connect(addr1).approve(
        contract.address,
        SWAP_AMOUNT * 2,
      );

      const {
        toAmount,
      } = await contract.connect(addr1).getEstimatedSwapDetails(
        kbtc.address,
        kusdt.address,
        SWAP_AMOUNT,
      );

      await expect(
        contract.connect(addr1).swapWithSlippageCheck(
          kbtc.address,
          kusdt.address,
          Math.round(SWAP_AMOUNT * 0.995), // adding 0.6% to make it fail
          toAmount.toNumber(),
        ),
      ).to.emit(contract, 'Swap');
    });
  });
});
