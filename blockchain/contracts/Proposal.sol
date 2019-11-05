pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract AbstractProposal {

    modifier onlyParties {
        require(
            msg.sender == customer ||
            msg.sender == contractor ||
            msg.sender == arbiter,
            "Only customer, contractor or arbiter");
        _;
    }

    enum States {ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED}

    address public arbiter; // private?
    address public factory;
    address public contractor;
    address public customer;
    States public currentState;

    event ProposalWasSetUp(address customer);
    event ProposalStateChangedToBy(States state, address who);

    constructor() internal {
        factory = msg.sender;
    }


    function setup(
        address arbiterFromFactory,
        address _customer,
        uint256 deadline,
        uint256 arbiterReward,
        bytes calldata taskIpfsHash
    )
        external
    {
        require(msg.sender == factory, "Function can be called only by factory");
        internalSetup(arbiterFromFactory, _customer, deadline, arbiterReward, taskIpfsHash);
    }

    function pushStateForwardTo(States nextState) external onlyParties {
        changeStateTo(nextState);

        emit ProposalStateChangedToBy(nextState, msg.sender);
    }

    function changeStateTo(States nextState) internal;
    function internalSetup(
        address arbiterFromFactory,
        address _customer,
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
        address _customer,
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
        customer = _customer;

        emit ProposalWasSetUp(customer);
    }

    function changeStateTo(States nextState) internal {
        // mock
        nextState;
    }
}