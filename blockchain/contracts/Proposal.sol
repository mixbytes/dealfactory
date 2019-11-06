pragma solidity 0.5.12;


contract ProposalStateDataTransferer {
    // states main state variables used in setup and other functions
    // these state variables are used in state transitions
    uint256 public customerTaskDeadline;
    uint256 public arbiterDaiReward;
    bytes public customerTaskIPFSHash;
    address public arbiter;
    address public contractor;
    address public customer;
}


contract ProposalStateTransitioner is ProposalStateDataTransferer {

    modifier onlyParties {
        require(
            msg.sender == customer ||
            msg.sender == contractor ||
            msg.sender == arbiter,
            "Only customer, contractor or arbiter");
        _;
    }

    enum States {ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED}

    States public currentState;

    event ProposalStateChangedToBy(States state, address who);
    //function responseToProposal(uint256 contractorDeadline, uint256 contractorReward) external;
    //function pushToPrepaidState() external;
    //function announceTaskCompleted() external;
    //function startDispute() external;
    //function resolveDispute() external;
    function closeProposal() external onlyParties {
        require(customerTaskDeadline < now, "Cancellation deadline condition is not met");
        changeStateTo(States.CLOSED);
    }

    function changeStateTo(States nextState) internal;
}


contract AbstractProposal {

    address public factory;

    event ProposalWasSetUp(address customer);

    constructor() internal {
        factory = msg.sender;
    }

    function setup(
        address _arbiter,
        address _customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes calldata taskIpfsHash,
        address _contractor
    )
        external
    {
        require(msg.sender == factory, "Function can be called only by factory");
        internalSetup(_arbiter, _customer, deadline, arbiterReward, taskIpfsHash, _contractor);
    }

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes memory taskIpfsHash,
        address _contractor
    )
        internal;
}


contract Proposal is AbstractProposal, ProposalStateTransitioner {

    constructor() public AbstractProposal() {}

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes memory taskIpfsHash,
        address _contractor
    )
        internal
    {
        require(deadline > now, "Deadline can not be less or equal to now");
        require(arbiterReward > 0, "Arbiter award should be more than zero");

        arbiter = _arbiter;
        currentState = States.INIT;

        arbiterDaiReward = arbiterReward;
        customerTaskDeadline = deadline;
        customerTaskIPFSHash = taskIpfsHash;
        customer = _customer;
        contractor = _contractor;

        emit ProposalWasSetUp(customer);
    }

    function changeStateTo(States nextState) internal {
        if (nextState == States.CLOSED) {
            selfdestruct(msg.sender);
        }
    }
}