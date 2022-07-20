import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, Contract } from 'ethers';

describe.only('DataFeedUSDTUSDMock', () => {
  let contract: Contract;

  before(async () => {
    contract = await (await ethers.getContractFactory('DataFeedUSDTUSDMock')).deploy();
  });

  it('Should return the right data in latestRoundData', async () => {
    const {
      0: roundId,
      1: answer,
      2: startedAt,
      3: updatedAt,
      4: answeredInRound,
    } = await contract.latestRoundData();

    expect(roundId.eq(BigNumber.from('18446744073709556161'))).to.equal(true);
    expect(answer.eq(BigNumber.from('100000000'))).to.equal(true);
    expect(startedAt.eq(BigNumber.from('1658302510'))).to.equal(true);
    expect(updatedAt.eq(BigNumber.from('1658302510'))).to.equal(true);
    expect(answeredInRound.eq(BigNumber.from('18446744073709556161'))).to.equal(true);
  });

  it('Should return the right decimals', async () => {
    const decimals = await contract.decimals();

    expect(decimals).to.equal(8);
  });
});
