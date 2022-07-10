import { ethers } from 'hardhat';

async function main() {
  const Factory = await ethers.getContractFactory('KindaUSDT');
  const contract = await Factory.deploy();

  await contract.deployed();

  console.log('Deployed KUSDT to address:', contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
