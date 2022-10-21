# Chainlink Hackathon Raffle

We have implemented two raffles.

A Static Raffle which pre-defines participants and
uses Chainlink VRF to determine winners.

A Dynamic Raffle that supports the addition of participants
in real time, provided they submit a valid ticket hash stored
in a Merkle Tree.


To run:

```bash
yarn install

npx hardhat compile

npx hardhat test
```
