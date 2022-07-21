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

    event TokenCreate(
        address _tokenAddress,
        address _tokenDataFeedAddress,
        string _tokenContractSymbol
    );

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

        string memory tokenContractSymbol = tokenContract.symbol();

        tokens.push(
            Token(tokenAddress, tokenDataFeedAddress, tokenContractSymbol)
        );

        emit TokenCreate(
            tokenAddress,
            tokenDataFeedAddress,
            tokenContractSymbol
        );

        return (tokenAddress, tokenDataFeedAddress, tokenContractSymbol);
    }
}

contract ALSMADEX is ALSMADEXTokens {
    fallback() external {}
}
