pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Proposal.sol";

/**
 * @title Proposal factory
 * @author SabaunT https://github.com/SabaunT
 * @notice This contract is used to produce (create) proposal contracts.
 * If proposal contract is changed, then a new bytecode (aka template) is registered.
 * Registered init bytecode is used as a creation bytecode.
 * @dev This is a dynamic factory. It means that you can change code of contracts, that will be
 * produced.
 *
 * There is also another approach to that. Registered creation bytecode does not
 * state constructor variables, so `setup` method of a `Proposal` contract is used instead to
 * emulate this behaviour. The cleaner way is to use in `createConfiguredProposal` function
 * `constructorArgs` param of type `bytes memory`, which will be concatenated to
 * `currentProposalBytecode`. In this case, we will be a 100% sure that it's impossible to
 * "resetup" proposal.
 *
 */
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

    /**
     * @notice This function deploys and configures newly created proposal
     * by calling `setup` method with provided args.
     * @dev Deploys with inline assembly.
     * @param arbiterReward amount of tokens payed for arbiter when he resolves dispute.
     * @param proposalTaskIPFSHash IPFS content reference to callers proposal task.
     * @param contractor task assignee.
     * @param tokenAddress token used for payments.
     */
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

    /**
     * @dev Deploys contract using parametr as a creation bytecode. Falls if creation failed.
     *
     * Creation logic requires using `create` inline assembly function.
     * Function `add` is used in `create` to get start position, from which creation
     * bytecode is started: first memory slot is length of `proposalBytecode` and 0x20 (32)
     * bytes after is a next slot, where starts creation bytecode.
     * `mload` in our case gets length of parametr. So a new contract is created with code stated
     * in memory in positions from [add(proposalBytecode,0x20)] to
     * [add(proposalBytecode,0x20) + mload(proposalBytecode)]
     *
     * @param proposalBytecode proposal creation bytecode.
     */
    function _deployProposal(bytes memory proposalBytecode)
        private
        returns (address)
    {
        uint256 contractCreationReturnValue;
        address _addr;
        assembly {
            _addr := create(0, add(proposalBytecode,0x20), mload(proposalBytecode))
            contractCreationReturnValue := gt(extcodesize(_addr), 0)
        }
        require(contractCreationReturnValue > 0, "Proposal deploy failed");

        return _addr;
    }
}