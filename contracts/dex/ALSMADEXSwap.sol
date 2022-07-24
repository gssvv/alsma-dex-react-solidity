// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./ALSMADEXComission.sol";

contract ALSMADEXSwap is ALSMADEXComission {
    // events
    event Swap();

    // external
    function swapWithSlippageCheck(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 fromAmount,
        uint256 expectedToAmount
    ) external {
        (, , uint256 toAmount) = getEstimatedSwapDetails(
            fromTokenAddress,
            toTokenAddress,
            fromAmount
        );

        // slippage is 0.5%
        require(
            toAmount >= (expectedToAmount - (expectedToAmount * 5) / 1000),
            "Slippage is more than 0.5%"
        );

        swap(fromTokenAddress, toTokenAddress, fromAmount);
    }

    // public

    function swap(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 fromAmount
    ) public {
        (
            uint256 fromTokenIndex,
            bool isFromTokenAdded
        ) = _getTokenIndexByAddress(fromTokenAddress);
        (uint256 toTokenIndex, bool isToTokenAdded) = _getTokenIndexByAddress(
            toTokenAddress
        );

        require(isFromTokenAdded, "From token does not exist");
        require(isToTokenAdded, "To token does not exist");

        ERC20 fromTokenContract = ERC20(fromTokenAddress);
        ERC20 toTokenContract = ERC20(toTokenAddress);

        require(fromAmount > 0, "Stake amount must be greater than 0");
        require(
            _getBalanceOfToken(fromTokenAddress, msg.sender) >= fromAmount,
            "Not enough tokens on balance"
        );
        require(
            fromTokenContract.allowance(msg.sender, address(this)) >=
                fromAmount,
            "Not enough approved tokens"
        );

        (, uint256 comissionTo, uint256 toAmount) = getEstimatedSwapDetails(
            fromTokenAddress,
            toTokenAddress,
            fromAmount
        );

        require(
            _getTotalSupply(toTokenAddress) >= toAmount,
            "Not enough tokens in supply"
        );

        /**
         * Distribute comission before transfering,
         * because totalSupply matters in calculation.
         */
        _distributeComission(toTokenAddress, comissionTo);

        fromTokenContract.transferFrom(msg.sender, address(this), fromAmount);
        toTokenContract.transfer(msg.sender, toAmount);

        emit Swap();
    }

    function getEstimatedSwapDetails(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 fromAmount
    )
        public
        view
        returns (
            int256 exchangeRate,
            uint256 comissionTo,
            uint256 toAmount
        )
    {
        (
            uint256 fromTokenIndex,
            bool isFromTokenAdded
        ) = _getTokenIndexByAddress(fromTokenAddress);
        (uint256 toTokenIndex, bool isToTokenAdded) = _getTokenIndexByAddress(
            toTokenAddress
        );

        require(isFromTokenAdded, "From token does not exist");
        require(isToTokenAdded, "To token does not exist");

        uint256 comissionRate = _calculateComissionRateForToken(toTokenAddress);
        uint256 comissionFrom = (fromAmount * comissionRate) / 10**10;

        (comissionTo, ) = _calculateExchange(
            tokens[fromTokenIndex],
            tokens[toTokenIndex],
            comissionFrom
        );

        (toAmount, exchangeRate) = _calculateExchange(
            tokens[fromTokenIndex],
            tokens[toTokenIndex],
            fromAmount - comissionFrom
        );
    }

    // internal

    /**
     * @dev Should take into account that decimals can be different.
     * Currently — not.
     * Because of that, we have require on ALSMADEXTokens.sol:43
     */
    function _calculateExchange(
        Token storage fromToken,
        Token storage toToken,
        uint256 fromAmount
    ) internal view returns (uint256 toAmount, int256 exchangeRate) {
        (int256 fromTokenExchangeRate, ) = _getExchangeRateFromDataFeed(
            fromToken.dataFeedAddress
        );
        (int256 toTokenExchangeRate, ) = _getExchangeRateFromDataFeed(
            toToken.dataFeedAddress
        );

        toAmount =
            (fromAmount * uint(fromTokenExchangeRate)) /
            uint(toTokenExchangeRate);

        exchangeRate = (fromTokenExchangeRate * 10**8) / toTokenExchangeRate;
    }

    /**
     * Distributes comission among stakers in tokenAddressToStakerAddressList[tokenAddress].
     * Share depends on «staked» value from tokenToStakerToStakeDetails.
     * Updates «earned» values.
     */
    function _distributeComission(address tokenAddress, uint256 comission)
        internal
    {
        uint256 totalSupply = _getTotalSupply(tokenAddress);

        uint256 residualShare = comission;
        comission -= comission / 10; // 10% belongs to DEX

        /**
         * Distribute among stakers based on the size of their stake
         * compared to the totalSupply
         */
        for (
            uint256 i = 0;
            i < tokenAddressToStakerAddressList[tokenAddress].length;
            i++
        ) {
            address stakerAddress = tokenAddressToStakerAddressList[
                tokenAddress
            ][i];
            StakeDetails storage stakerDetails = tokenToStakerToStakeDetails[
                tokenAddress
            ][stakerAddress];
            uint256 stakerRelativeShare = (stakerDetails.staked * 10**8) /
                totalSupply; // percent with 8 decimals
            uint256 stakerShare = (comission * stakerRelativeShare) / 10**8;

            stakerDetails.earned += stakerShare;

            residualShare -= stakerShare;
        }

        /**
         * There can be a «left over» after distribution.
         * Saving it to the treasury as well.
         */
        _sendTokensToTreasury(tokenAddress, residualShare);
    }
}
