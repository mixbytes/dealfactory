pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Proposal.sol";

contract ProposalFactory is Ownable {
    address public generalArbiter;
    bytes public currentProposalBytecode;

    event ProposalCreated(address customer, address proposalAddress);

    constructor(address arbiter) public {
        generalArbiter = arbiter;
    }

    function registerProposalTemplate(bytes calldata proposalBytecode) external onlyOwner {
        currentProposalBytecode = proposalBytecode;
    }

    function createConfiguredProposal(
        uint256 arbiterReward,
        bytes calldata proposalTaskIPFSHash,
        address contractor,
        address tokenAddress
    )
        external
    {
        address newlyDeployedProposalContract = _deployProposal(currentProposalBytecode);
        Proposal(newlyDeployedProposalContract).setup(
            generalArbiter,
            msg.sender,
            arbiterReward,
            proposalTaskIPFSHash,
            contractor,
            tokenAddress
        );
        emit ProposalCreated(msg.sender, newlyDeployedProposalContract);
    }

    function _deployProposal(bytes memory proposalBytecode)
        private
        returns (address)
    {
        uint256 contractCreationReturnValue;
        address _addr;
        assembly {
            _addr := create(0, add(proposalBytecode,0x20), mload(proposalBytecode)) // не забудь вернуться!
            contractCreationReturnValue := gt(extcodesize(_addr), 0)
        }
        require(contractCreationReturnValue > 0, "Proposal deploy failed");

        return _addr;
    }
}