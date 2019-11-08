pragma solidity 0.5.12;


import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/IERC20.sol';
import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';


contract ProposalStateDataTransferer {
    // states main state variables used in setup and other functions
    // these state variables are used in state transitions
    address public arbiter;
    address public contractor;
    address public customer;

    address public daiToken;

    uint256 public taskDeadline;
    bytes public taskIPFSHash;
    bytes public doneTaskIPFSHash;

    uint256 public arbiterDaiReward;
    uint256 public contractorDaiReward;

    /**
      This variable states timestamp which bounds cancellation in PREPAID state
      and transition to DISPUTE: you can't cancel in PREPAID 24h after you locked
      tokens in proposal, you can't dispute 24h after proposal state was moved
      to COMPLETED.
    */
    uint256 _revertDeadline;
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

    enum States {ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED}
    States public currentState;

    event ProposalStateChangedToBy(States state, address who);
    event ProposalCloseWasCalledBy(address who);

    function responseToProposal(uint256 contractorDeadline, uint256 contractorReward)
        external
    {
        require(msg.sender == contractor, "Invalid access");
        require(
            currentState == States.INIT || currentState == States.PROPOSED,
            "This action can be called only from INIT or PROPOSED state"
        );
        require(contractorDeadline > now, "Your deadline should be gt now");
        changeStateTo(States.PROPOSED, contractorDeadline, contractorReward, "");

        emit ProposalStateChangedToBy(States.PROPOSED, msg.sender);
    }

    function pushToPrepaidState() external {
        require(msg.sender == customer, "Invalid access");
        require(
            currentState == States.PROPOSED,
            "This action can be called only from PROPOSED state"
        );
        changeStateTo(States.PREPAID, 0, 0, "");

        emit ProposalStateChangedToBy(States.PREPAID, msg.sender);
    }

    function announceTaskCompleted(bytes calldata doneTaskHash) external {
        require(msg.sender == contractor, "Invalid access");
        require(
            currentState == States.PREPAID,
            "This action can be called only from PREPAID state"
        );
        require(
            _revertDeadline < now,
            "Wait until 24h period from the moment of payment get expired"
        );
        require(taskDeadline >= now, "The time for this action is over");
        require(doneTaskHash.length != 0, "Invalid form of IPFS hash");
        changeStateTo(States.COMPLETED, 0, 0, doneTaskHash);

        emit ProposalStateChangedToBy(States.COMPLETED, msg.sender);
    }

    //function startDispute() external;
    //function resolveDispute() external;

    function closeProposal() external onlyParties {
        require(
            currentState == States.INIT || currentState == States.PROPOSED ||
            currentState == States.PREPAID && (
                (_revertDeadline >= now && msg.sender == customer) || taskDeadline < now
            ) ||
            currentState == States.COMPLETED && now > _revertDeadline,
            "Proposal cancellation conditions are not met"
        );

        emit ProposalCloseWasCalledBy(msg.sender);
        changeStateTo(States.CLOSED, 0, 0, "");
    }

    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward,
        bytes memory doneTaskHash
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
        address _contractor,
        address token
    )
        external
    {
        require(msg.sender == factory, "Function can be called only by factory");
        internalSetup(_arbiter, _customer, arbiterReward, _taskIPFSHash, _contractor, token);

        emit ProposalWasSetUp(_customer);
    }

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        bytes memory _taskIPFSHash,
        address _contractor,
        address token
    )
        internal;
}


contract Proposal is ProposalSetupper {
    using SafeMath for uint256;

    constructor() public ProposalSetupper() {}

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        bytes memory _taskIPFSHash,
        address _contractor,
        address token
    )
        internal
    {
        require(arbiterReward > 0, "Arbiter award should be more than zero");

        arbiter = _arbiter;
        arbiterDaiReward = arbiterReward;
        customer = _customer;
        contractor = _contractor;

        daiToken = token;

        currentState = States.INIT;
        taskIPFSHash = _taskIPFSHash;
    }

    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward,
        bytes memory doneTaskHash
    )
        internal
    {
        if (nextState == States.CLOSED) {
            if (currentState == States.PREPAID) {
                uint256 transferingAmount = arbiterDaiReward.add(contractorDaiReward);
                require(
                    IERC20(daiToken).transfer(customer, transferingAmount),
                    "Token transfer in cancellation state failed"
                );
            }
            if (currentState == States.COMPLETED) {
                require(
                    IERC20(daiToken).transfer(contractor, contractorDaiReward) &&
                    IERC20(daiToken).transfer(customer, arbiterDaiReward),
                    "Token transfer in cancellation state failed"
                );
            }
            selfdestruct(msg.sender);
            // curState = close?
        }

        if (nextState == States.PROPOSED) {
            taskDeadline = newDeadline;
            contractorDaiReward = contractorReward;
            currentState = States.PROPOSED;
        }

        if (nextState == States.PREPAID) {
            uint256 transferingAmount = arbiterDaiReward.add(contractorDaiReward);
            require(
                IERC20(daiToken).transferFrom(msg.sender, address(this), transferingAmount),
                "Contractors and arbiters token reward lock on proposal contract failed"
            );

            _revertDeadline = now + 24 hours;
            currentState = States.PREPAID;
        }

        if (nextState == States.COMPLETED) {
            doneTaskIPFSHash = doneTaskHash;

            _revertDeadline = now + 24 hours;
            currentState = States.COMPLETED;
        }
    }
}