pragma solidity 0.5.12;


import 'openzeppelin-solidity/contracts/token/ERC20/IERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';


/**
 * @dev Transfers main/base options of proposal.
 */
contract ProposalStateDataTransferer {
    // states main state variables used in setup and other functions
    // these state variables are used in state transitions
    address public arbiter;
    address public contractor;
    address public customer;

    address public daiToken;

    uint256 public taskDeadline;

    uint256 public arbiterDaiReward;
    uint256 public contractorDaiReward;

    /**
     * @dev This state variable is used as an internal breaker/proceeder in different states.
     * For example:
     *   - PREPAID state uses this variable to establish 24h period during which proposal can be
     *     cancelled by calling `closeProposal`;
     *   - COMPLETED state uses this variable to state deadline after which anybody
     *     can `closeProposal` with token payout for contractor;
     *   - DISPUTE state uses it the same as PREPAID: 24h period within which customer can
     *     start dispute on reward for task completion. Proposal can be closed in this state
     *     after the period is expired.
     */
    uint256 _revertDeadline;
}

/**
 * @dev Abstract contract that incapsulates states, state transitions and
 * requirements of these transitions. Uses state variables from {ProposalStateDataTransferer}
 */
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

    event ResponseToProposalWasReceived(uint256 deadline, uint256 reward);
    event ProposalWasPrepaid(uint256 contractorReward, uint256 arbiterReward);
    event ProposalTaskWasDone(uint256 when, bytes solution);
    event ProposalDisputeStarted(uint256 newAmount);
    event ProposalWasResolved(bytes solutionHash);
    event ProposalCloseWasCalledBy(address who, States currentState);

    function responseToProposal(uint256 contractorDeadline, uint256 contractorReward)
        external
    {
        require(msg.sender == contractor, "Invalid access");
        require(
            currentState == States.INIT || currentState == States.PROPOSED,
            "This action can be called only from INIT or PROPOSED state"
        );
        require(contractorDeadline > now, "Your deadline should be gt now");
        changeStateTo(States.PROPOSED, contractorDeadline, contractorReward, 0);

        emit ResponseToProposalWasReceived(contractorDeadline,contractorReward);
    }

    function pushToPrepaidState() external {
        require(msg.sender == customer, "Invalid access");
        require(
            currentState == States.PROPOSED,
            "This action can be called only from PROPOSED state"
        );
        changeStateTo(States.PREPAID, 0, 0, 0);

        emit ProposalWasPrepaid(contractorDaiReward, arbiterDaiReward);
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
        changeStateTo(States.COMPLETED, 0, 0, 0);

        emit ProposalTaskWasDone(now, doneTaskHash);
    }

    function startDispute(uint256 newRewardToPay) external {
        require(msg.sender == customer, "Invalid access");
        require(
            currentState == States.COMPLETED,
            "This action can be called only from COMPLETED state"
        );
        require(
            _revertDeadline >= now,
            "More than 24h past from contractors solution publication"
        );
        require(newRewardToPay < contractorDaiReward, "Irrational param value");
        changeStateTo(States.DISPUTE, 0, 0, 0);

        emit ProposalDisputeStarted(newRewardToPay);
    }

    function resolveDispute(uint256 disputedReward, bytes calldata arbiterSolution)
        external
    {
        require(msg.sender == arbiter, "Invalid access");
        require(
            currentState == States.DISPUTE,
            "This action can be called only from DISPUTE state"
        );
        require(
            _revertDeadline >= now,
            "More than 24h past from dispute announcement"
        );
        require(
            disputedReward > 0 && disputedReward <= contractorDaiReward,
            "Wrong value for reward"
        );

        emit ProposalWasResolved(arbiterSolution);
        changeStateTo(States.RESOLVED, 0, 0, disputedReward);
    }

    function closeProposal() external onlyParties {
        require(
            currentState == States.INIT || currentState == States.PROPOSED ||
            currentState == States.PREPAID && (
                (_revertDeadline >= now && msg.sender == customer) || taskDeadline < now
            ) ||
            (currentState == States.COMPLETED || currentState == States.DISPUTE) &&
            now > _revertDeadline,
            "Proposal cancellation conditions are not met"
        );

        emit ProposalCloseWasCalledBy(msg.sender, currentState);
        changeStateTo(States.CLOSED, 0, 0, 0);
    }

    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward,
        uint256 disputedRewardAmount
    )
        internal;
}

/**
 * @dev Abstract contract used to setup {Proposal}. Think of `setup` as of `constructor`.
 */
contract ProposalSetupper is ProposalStateTransitioner{

    address public factory;

    event ProposalWasSetUp(address customer, address contractor, bytes task);

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
        require(_taskIPFSHash.length != 0, "Wrong task variable value");
        internalSetup(_arbiter, _customer, arbiterReward,  _contractor, token);

        emit ProposalWasSetUp(_customer, _contractor, _taskIPFSHash);
    }

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        address _contractor,
        address token
    )
        internal;
}


/**
 * @title Main Proposal contract used by Pchela computing project users.
 * @author SabaunT (github)
 * @dev This contract incapsulates logic of state transitions. Such design was done
 * to ease featuring, debug, tests. All pros by differing contracts responsibilities.
 */
contract Proposal is ProposalSetupper {
    using SafeMath for uint256;

    constructor() public ProposalSetupper() {}

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
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
    }

    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward,
        uint256 disputedRewardAmount
    )
        internal
    {
        if (nextState == States.CLOSED || nextState == States.RESOLVED) {
            // можно сократить еще?
            if (currentState == States.PREPAID) {
                uint256 transferingAmount = arbiterDaiReward.add(contractorDaiReward);
                require(
                    IERC20(daiToken).transfer(customer, transferingAmount),
                    "Token transfer in cancellation state failed"
                );
            }
            if (currentState == States.COMPLETED ||
                currentState == States.DISPUTE && disputedRewardAmount == 0)
            {
                require(
                    IERC20(daiToken).transfer(contractor, contractorDaiReward) &&
                    IERC20(daiToken).transfer(customer, arbiterDaiReward),
                    "Token transfer in cancellation state failed"
                );
            }

            if (currentState == States.DISPUTE && disputedRewardAmount != 0) {
                require(
                    IERC20(daiToken).transfer(contractor, disputedRewardAmount) &&
                    IERC20(daiToken).transfer(arbiter, arbiterDaiReward),
                    "Token transfer in cancellation state failed"
                );

                // третья вложенность?
                uint256 customerChange = contractorDaiReward.sub(disputedRewardAmount);
                if (customerChange != 0) {
                    require(
                        IERC20(daiToken).transfer(customer, customerChange),
                        "Customer token change transfer failed"
                    );
                }

            }

            selfdestruct(msg.sender);
        }

        if (nextState == States.PROPOSED) {
            taskDeadline = newDeadline;
            contractorDaiReward = contractorReward;
        }

        if (nextState == States.PREPAID ||
            nextState == States.COMPLETED ||
            nextState == States.DISPUTE)
        {
            if (nextState == States.PREPAID) {
                uint256 transferingAmount = arbiterDaiReward.add(contractorDaiReward);
                require(
                    IERC20(daiToken).transferFrom(msg.sender, address(this), transferingAmount),
                    "Contractors and arbiters token reward lock on proposal contract failed"
                );
            }
            _revertDeadline = now.add(24 hours);
        }

        currentState = nextState;
    }
}