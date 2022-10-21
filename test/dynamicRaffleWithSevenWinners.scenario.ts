import {DynamicRaffle, VRFCoordinatorV2Mock} from "../typechain-types";
import {ethers} from "hardhat";
import {keccak256, parseEther, toUtf8Bytes} from "ethers/lib/utils";
import {ContractTransaction, ContractReceipt} from "ethers";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {assert} from 'chai'
import {generateMerkleTree} from "./shared/generateMerkleTree";

describe(`Dynamic Raffle with seven winners`, async () => {
    async function deployDynamicRaffleFixture() {
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


        const ticketNumbers: string[] = [
            "A1",
            "B2",
            "C3",
            "E4",
            "F5",
            "C6",
            "A8",
            "B99",
            "C14"

        ]
        const {merkleRoot, merkleTree} = await generateMerkleTree(ticketNumbers)

        const dynamicRaffleFactory = await ethers.getContractFactory("DynamicRaffle");

        const dynamicRaffle: DynamicRaffle = await dynamicRaffleFactory.deploy(
            subscriptionId,
            mockVRFCoordinator.address,
            keyHash,
            callbackGasLimit,
            requestConfirmations,
            numWords,
            deployer.address,
            merkleRoot,

        )
        console.log("deployed")
        await mockVRFCoordinator.fundSubscription(subscriptionId, parseEther("10"));
        await mockVRFCoordinator.addConsumer(subscriptionId, dynamicRaffle.address)

        return {dynamicRaffle, deployer, mockVRFCoordinator, numWords, ticketNumbers, merkleTree}
    }

    describe(`Running raffle scenario`, async () => {
        it(`should run raffle and determine seven winners only once`, async () => {
            const fixture = await loadFixture(deployDynamicRaffleFixture);
            if (!fixture) return;
            console.log("HERE");
            (await ethers.getSigners()).slice(1, 8).forEach((participant, i) => {
                console.log(i);
                const ticketConfirmationNumber = fixture.ticketNumbers[i];
                const hashedTicketConfirmationNumber = keccak256(toUtf8Bytes(ticketConfirmationNumber));
                const proof = fixture.merkleTree.getHexProof(hashedTicketConfirmationNumber)
                fixture.dynamicRaffle.connect(participant).enterRaffle(hashedTicketConfirmationNumber,proof)
            })

            const tx: ContractTransaction = await fixture.dynamicRaffle.connect(fixture.deployer).startRaffle();
            const txReceipt: ContractReceipt = await tx.wait(1);
            if (!txReceipt.events) return;
            if (!txReceipt.events[1].args) return;
            const requestId = txReceipt.events[1].args[0]

            await fixture.mockVRFCoordinator.fulfillRandomWords(requestId, fixture.dynamicRaffle.address);
            const winners = await  fixture.dynamicRaffle.getWinners()

            assert(winners.length === fixture.numWords, "Invalid Winners number")
        })
    })
})