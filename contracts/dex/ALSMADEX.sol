// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./ALSMADEXSwap.sol";

contract ALSMADEX is ALSMADEXSwap {
    receive() external payable {
        payable(owner()).transfer(msg.value);
    }

    fallback() external {}
}
