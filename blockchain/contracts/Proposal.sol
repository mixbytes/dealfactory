pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
contract AbstractProposal is Ownable {

    modifier onlyFactory {
        require(msg.sender == factory, "Function can be called only by factory");
        _;
    }

    enum States {ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED}

    address public arbiter; // private?
    address public factory;
    States currentState;

    event ProposalWasSetUp(address customer);

    constructor() internal {
        factory = msg.sender;
    }

    function setup(
        address arbiterFromFactory,
        address customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes calldata taskIpfsHash
    )
        external
        onlyFactory
    {
        internalSetup(arbiterFromFactory, customer, deadline, arbiterReward, taskIpfsHash);
    }

    function internalSetup(
        address arbiterFromFactory,
        address customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes memory taskIpfsHash
    )
        internal;
}


contract Proposal is AbstractProposal {

    uint256 public customerTaskDeadline;
    uint256 public arbiterDaiReward;
    bytes public customerTaskIPFSHash;

    constructor() public AbstractProposal() {}

    function internalSetup(
        address arbiterFromFactory,
        address customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes memory taskIpfsHash
    )
        internal
    {
        require(deadline > now, "Deadline can not be less or equal to now");
        require(arbiterReward > 0, "Arbiter award should be more than zero");

        arbiter = arbiterFromFactory;
        currentState = States.INIT;

        arbiterDaiReward = arbiterReward;
        customerTaskDeadline = deadline;
        customerTaskIPFSHash = taskIpfsHash;

        transferOwnership(customer);

        emit ProposalWasSetUp(customer);
    }
}

contract ProposalTested is AbstractProposal {
    //code version : https://github.com/mixbytes/renderhash/tree/0e86749c671dd0ac248c22395ed007fcc98d4bd5

    constructor() public AbstractProposal() {}

    function setup(address arbiterFromFactory, address customer) public onlyOwner {
        arbiter = arbiterFromFactory;
        transferOwnership(arbiter); // hehe tricky
        emit ProposalWasSetUp(customer);
    }
}