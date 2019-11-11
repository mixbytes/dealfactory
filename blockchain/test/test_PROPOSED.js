const fs = require('fs');

const truffleAssert = require('truffle-assertions');
const { time } = require('openzeppelin-test-helpers');
const ProposalFactory = artifacts.require("ProposalFactory");
const ProposalContract = artifacts.require("Proposal");
const DaiToken = artifacts.require("DaiToken");
const ProposalMock = artifacts.require("ProposalMock");


contract('Proposal test with cancellation on init', async accounts => {

    const STATES = {
        ZS: 0,
        INIT: 1,
        PROPOSED: 2,
        PREPAID: 3,
        COMPLETED: 4,
        DISPUTE: 5,
        RESOLVED: 6,
        CLOSED: 7
    }

    const FACTORY_OWNER = accounts[0];
    const CUSTOMER_1 = accounts[1];
    const CONTRACTOR_1 = accounts[2];
    const ARBITER = accounts[3];
    const CONTRACTOR_2 = accounts[4];

    let proposalFactory;
    let proposalMainBytecode = fs.readFileSync("test/proposal_main_bytecode", 'utf8').trim();
    let proposalInstance;
    let proposalInstanceAddress;
    let token;

    let expectThrow = async (promise) => {
        try {
          await promise;
        } catch (error) {
          const invalidOpcode = error.message.search('invalid opcode') >= 0;
          const outOfGas = error.message.search('out of gas') >= 0;
          const revert = error.message.search('revert') >= 0;
          assert(
            invalidOpcode || outOfGas || revert,
            "Expected throw, got '" + error + "' instead",
          );
          return;
        }
        assert.fail('Expected throw not received');
    };
    
    before('deploying factory', async() => {
        proposalFactory = await ProposalFactory.new(ARBITER, {from: FACTORY_OWNER});
        token = await DaiToken.new({from: FACTORY_OWNER});
        
    })

    it('check factory ownership', async() => {
        let factoryOwnerGotByCall = await proposalFactory.owner();
        assert.equal(factoryOwnerGotByCall, FACTORY_OWNER);
    });

    it('register proposal bytecode', async() => {
        await proposalFactory.registerProposalTemplate(proposalMainBytecode)
        let proposalCode = await proposalFactory.currentProposalBytecode.call();
        assert.equal(proposalMainBytecode, proposalCode)
    });

    it('should fail proposal creation', async() => {
        // wrong arbiter reward amount
        await expectThrow(
            proposalFactory.createConfiguredProposal(0, "0x123", CONTRACTOR_1, token.address, {from: CUSTOMER_1})
        );

        // empty IPFS task hash
        await expectThrow(
            proposalFactory.createConfiguredProposal(10, "0x", CONTRACTOR_1, token.address, {from: CUSTOMER_1})
        )
    });

    it('create proposal by CUSTOMER_1', async() => {
        let daiReward = 10;
        let IPFSMock = "0x66012a0a"

        let proposalCreationTx = await proposalFactory.createConfiguredProposal(daiReward,  IPFSMock, CONTRACTOR_1, token.address, {from: CUSTOMER_1});
        proposalInstanceAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            return res.proposalAddress == proposalInstanceAddress;
        });
    });

    it('should fail resetup', async() => {
        let daiReward = 10;
        let IPFSMock = "0x66012a0a";

        proposalInstance = await ProposalContract.at(proposalInstanceAddress);

        // only by factory
        await expectThrow(
            proposalInstance.setup(ARBITER, accounts[2], daiReward, IPFSMock, CONTRACTOR_1, token.address, {from: accounts[8]})
        )
    })

    it('stupid state check: proposal has INIT state', async() => {
        // check creation state
        let curState = await proposalInstance.currentState.call();
        assert.equal(curState, STATES.INIT);
    });

    it('should fail transitions to invalid states', async() => {
        /*
        Valid states to go to are PROPOSED or CLOSED. 
        */
        await expectThrow(
           proposalInstance.announceTaskCompleted("0x123", {from: CONTRACTOR_1})
        )

        await expectThrow(
           proposalInstance.pushToPrepaidState({from: CUSTOMER_1})
        )

        await expectThrow(
           proposalInstance.startDispute(100, {from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.resolveDispute(10, "0x123", {from: ARBITER})
        )
    })

    it('should fail on transition from INIT to PROPOSED', async() => {

        // wrong access
        await expectThrow(
            proposalInstance.responseToProposal(1000000000000000, 100, {from: CONTRACTOR_2})
        )

        // deadline conditional is not met
        await expectThrow(
            proposalInstance.responseToProposal(0, 100, {from: CONTRACTOR_1})
        )
    })

    it('transition from INIT to PROPOSED and state vars check', async() => {
        let blocknumber = await web3.eth.getBlockNumber();
        let block = await web3.eth.getBlock(blocknumber);
        let inputDeadline = block.timestamp + 100000;

        await proposalInstance.responseToProposal(inputDeadline, 100, {from: CONTRACTOR_1});

        // check state variables
        let proposedDeadline = await proposalInstance.taskDeadline.call();
        assert.equal(inputDeadline, proposedDeadline);

        let state = await proposalInstance.currentState.call();
        assert.equal(state, STATES.PROPOSED);
    });

    // some off-chain interactions happened - new price and deadline were stated

    it('another reward and deadline', async() => {
        let currentDeadline = await proposalInstance.taskDeadline.call();
        let currentReward = await proposalInstance.contractorDaiReward.call();

        let newDeadline = currentDeadline.toNumber() + 100;
        let newReward = currentReward.toNumber() - 50; // overflow currentReward.toNumber() - 500

        await proposalInstance.responseToProposal(newDeadline, newReward, {from: CONTRACTOR_1})
        
        let state = await proposalInstance.currentState.call();
        assert.equal(state, STATES.PROPOSED);
    })

    it('should fail transitions to invalid states from PROPOSED', async() => {
        /*
        The only valid states from PROPOSED are: PROPOSED, PREPAID, CLOSED.
        */

        // to get to init we should call setup
        await expectThrow(
            proposalInstance.setup(ARBITER, CUSTOMER_1, 50, "0x12", CONTRACTOR_1, token.address, {from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.announceTaskCompleted("0x1212", {from: CONTRACTOR_1})
        )

        await expectThrow(
            proposalInstance.startDispute(20, {from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.resolveDispute(50, "0xfff12fff", {from: ARBITER})
        )
    })

    it('transition from PROPOSED to CLOSE', async() => {
        await proposalInstance.closeProposal({from: CONTRACTOR_1});
    })
})