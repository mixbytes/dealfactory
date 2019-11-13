pragma solidity 0.5.12;

import '../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';

/**
 * This is a test ERC20, used only for testing.
 */
contract DaiToken is ERC20Mintable {

    string public constant name = "DAI";

    uint8 public constant decimals = 18;

    string public constant symbol = "DAI";

    constructor() public {
        mint(msg.sender, 1000000000000000000000);
    }

}