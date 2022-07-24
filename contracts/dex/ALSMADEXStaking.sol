// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./ALSMADEXTreasury.sol";

contract ALSMADEXStaking is ALSMADEXTreasury {
    // Type declarations
    struct StakeDetails {
        uint256 staked;
        uint256 earned;
    }
    mapping(address => address[]) tokenAddressToStakerAddressList; // used for comission distribution

    // State variables
    mapping(address => mapping(address => StakeDetails)) tokenToStakerToStakeDetails;

    // Events
    event Stake(StakeDetails stakeDetails);
    event Unstake(uint256 amount);
    event WithdrawStakingProfits(uint256 amount);

    // Modifiers
    // External
    function stake(address tokenAddress, uint256 stakeAmount) external {
        ERC20 tokenContract = ERC20(tokenAddress);
        (uint256 tokenIndex, bool isTokenAdded) = _getTokenIndexByAddress(
            tokenAddress
        );

        require(isTokenAdded, "Token does not exist");
        require(stakeAmount > 0, "Stake amount must be greater than 0");
        require(
            _getBalanceOfToken(tokenAddress, msg.sender) >= stakeAmount,
            "Not enough tokens on balance"
        );
        require(
            tokenContract.allowance(msg.sender, address(this)) >= stakeAmount,
            "Not enough approved tokens"
        );

        // transfer tokens to DEX account
        tokenContract.transferFrom(msg.sender, address(this), stakeAmount);
        // make a record about the stake
        tokenToStakerToStakeDetails[tokenAddress][msg.sender]
            .staked = stakeAmount;
        // put the address to the list for further distribution
        if (!_stakerExists(tokenAddress, msg.sender)) {
            tokenAddressToStakerAddressList[tokenAddress].push(msg.sender);
        }

        emit Stake(tokenToStakerToStakeDetails[tokenAddress][msg.sender]);
    }

    function unstake(address tokenAddress, uint256 amount) external {
        StakeDetails storage stakeDetails = tokenToStakerToStakeDetails[
            tokenAddress
        ][msg.sender];

        require(stakeDetails.staked > 0, "Nothing to unstake");
        require(amount > 0, "Cannot unstake 0 tokens");

        ERC20(tokenAddress).transfer(msg.sender, stakeDetails.staked);
        stakeDetails.staked = 0;

        emit Unstake(amount);
    }

    function getStakeDetails(address tokenAddress)
        external
        view
        returns (StakeDetails memory)
    {
        return tokenToStakerToStakeDetails[tokenAddress][msg.sender];
    }

    function getStakeDetailsForAccount(
        address tokenAddress,
        address accountAddress
    ) external view returns (StakeDetails memory) {
        return tokenToStakerToStakeDetails[tokenAddress][accountAddress];
    }

    function withdrawAllStakingProfits(address tokenAddress) external {
        StakeDetails storage stakeDetails = tokenToStakerToStakeDetails[
            tokenAddress
        ][msg.sender];

        require(stakeDetails.earned > 0, "Nothing to withdraw");

        ERC20(tokenAddress).transfer(msg.sender, stakeDetails.earned);

        emit WithdrawStakingProfits(stakeDetails.earned);

        stakeDetails.earned = 0;
    }

    // internal

    function _stakerExists(address tokenAddress, address accountAddress)
        internal
        view
        returns (bool)
    {
        for (
            uint256 i = 0;
            i < tokenAddressToStakerAddressList[tokenAddress].length;
            i++
        ) {
            if (
                tokenAddressToStakerAddressList[tokenAddress][i] ==
                accountAddress
            ) {
                return true;
            }
        }

        return false;
    }

    function _getTotalSupply(address tokenAddress) internal returns (uint256) {
        return ERC20(tokenAddress).balanceOf(address(this));
    }
}
