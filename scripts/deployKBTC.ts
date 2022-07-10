import { ethers } from 'hardhat';

async function main() {
  const Factory = await ethers.getContractFactory('KindaBTC');
  const contract = await Factory.deploy();

  await contract.deployed();

  console.log('Deployed KBTC to address:', contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
