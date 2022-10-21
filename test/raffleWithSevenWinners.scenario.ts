import {StaticRaffle, VRFCoordinatorV2Mock} from "../typechain-types";
import {ethers} from "hardhat";
import {BytesLike, parseEther} from "ethers/lib/utils";
import {ContractTransaction, ContractReceipt} from "ethers";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {assert} from 'chai'

describe(`Static Raffle with seven winners`, async () => {
    async function deployStaticRaffleFixture() {
        const [deployer] = await ethers.getSigners();
        /*
            @dev read more at docs.chain.link/docs/chainlink-vrf
         */
        const BASE_FEE = "1000000000000000000"; //1 LINK
        const GAS_PRICE_LINK = "1000000000" // 0.0000000001 LINK
        const vrfCoordinatorFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock");
        const mockVRFCoordinator: VRFCoordinatorV2Mock = await vrfCoordinatorFactory.deploy(BASE_FEE, GAS_PRICE_LINK);
        const tx: ContractTransaction = await mockVRFCoordinator.createSubscription();
        const txReceipt: ContractReceipt = await tx.wait(1)
        if (!txReceipt.events) return;
        const subscriptionId = ethers.BigNumber.from(txReceipt.events[0].topics[1]);

        //grab from the docs for goerli eth network
        const keyHash = `0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15`;
        const callbackGasLimit = 2500000
        const requestConfirmations = 5;
        const numWords = 7; //we are looking for 7 winners

        const mockParticipants: BytesLike[] = [
            `0x3ac225168df54212a25c1c01fd35bebfea408fdac2e31ddd6f80a4bbf9a5f1cb`,
            `0xb5553de315e0edf504d9150af82dafa5c4667fa618ed0a6f19c69b41166c5510`,
            `0x0b42b6393c1f53060fe3ddbfcd7aadcca894465a5a438f69c87d790b2299b9b2`,
            `0xf1918e8562236eb17adc8502332f4c9c82bc14e19bfc0aa10ab674ff75b3d2f3`,
            `0xa8982c89d80987fb9a510e25981ee9170206be21af3c8e0eb312ef1d3382e761`,
            `0xd1e8aeb79500496ef3dc2e57ba746a8315d048b7a664a2bf948db4fa91960483`,
            `0x14bcc435f49d130d189737f9762feb25c44ef5b886bef833e31a702af6be4748`,
            `0xa766932420cc6e9072394bef2c036ad8972c44696fee29397bd5e2c06001f615`,
        ]

        const staticRaffleFactory = await ethers.getContractFactory("StaticRaffle");
        const staticRaffle: StaticRaffle = await staticRaffleFactory.deploy(
            mockParticipants,
            subscriptionId,
            mockVRFCoordinator.address,
            keyHash,
            callbackGasLimit,
            requestConfirmations,
            numWords,

        )
        await mockVRFCoordinator.fundSubscription(subscriptionId, parseEther("10"));
        await mockVRFCoordinator.addConsumer(subscriptionId, staticRaffle.address)

        return {staticRaffle, deployer, mockVRFCoordinator, numWords}
    }

    describe(`Running raffle scenario`, async () => {
        it(`should run raffle and determine seven winners only once`, async () => {
            const fixture = await loadFixture(deployStaticRaffleFixture);
            if (!fixture) return;

            const tx: ContractTransaction = await fixture.staticRaffle.connect(fixture.deployer).runRaffle();
            const txReceipt: ContractReceipt = await tx.wait(1);
            if (!txReceipt.events) return;
            if (!txReceipt.events[1].args) return;
            const requestId = txReceipt.events[1].args[0]
            console.log(requestId)

            await fixture.mockVRFCoordinator.fulfillRandomWords(requestId, fixture.staticRaffle.address);
            const winners = await  fixture.staticRaffle.getWinners()
            console.log(winners)
            assert(winners.length === fixture.numWords, "Invalid Winners number")
        })
    })
})