import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, Contract } from 'ethers';

describe('DataFeedBTCUSDMock', () => {
  let contract: Contract;

  before(async () => {
    contract = await (await ethers.getContractFactory('DataFeedBTCUSDMock')).deploy();
  });

  it('Should return the right data in latestRoundData', async () => {
    const {
      roundId,
      answer,
      startedAt,
      updatedAt,
      answeredInRound,
    } = await contract.latestRoundData();

    expect(roundId.eq(BigNumber.from('18446744073709554604'))).to.equal(true);
    expect(answer.eq(BigNumber.from('2405972000000'))).to.equal(true);
    expect(startedAt.eq(BigNumber.from('1658328854'))).to.equal(true);
    expect(updatedAt.eq(BigNumber.from('1658328854'))).to.equal(true);
    expect(answeredInRound.eq(BigNumber.from('18446744073709554604'))).to.equal(true);
  });

  it('Should return the right decimals', async () => {
    const decimals = await contract.decimals();

    expect(decimals).to.equal(8);
  });
});
