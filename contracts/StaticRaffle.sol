//SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


//Array of all participants
//Array of winners
//Remove winners from participants array

//i_ is for immutable. s_ is for storage
contract StaticRaffle is VRFConsumerBaseV2, Ownable {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    VRFCoordinatorV2Interface internal immutable i_vrfCoordinator;
    uint64 internal immutable i_subscriptionId;
    bytes32 internal immutable i_keyHash;
    uint32 internal immutable i_callbackGasLimit;
    uint16 internal immutable i_requestConfirmations;

    uint32 internal s_numWords;

    EnumerableSet.Bytes32Set internal s_participants;
    EnumerableSet.Bytes32Set internal s_winners;
    bool internal s_isRaffleStarted;

    error RaffleCanBeRunOnlyOnce();

    event RaffleStarted(uint256 indexed requestId);
    event RaffleWinner(bytes32 indexed raffleWinner);
    event RaffleEnded(uint256 indexed requestId);

    modifier onlyOnce {
        if (s_isRaffleStarted) revert RaffleCanBeRunOnlyOnce();
        _;
    }

    constructor(
        bytes32[] memory participants,
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords) VRFConsumerBaseV2(vrfCoordinator) {
            i_subscriptionId = subscriptionId;
            i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
            i_keyHash = keyHash;
            i_callbackGasLimit = callbackGasLimit;
            i_requestConfirmations = requestConfirmations;
            s_numWords = numWords;

            uint256 length = participants.length;

            for (uint i = 0; i < length;) {
                s_participants.add(participants[i]);
                unchecked{
                ++i;
                }
            }

    }

    function runRaffle() external onlyOwner onlyOnce {
        s_isRaffleStarted = true;
        requestRandomWords();
    }

    function getWinners() external view returns(bytes32[] memory) {
        return s_winners.values();
    }


    function requestRandomWords() internal {
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            i_requestConfirmations,
            i_callbackGasLimit,
            s_numWords
        );
        emit RaffleStarted(requestId);
    }

    function fulfillRandomWords(uint256 requestId,
        uint256[] memory randomWords) internal virtual override {
        uint256 length = s_numWords;
        for(uint i = 0; i< length;) {
            bytes32 raffleWinner = s_participants.at(randomWords[i] % s_participants.length());

            s_winners.add(raffleWinner);

            s_participants.remove(raffleWinner);
            emit RaffleWinner(raffleWinner);
            emit RaffleEnded(requestId);
            unchecked {
                ++i;
            }
        }
    }
}
