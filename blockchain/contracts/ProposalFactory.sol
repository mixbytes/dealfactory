pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Proposal.sol";

contract ProposalFactory is Ownable {
    address public generalArbiter;

    event ProposalCreated(address customer, address proposalAddress);

    constructor(address arbiter) public {
        generalArbiter = arbiter;
    }

    function createProposal() public {
        Proposal newProposal = new Proposal(msg.sender, generalArbiter);
        emit ProposalCreated(msg.sender, address(newProposal));
    }

    //register ProposalAbstraction - попробуй сделать обновляемость
    // через использование абстракции/интерфейса пропосала, но не конкретной реализации
}