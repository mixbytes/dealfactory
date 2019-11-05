pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
contract AbstractProposal is Ownable {
    address public arbiter; // private?
    address public factory;

    constructor() internal {
        factory = msg.sender;
    }
}


contract Proposal is AbstractProposal {

    event ProposalWasSetUp(address customer);

    constructor() public AbstractProposal() {}

    function setup(address arbiterFromFactory, address customer) public returns (bool) {
        arbiter = arbiterFromFactory;
        transferOwnership(customer);
        emit ProposalWasSetUp(customer);
    }
}

contract ProposalTested is AbstractProposal {

    constructor() public AbstractProposal() {}

    function getSomeValue() public pure returns(uint256) {
        return 30;
    }
}