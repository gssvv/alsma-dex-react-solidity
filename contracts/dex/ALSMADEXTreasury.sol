// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./ALSMADEXTokens.sol";

contract ALSMADEXTreasury is ALSMADEXTokens {
    mapping(address => uint256) treasury;

    // external

    function getTreasuryBalance(address tokenAddress)
        external
        view
        returns (uint256)
    {
        return treasury[tokenAddress];
    }

    // internal

    function _sendTokensToTreasury(address tokenAddress, uint256 amount)
        internal
    {
        treasury[tokenAddress] += amount;
    }
}
