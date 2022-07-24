// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../test/IDataFeed.sol";

contract ALSMADEXTokens is Ownable {
    // Type declarations

    struct Token {
        address tokenAddress;
        address dataFeedAddress;
        string symbol;
        uint8 decimals;
    }

    // State variables

    Token[] tokens;

    // Events

    event TokenCreate(
        address _tokenAddress,
        address _tokenDataFeedAddress,
        string _tokenContractSymbol,
        uint8 decimals
    );

    // External

    function addToken(address tokenAddress, address tokenDataFeedAddress)
        external
        onlyOwner
    {
        (, bool isTokenAdded) = _getTokenIndexByAddress(tokenAddress);
        require(!isTokenAdded, "Add the token that already exists");

        ERC20 tokenContract = ERC20(tokenAddress);

        tokenContract.balanceOf(tokenAddress); // prevents adding wrong contracts
        IDataFeed(tokenDataFeedAddress).latestRoundData(); // prevents adding wrong contracts

        require(
            IDataFeed(tokenDataFeedAddress).decimals() == 8,
            "DateFeed decimals must be 8"
        );

        string memory tokenContractSymbol = tokenContract.symbol();

        tokens.push(
            Token(
                tokenAddress,
                tokenDataFeedAddress,
                tokenContractSymbol,
                tokenContract.decimals()
            )
        );

        emit TokenCreate(
            tokenAddress,
            tokenDataFeedAddress,
            tokenContractSymbol,
            tokenContract.decimals()
        );
    }

    function getTokenList() external view returns (Token[] memory) {
        return tokens;
    }

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

    function _getBalanceOfToken(address tokenAddress, address accountAddress)
        internal
        view
        returns (uint256)
    {
        return ERC20(tokenAddress).balanceOf(accountAddress);
    }

    function _getExchangeRateFromDataFeed(address dataFeedAddress)
        internal
        view
        returns (int256 answer, uint8 decimals)
    {
        (, answer, , , ) = IDataFeed(dataFeedAddress).latestRoundData();
        decimals = IDataFeed(dataFeedAddress).decimals();
    }

    function _getTokenDetails(address tokenAddress)
        internal
        view
        returns (
            Token memory token,
            uint256 balance,
            int256 exchangeRate
        )
    {
        (uint256 tokenIndex, bool isTokenAdded) = _getTokenIndexByAddress(
            tokenAddress
        );
        require(isTokenAdded, "Token does not exist");

        token = tokens[tokenIndex];
        balance = _getBalanceOfToken(token.tokenAddress, address(this));
        (exchangeRate, ) = _getExchangeRateFromDataFeed(token.dataFeedAddress);
    }
}
