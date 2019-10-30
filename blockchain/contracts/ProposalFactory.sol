pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Proposal.sol";

contract ProposalFactory is Ownable {
    address generalArbiter;

    constructor(address arbiter) public {
        generalArbiter = arbiter;
    }

    function createProposal() public returns (address){
        return address(new Proposal(msg.sender, generalArbiter));
    }

    //register ProposalAbstraction - look up uniswap example
}