// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @custom:security-contact alxx.gusev@gmail.com
contract KindaUSDT is ERC20, Ownable {
    constructor() ERC20("KindaUSDT", "KUSDT") {
        _mint(msg.sender, 1000 * 10**decimals());
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
