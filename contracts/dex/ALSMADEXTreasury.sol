// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./ALSMADEXTokens.sol";

contract ALSMADEXTreasury is ALSMADEXTokens {
    // state

    mapping(address => uint256) treasury;

    // events
    event WithdrawTreasury(uint256 amount);

    // external

    function getTreasuryBalance(address tokenAddress)
        external
        view
        onlyOwner
        returns (uint256)
    {
        return treasury[tokenAddress];
    }

    function withdrawTreasury(address tokenAddress) external onlyOwner {
        require(treasury[tokenAddress] > 0, "Nothing to withdraw");

        ERC20(tokenAddress).transfer(msg.sender, treasury[tokenAddress]);

        emit WithdrawTreasury(treasury[tokenAddress]);

        treasury[tokenAddress] = 0;
    }

    // internal

    function _sendTokensToTreasury(address tokenAddress, uint256 amount)
        internal
    {
        treasury[tokenAddress] += amount;
    }
}
