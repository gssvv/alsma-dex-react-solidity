import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

describe('KindaBTC', () => {
  let decimals: number; // will be set to contract.decimals() in beforeEach

  let KBTC: any;
  let kbtc: any;

  let signer: SignerWithAddress;
  let addr1: SignerWithAddress;

  const INITIAL_STOCK = 1000;

  /**
   * @example
   * // returns 1000 when the decimals is 18
   * integerToFloat(BigNumber.from(10).pow(21))
   */
  const integerToFloat = (integer: BigNumber): number => (
    integer.div(BigNumber.from(10).pow(decimals)).toNumber()
  );
  /**
   * @example
   * // returns BigBumber({ value: 1e18 }) when the decimals is 18
   * floatToInteger(1)
   */
  const floatToInteger = (integer: Number): BigNumber => (
    BigNumber.from(integer).mul(BigNumber.from(10).pow(decimals))
  );

  beforeEach(async () => {
    [signer, addr1] = await ethers.getSigners();

    KBTC = await ethers.getContractFactory('KindaBTC');
    kbtc = await KBTC.deploy();
    decimals = await kbtc.decimals();
  });

  describe('Deployment', () => {
    it('Should set the right initial balance for sender', async () => {
      const balance = await kbtc.balanceOf(signer.address);

      expect(integerToFloat(balance)).to.equal(INITIAL_STOCK);
    });
  });

  describe('Transfer', () => {
    const AMOUNT_TO_TRANSFER = 100;

    it('Should transfer tokens', async () => {
      await kbtc.transfer(addr1.address, floatToInteger(AMOUNT_TO_TRANSFER));

      const fromBalance = await kbtc.balanceOf(signer.address);
      const toBalance = await kbtc.balanceOf(addr1.address);

      expect(integerToFloat(fromBalance)).to.equal(INITIAL_STOCK - AMOUNT_TO_TRANSFER);
      expect(integerToFloat(toBalance)).to.equal(AMOUNT_TO_TRANSFER);
    });

    it('Should not transfer tokens balance exceeded', async () => {
      expect(
        await new Promise((res) => kbtc.transfer(
          addr1.address, floatToInteger(INITIAL_STOCK + 1),
        ).then(res.bind(this, false)).catch(res.bind(this, true))),
      ).to.equal(true, 'Throw an error');
    });
  });

  describe('Mint', () => {
    const MINT_AMOUNT = 100;

    it('Should mint to owner', async () => {
      await kbtc.mint(signer.address, floatToInteger(MINT_AMOUNT));
      const balance = await kbtc.balanceOf(signer.address);

      expect(integerToFloat(balance)).to.equal(INITIAL_STOCK + MINT_AMOUNT);
    });

    it('Should mint to other address', async () => {
      await kbtc.mint(addr1.address, floatToInteger(MINT_AMOUNT));
      const balance = await kbtc.balanceOf(addr1.address);

      expect(integerToFloat(balance)).to.equal(MINT_AMOUNT);
    });
  });
});
