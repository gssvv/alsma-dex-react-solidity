// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract DataFeedUSDTUSDMock {
    function latestRoundData()
        public
        pure
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = 18446744073709556161;
        answer = 100000000;
        startedAt = 1658302510;
        updatedAt = 1658302510;
        answeredInRound = 18446744073709556161;
    }

    function decimals() public pure returns (uint8) {
        return 8;
    }
}
