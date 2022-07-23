// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract DataFeedBTCUSDMock {
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
        roundId = 18446744073709554604;
        answer = 2405972000000;
        startedAt = 1658328854;
        updatedAt = 1658328854;
        answeredInRound = 18446744073709554604;
    }

    function decimals() public pure returns (uint8) {
        return 8;
    }
}
