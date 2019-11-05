pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
contract AbstractProposal is Ownable {
    address public arbiter; // private?
    address public factory;

    event ProposalWasSetUp(address customer);

    constructor() internal {
        factory = msg.sender;
    }

    function setup(address arbiterFromFactory, address customer) public onlyOwner {} // onlyFactory?
}


contract Proposal is AbstractProposal {

    constructor() public AbstractProposal() {}

    function setup(address arbiterFromFactory, address customer) public onlyOwner {
        arbiter = arbiterFromFactory;
        transferOwnership(customer);
        emit ProposalWasSetUp(customer);
    }
}

contract ProposalTested is AbstractProposal {
    
    constructor() public AbstractProposal() {}

    function setup(address arbiterFromFactory, address customer) public onlyOwner {
        arbiter = arbiterFromFactory;
        transferOwnership(arbiter); // hehe tricky
        emit ProposalWasSetUp(customer);
    }
}