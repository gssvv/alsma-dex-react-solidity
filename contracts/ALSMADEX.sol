// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface DataFeed {
    function latestRoundData()
        external
        pure
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external pure returns (uint8);
}

contract ALSMADEXTokens is Ownable {
    struct Token {
        address tokenAddress;
        address dataFeedAddress;
        string symbol;
    }

    Token[] tokens;

    function addToken(address tokenAddress, address tokenDataFeedAddress)
        external
        onlyOwner
        returns (
            address,
            address,
            string memory
        )
    {
        ERC20 tokenContract = ERC20(tokenAddress);

        tokenContract.balanceOf(tokenAddress); // prevents adding wrong contracts
        DataFeed(tokenDataFeedAddress).latestRoundData(); // prevents adding wrong contracts

        string memory tokenContractName = tokenContract.name();

        tokens.push(
            Token(tokenAddress, tokenDataFeedAddress, tokenContractName)
        );

        return (tokenAddress, tokenDataFeedAddress, tokenContractName);
    }

    function test() external returns (uint104) {
        return 1;
    }
}

contract ALSMADEX is ALSMADEXTokens {
    fallback() external {}
}
