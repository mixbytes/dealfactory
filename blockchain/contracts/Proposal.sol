pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
contract AbstractProposal is Ownable {
    address public arbiter; // private?

    constructor(address _arbiter, address proposalOwner) internal {
        arbiter = _arbiter;
        transferOwnership(proposalOwner);
    }

    function getSomeValue() public pure returns(uint256);
}


contract Proposal is AbstractProposal {

    constructor(address proposalOwner, address _arbiter) public AbstractProposal(proposalOwner, _arbiter) {}

    function getSomeValue() public pure returns(uint256) {
        return 25;
    }
}

contract ProposalTested is AbstractProposal {

    constructor(address proposalOwner, address _arbiter) public AbstractProposal(proposalOwner, _arbiter) {}

    function getSomeValue() public pure returns(uint256) {
        return 30;
    }
}