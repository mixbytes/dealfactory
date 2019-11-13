pragma solidity 0.5.12;

import "../Proposal.sol";

contract ProposalMock is ProposalSetupper {

    constructor() public ProposalSetupper() {}

    function internalSetup(
        address _arbiter,
        address _customer,
        uint256 arbiterReward,
        address _contractor,
        IERC20 token
    )
        internal
    {
        require(arbiterReward > 0, "Arbiter award should be more than zero");

        arbiter = _arbiter;
        arbiterTokenReward = arbiterReward + 100;
        customer = _customer;
        contractor = _contractor;

        proposalCurrencyToken = token;

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
        currentState = nextState;
    }
}