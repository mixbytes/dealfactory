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

    IERC20 public proposalCurrencyToken;

    uint256 public taskDeadline;
    /**
     * @dev This state variable is used as an internal breaker/proceeder in different states.
     * For example:
     *   - PREPAID state uses this variable to establish 24h period during which proposal can be
     *     cancelled by calling `closeProposal`;
     *   - COMPLETED state uses this variable to state deadline after which anybody
     *     can `closeProposal` with token payout for contractor;
     *   - DISPUTE state uses it the same as PREPAID: begins 24h period within which customer can
     *     start dispute on reward for task completion. Proposal can be closed in this state
     *     after the period is expired.
     */
    uint256 _stateTransitionDeadline;

    uint256 public arbiterTokenReward;
    uint256 public contractorTokenReward;
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

    /**
     * @notice The function is called by {contractor} to push state forward to PROPOSED and define
     * proposal base configurations like: deadline, reward for work. PROPOSED requires setting
     * results of negotiations between {customer} and {contractor}.
     * @dev The function can be called from two STATES - `INIT` and `PROPOSED`.
     * @param contractorDeadline task deadline, after which reward payouts are unavailable
     * @param contractorReward reward amount which contractor gets if task was done within
     * deadline and without any disagreements from customer.
     */
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

    /**
     * @notice The function is called by {customer} to lock rewards for {arbiter} and {contractor}
     * on the proposal {proposalCurrencyToken} balance. As a result of the function call contract {currentState}
     * will be set to PREPAID. Setting proposal to PREPAID is a signal for {contractor} to start
     * performing task. To be more accurate, the function is increasing {_stateTransitionDeadline}
     * value to `now + 24 hours`. This deadline states interval within which {customer} can cancel
     * proposal {closeProposal} and receive back locked {proposalCurrencyToken} tokens.
     * When {_stateTransitionDeadline} expires, {contractor} can begin doing task
     * without any concerns.
     *
     * An important thing to mention:
     * {customer} should {approve} respected amount of tokens to be called from him.
     * @dev The function performs external call, after which {_stateTransitionDeadline} is set.
     * That is the first time {_stateTransitionDeadline} is modified. Called only from `PROPOSED`.
     */
    function pushToPrepaidState() external {
        require(msg.sender == customer, "Invalid access");
        require(
            currentState == States.PROPOSED,
            "This action can be called only from PROPOSED state"
        );
        changeStateTo(States.PREPAID, 0, 0, 0);

        emit ProposalWasPrepaid(contractorTokenReward, arbiterTokenReward);
    }

    /**
     * @notice The function is called by {contractor}. It signals that task was completed.
     * If {customer} does not react with {startDispute} within 24 hours from the timestamp
     * when the function was called, then proposal can be closed with reward payouts
     * for {contractor}.
     * In this case, {customer} receives back {arbiterTokenReward}.
     * @dev The function can't be called until {_stateTransitionDeadline} from {pushToPrepaidState}
     * call is expired. {_stateTransitionDeadline} is modified the second time when
     * the function is called. A new {_stateTransitionDeadline} defines deadline within which
     * {startDispute} can be called and after which {closeProposal} is available.
     * Called only from `PREPAID`.
     * @param doneTaskHash IPFS hash of the task result. This value is not stored in storage,
     * it is just emitted. So parse {ProposalTaskWasDone} events to use these values in your
     * app.
     */
    function announceTaskCompleted(bytes calldata doneTaskHash) external {
        require(msg.sender == contractor, "Invalid access");
        require(
            currentState == States.PREPAID,
            "This action can be called only from PREPAID state"
        );
        require(
            _stateTransitionDeadline < now,
            "Wait until 24h period from the moment of payment get expired"
        );
        require(taskDeadline >= now, "The time for this action is over");
        require(doneTaskHash.length != 0, "Invalid form of IPFS hash");
        changeStateTo(States.COMPLETED, 0, 0, 0);

        emit ProposalTaskWasDone(now, doneTaskHash);
    }

    /**
     * @notice The function is called by {customer} within secondly modified
     * {_stateTransitionDeadline} deadline to show {customer} disagreement on task results.
     * Accepts `newRewardToPay` argument that can be taken into account by {arbiter}
     * when he {resolveDispute}. If {arbiter} does not show up within 24 hours from the
     * function call, then {closeProposal} can be called.
     * @dev The function modifies thirdly {_stateTransitionDeadline} deadline. As was stated
     * previously, the {_stateTransitionDeadline} modification defines deadline for
     * {resolveDispute} call by {arbiter}.
     * Called only from `COMPLETED`.
     * @param newRewardToPay "disputed" reward that {customer} thinks to be fair as a payout for
     * done task. This value is just emitted, so an application should parse event logs to get it.
     */
    function startDispute(uint256 newRewardToPay) external {
        require(msg.sender == customer, "Invalid access");
        require(
            currentState == States.COMPLETED,
            "This action can be called only from COMPLETED state"
        );
        require(
            _stateTransitionDeadline >= now,
            "More than 24h past from contractors solution publication"
        );
        require(newRewardToPay < contractorTokenReward, "Irrational param value");
        changeStateTo(States.DISPUTE, 0, 0, 0);

        emit ProposalDisputeStarted(newRewardToPay);
    }

    /**
     * @notice The function is called by {arbiter} within thirdly modified
     * {_stateTransitionDeadline} deadline to resolve dispute and execute fair
     * (in accordance to arbiters opinion) payouts.
     * `disputedReward` can be lt `contractorTokenReward`, so differece between these amounts
     * will be send back to {customer}.
     * Also {arbiter} gets {arbiterTokenReward} for dispute resolve.
     * @dev From 2 to 3 external calls to {proposalCurrencyToken} can be executed. After token transfers
     * `selfdestruct` is executed.
     * Called only from `DISPUTE`.
     * @param disputedReward {arbiter} decision on {contractor} reward for the done task.
     * This amount of tokens will be send to {contractor}.
     * @param arbiterSolution IPFS hash reference to arbiters solition data.
     */
    function resolveDispute(uint256 disputedReward, bytes calldata arbiterSolution)
        external
    {
        require(msg.sender == arbiter, "Invalid access");
        require(
            currentState == States.DISPUTE,
            "This action can be called only from DISPUTE state"
        );
        require(
            _stateTransitionDeadline >= now,
            "More than 24h past from dispute announcement"
        );
        require(
            disputedReward > 0 && disputedReward <= contractorTokenReward,
            "Wrong value for reward"
        );

        emit ProposalWasResolved(arbiterSolution);
        changeStateTo(States.RESOLVED, 0, 0, disputedReward);
    }

    /**
     * @notice The function can be called from `INIT`, `PROPOSED`, `PREPAID`, `COMPLETED` and
     * `DISPUTE` states. `INIT` and `PROPOSED` states allow calling the function any time it is
     * necessary by parties. Call conditionals from other states are defined in respected
     * functions. Parties are stated in {onlyParties}.
     * @dev Calls from `PREPAID`, `COMPLETED`, `DISPUTE` states execute {proposalCurrencyToken} transfers.
     * `selfdestruct` is called after transfer executions.
     */
    function closeProposal() external onlyParties {
        require(
            currentState == States.INIT || currentState == States.PROPOSED ||
            currentState == States.PREPAID && (
                (_stateTransitionDeadline >= now && msg.sender == customer) || taskDeadline < now
            ) ||
            (currentState == States.COMPLETED || currentState == States.DISPUTE) &&
            now > _stateTransitionDeadline,
            "Proposal cancellation conditions are not met"
        );

        emit ProposalCloseWasCalledBy(msg.sender, currentState);
        changeStateTo(States.CLOSED, 0, 0, 0);
    }

    /// @notice abstract
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

    /**
     * @dev This method is called only once by proposal factory to define main state variables.
     * @param _arbiter chosend by proposal creator (aka customer) arbiter address.
     * @param _customer creator of the proposal. Set as `msg.sender` in proposal factory.
     * @param arbiterReward `_arbiter` reward for dispute resolve.
     * @param _taskIPFSHash `_customer` task IPFS hash, not saved in storage, only emitted.
     * @param _contractor chosen by `_customer` task performer
     * @param token token used as proposal currency.
     */
    function setup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        bytes calldata _taskIPFSHash,
        address _contractor,
        IERC20 token
    )
        external
    {
        require(msg.sender == factory, "Function can be called only by factory");
        require(arbiterReward > 0, "Arbiter award should be more than zero");
        require(_taskIPFSHash.length != 0, "Wrong task variable value");
        internalSetup(_arbiter, _customer, arbiterReward,  _contractor, token);

        emit ProposalWasSetUp(_customer, _contractor, _taskIPFSHash);
    }

    ///@notice abstract
    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        address _contractor,
        IERC20 token
    )
        internal;
}


/**
 * @title Main Proposal contract used by Pchela computing project users.
 * @author SabaunT (github)
 * @dev This contract incapsulates logic of state transitions. Such design was done
 * to ease featuring, debug, tests - all pros by differing contracts responsibilities.
 */
contract Proposal is ProposalSetupper {
    using SafeMath for uint256;

    constructor() public ProposalSetupper() {}

    /**
     * Performs logic of {setup} function.
     */
    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        address _contractor,
        IERC20 token
    )
        internal
    {
        arbiter = _arbiter;
        arbiterTokenReward = arbiterReward;
        customer = _customer;
        contractor = _contractor;

        proposalCurrencyToken = token;

        currentState = States.INIT;
    }

    /**
     * @dev Performs logic of all the state transitions.
     * @param nextState state to be appointed as {currentState}
     * @param newDeadline deadline stated by contractor in `PROPOSED`.
     * @param contractorReward reward for contractor defined in `PROPOSED`.
     * @param disputedRewardAmount {contractor} reward defined by {arbiter} in `DISPUTE` state.
     */
    function changeStateTo(
        States nextState,
        uint256 newDeadline,
        uint256 contractorReward,
        uint256 disputedRewardAmount
    )
        internal
    {
        if (nextState == States.PROPOSED) {
            taskDeadline = newDeadline;
            contractorTokenReward = contractorReward;
        }

        if (nextState == States.PREPAID ||
            nextState == States.COMPLETED ||
            nextState == States.DISPUTE)
        {
            if (nextState == States.PREPAID) {
                uint256 transferingAmount = arbiterTokenReward.add(contractorTokenReward);
                require(
                    proposalCurrencyToken.transferFrom(msg.sender, address(this), transferingAmount),
                    "Contractors and arbiters token reward lock on proposal contract failed"
                );
            }
            _stateTransitionDeadline = now.add(24 hours);
        }

        if (nextState == States.CLOSED || nextState == States.RESOLVED) {
            // можно сократить еще?
            if (currentState == States.PREPAID) {
                uint256 transferingAmount = arbiterTokenReward.add(contractorTokenReward);
                require(
                    proposalCurrencyToken.transfer(customer, transferingAmount),
                    "Token transfer in cancellation state failed"
                );
            }
            if (currentState == States.COMPLETED ||
                currentState == States.DISPUTE && disputedRewardAmount == 0)
            {
                require(
                    proposalCurrencyToken.transfer(contractor, contractorTokenReward) &&
                    proposalCurrencyToken.transfer(customer, arbiterTokenReward),
                    "Token transfer in cancellation state failed"
                );
            }

            if (currentState == States.DISPUTE && disputedRewardAmount != 0) {
                require(
                    proposalCurrencyToken.transfer(contractor, disputedRewardAmount) &&
                    proposalCurrencyToken.transfer(arbiter, arbiterTokenReward),
                    "Token transfer in cancellation state failed"
                );

                // третья вложенность?
                uint256 customerChange = contractorTokenReward.sub(disputedRewardAmount);
                if (customerChange != 0) {
                    require(
                        proposalCurrencyToken.transfer(customer, customerChange),
                        "Customer token change transfer failed"
                    );
                }

            }

            selfdestruct(msg.sender);
        }

        currentState = nextState;
    }
}