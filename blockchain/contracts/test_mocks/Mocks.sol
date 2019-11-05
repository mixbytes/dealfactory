pragma solidity 0.5.12;

import "../Proposal.sol";

contract ProposalMock is AbstractProposal {
    //code version : https://github.com/mixbytes/renderhash/tree/0e86749c671dd0ac248c22395ed007fcc98d4bd5

    constructor() public AbstractProposal() {}

    function setup(address arbiterFromFactory, address customer) public {
        arbiter = arbiterFromFactory;
        emit ProposalWasSetUp(customer);
    }
}