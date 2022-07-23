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
    // Type declarations

    struct Token {
        address tokenAddress;
        address dataFeedAddress;
        string symbol;
    }

    // State variables

    Token[] tokens;

    // Events

    event TokenCreate(
        address _tokenAddress,
        address _tokenDataFeedAddress,
        string _tokenContractSymbol
    );

    // Modifiers

    // External

    function addToken(address tokenAddress, address tokenDataFeedAddress)
        external
        onlyOwner
    {
        (, bool isTokenAdded) = _getTokenIndexByAddress(tokenAddress);
        require(!isTokenAdded, "Add the token that already exists");

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
    }

    function getTokenList() external view returns (Token[] memory) {
        return tokens;
    }

    function getTokenDetails(address tokenAddress)
        external
        view
        returns (
            Token memory token,
            uint256 balance,
            int256 exchangeRate,
            uint256 comissionRate
        )
    {
        (uint256 tokenIndex, bool isTokenAdded) = _getTokenIndexByAddress(
            tokenAddress
        );
        require(isTokenAdded, "Token does not exist");

        token = tokens[tokenIndex];
        balance = _getBalanceOfToken(token.tokenAddress);
        exchangeRate = _getExchangeRateFromDataFeed(token.dataFeedAddress);
        comissionRate = _getComissionRateForToken(token.tokenAddress);
    }

    // public

    // internal

    /**
     * @notice Returns 0 even if address wasn't found.
     * Check isFoundAny value.
     */
    function _getTokenIndexByAddress(address tokenAddress)
        internal
        view
        returns (uint256 index, bool isTokenAdded)
    {
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i].tokenAddress == tokenAddress) {
                return (i, true);
            }
        }
        return (0, false);
    }

    function _getBalanceOfToken(address tokenAddress)
        internal
        view
        returns (uint256)
    {
        return ERC20(tokenAddress).balanceOf(tokenAddress);
    }

    function _getComissionRateForToken(address tokenAddress)
        internal
        view
        returns (uint256)
    {
        return 0;
    }

    function _getExchangeRateFromDataFeed(address dataFeedAddress)
        internal
        view
        returns (int256 answer)
    {
        (, answer, , , ) = DataFeed(dataFeedAddress).latestRoundData();
    }

    // private
}

contract ALSMADEX is ALSMADEXTokens {
    fallback() external {}
}
