pragma solidity 0.5.12;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Proposal is Ownable {

    address arbiter; // private?
    constructor(address proposal_owner, address _arbiter) public {
        arbiter = _arbiter;
        transferOwnership(proposal_owner);
    }
}