pragma solidity 0.5.12;


contract ProposalStateDataTransferer {
    // states main state variables used in setup and other functions
    // these state variables are used in state transitions
    address public arbiter;
    address public contractor;
    address public customer;

    uint256 public taskDeadline;
    bytes public taskIPFSHash;

    uint256 public arbiterDaiReward;
    uint256 public contractorDaiReward;
}


contract ProposalStateTransitioner is ProposalStateDataTransferer {
    // logic of state, its transition and conditionals

    modifier onlyParties {
        require(
            msg.sender == customer ||
            msg.sender == contractor ||
            msg.sender == arbiter,
            "Only customer, contractor or arbiter");
        _;
    }

    modifier deadlineNotOver {
        require(taskDeadline >= now, "The time for this action is over");
        _;
    }

    enum States {ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED}
    States public currentState;

    event ProposalStateChangedToBy(States state, address who);

    function responseToProposal(uint256 contractorDeadline, uint256 contractorReward)
        external
    {
        require(msg.sender == contractor, "Wrong access");
        require(
            currentState == States.INIT || currentState == States.PROPOSED,
            "This action can be called only from INIT or PROPOSED state");
        require(contractorDeadline > now, "Your deadline should be gt now");
        changeStateTo(States.PROPOSED, contractorDeadline, contractorReward);

        emit ProposalStateChangedToBy(States.PROPOSED, msg.sender);
    }

    //function pushToPrepaidState() external;
    //function announceTaskCompleted() external;
    //function startDispute() external;
    //function resolveDispute() external;

    function closeProposal() external onlyParties {
        require(
            currentState == States.INIT || currentState == States.PROPOSED,
            "Proposal cancellation conditions are not met"
        );
        changeStateTo(States.CLOSED, 0, 0);

        emit ProposalStateChangedToBy(States.CLOSED, msg.sender);
    }

    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward
    )
        internal;
}


contract ProposalSetupper is ProposalStateTransitioner{

    address public factory;

    event ProposalWasSetUp(address customer);

    constructor() internal {
        factory = msg.sender;
    }

    function setup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        bytes calldata _taskIPFSHash,
        address _contractor
    )
        external
    {
        require(msg.sender == factory, "Function can be called only by factory");
        internalSetup(_arbiter, _customer, arbiterReward, _taskIPFSHash, _contractor);

        emit ProposalWasSetUp(_customer);
    }

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        bytes memory _taskIPFSHash,
        address _contractor
    )
        internal;
}


contract Proposal is ProposalSetupper {

    constructor() public ProposalSetupper() {}

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        bytes memory _taskIPFSHash,
        address _contractor
    )
        internal
    {
        require(arbiterReward > 0, "Arbiter award should be more than zero");

        arbiter = _arbiter;
        arbiterDaiReward = arbiterReward;
        customer = _customer;
        contractor = _contractor;

        currentState = States.INIT;
        taskIPFSHash = _taskIPFSHash;
    }

    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward
    )
        internal
    {
        if (nextState == States.CLOSED) {
            selfdestruct(msg.sender);
            // curState = close?
        }

        if (nextState == States.PROPOSED) {
            taskDeadline = newDeadline;
            contractorDaiReward = contractorReward;
            currentState = States.PROPOSED;
        }
    }
}