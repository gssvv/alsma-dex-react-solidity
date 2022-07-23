// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface DataFeed {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
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
        returns (int256 answer)
    {
        (, answer, , , ) = DataFeed(dataFeedAddress).latestRoundData();
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
        exchangeRate = _getExchangeRateFromDataFeed(token.dataFeedAddress);
    }
}

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

contract ALSMADEXSwap is ALSMADEXComission {
    // events
    event Swap();

    // external

    function swap(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 fromAmount
    ) external {
        (
            uint256 fromTokenIndex,
            bool isFromTokenAdded
        ) = _getTokenIndexByAddress(fromTokenAddress);
        (uint256 toTokenIndex, bool isToTokenAdded) = _getTokenIndexByAddress(
            toTokenAddress
        );

        require(isFromTokenAdded, "From token does not exist");
        require(isToTokenAdded, "To token does not exist");

        ERC20 tokenContract = ERC20(fromTokenAddress);

        require(fromAmount > 0, "Stake amount must be greater than 0");
        require(
            _getBalanceOfToken(fromTokenAddress, msg.sender) >= fromAmount,
            "Not enough tokens on balance"
        );
        require(
            tokenContract.allowance(msg.sender, address(this)) >= fromAmount,
            "Not enough approved tokens"
        );

        // uint256 targetAmount =
        // require(
        //             _getTotalSupply(toTokenAddress) >= targetAmount,
        //             "Not enough tokens in supply"
        //         );

        _distributeComission(fromTokenAddress, fromAmount);
    }

    // internal

    /**
     * Distributes comission among stakers in tokenAddressToStakerAddressList[tokenAddress].
     * Share depends on «staked» value from tokenToStakerToStakeDetails.
     * Updates «earned» values.
     */
    function _distributeComission(address tokenAddress, uint256 amount)
        internal
    {
        console.log("%s", amount);
        uint256 totalSupply = _getTotalSupply(tokenAddress);
        uint256 comission = _calculateComissionRateForToken(tokenAddress);
        uint256 comissionShare = (comission * amount) / 10**8; // divide by comission decimals

        uint256 residualShare = comissionShare;
        comissionShare -= comissionShare / 10; // 10% belongs to DEX

        /**
         * Distiribute among stakers based on the size of their stake
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
            uint256 stakerShare = (comissionShare * stakerRelativeShare) /
                10**8;

            stakerDetails.earned += stakerShare;

            residualShare -= stakerShare;
        }

        /**
         * There can be a «left over» after distribution.
         * Saving it to the treasury as well.
         */
        _sendTokensToTreasury(tokenAddress, residualShare);

        emit Swap();
    }
}

contract ALSMADEX is ALSMADEXSwap {
    receive() external payable {
        payable(owner()).transfer(msg.value);
    }

    fallback() external {}
}
