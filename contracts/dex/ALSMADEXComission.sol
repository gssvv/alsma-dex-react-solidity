// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ALSMADEXStaking.sol";

contract ALSMADEXComission is ALSMADEXStaking {
    // external
    function getTokenDetailsWithComission(address tokenAddress)
        external
        view
        returns (
            Token memory token,
            uint256 balance,
            int256 exchangeRate,
            uint256 comissionRate
        )
    {
        (token, balance, exchangeRate) = _getTokenDetails(tokenAddress);
        comissionRate = _calculateComissionRateForToken(token.tokenAddress);
    }

    // internal

    /**
     * Obsiously suboptimal way to calculate comissions,
     * but it works okay in our conditions.
     *
     * In other DEX tokens are usually compared in pairs
     * Here — tokens compared all between each other.
     *
     * Meaning that if we have one token with extremely large pool,
     * it will dump comission for others.
     *
     * Conditions:
     * - bigger pool (compared to other tokens) — less comission
     * - maximum — 10%
     * - minumum — 1%
     *
     * 1.00% = 100000000 (8 decimals)
     */
    function _calculateComissionRateForToken(address tokenAddress)
        internal
        view
        returns (uint256)
    {
        uint256 greatestBalance = 0;
        uint256 leastBalance = 2**256 - 1; // max uint256 value
        uint256 tokenBalance = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = ERC20(tokens[i].tokenAddress).balanceOf(
                address(this)
            );

            if (balance > greatestBalance) greatestBalance = balance;
            if (balance < leastBalance) leastBalance = balance;
            if (tokens[i].tokenAddress == tokenAddress) tokenBalance = balance;
        }

        uint256 lowestAndGreatestDifference = greatestBalance - leastBalance;

        if (lowestAndGreatestDifference == 0) return 50000000;

        // prevents underflow during comission calculation
        tokenBalance = tokenBalance > lowestAndGreatestDifference
            ? lowestAndGreatestDifference
            : tokenBalance;

        uint256 comission = (((lowestAndGreatestDifference - tokenBalance) *
            10**8) / lowestAndGreatestDifference);

        return comission * 9 + 10**8; // feeRatio * (maxFee% - minFee%) + minFee
    }
}
