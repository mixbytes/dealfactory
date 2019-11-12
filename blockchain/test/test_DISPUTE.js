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
    let snapshotId;

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

    let takeSnapshot = () => {
        return new Promise((resolve, reject) => {
          web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_snapshot',
            id: new Date().getTime()
          }, (err, snapshotId) => {
            if (err) { return reject(err) }
            return resolve(snapshotId)
          })
        })
    };

    let revertToSnapShot = (id) => {
        return new Promise((resolve, reject) => {
          web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_revert',
            params: [id],
            id: new Date().getTime()
          }, (err, result) => {
            if (err) { return reject(err) }
            return resolve(result)
          })
        })
    };
    
    before('deploying factory', async() => {
        proposalFactory = await ProposalFactory.new(ARBITER, {from: FACTORY_OWNER});
        token = await DaiToken.new({from: FACTORY_OWNER});

        await token.transfer(CUSTOMER_1, 100000, {from: FACTORY_OWNER})  
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
        let newReward = currentReward.toNumber() - 500; // OVERFLOW!!

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

    it('should fail transition from PROPOSED to PREPAID', async() => {
        // invalid access
        await expectThrow(
            proposalInstance.pushToPrepaidState({from: CONTRACTOR_1})
        )

        // Approve for proposal contract
        await token.approve(proposalInstanceAddress, 100000, {from: CUSTOMER_1}) //100000 - balance of CUSTOMER_1

        await expectThrow(
            proposalInstance.pushToPrepaidState({from: CUSTOMER_1}) // due to overflow
        )
    })

    it('changing reward in PREPAID state', async() => {
        let currentDeadline = await proposalInstance.taskDeadline.call();
        let newReward = 50;

        await proposalInstance.responseToProposal(currentDeadline, newReward, {from: CONTRACTOR_1})
    })

    it('transition from PROPOSED to PREPAID', async() => {
        await proposalInstance.pushToPrepaidState({from: CUSTOMER_1})

        // check the state
        let arbiterReward = await proposalInstance.arbiterDaiReward.call();
        let contractorReward = await proposalInstance.contractorDaiReward.call();
        let proposalDaiBalance = await token.balanceOf(proposalInstanceAddress);
        assert.equal(proposalDaiBalance.toNumber(), arbiterReward.toNumber() + contractorReward.toNumber())

        let balanceOfCustomer = await token.balanceOf(CUSTOMER_1);
        assert.equal(100000 - proposalDaiBalance.toNumber(), balanceOfCustomer.toNumber())
    })

    it('should fail transitions from PREPAID to invalid states', async() => {
        await expectThrow(
            proposalInstance.responseToProposal(100000000000000, 10000000000, {from: CONTRACTOR_1})
        )
        await expectThrow(
            proposalInstance.pushToPrepaidState({from: CUSTOMER_1})
        )

        //revert deadline is gt now
        await expectThrow(
            proposalInstance.announceTaskCompleted("0x123", {from: CONTRACTOR_1})
        )

        await expectThrow(
            proposalInstance.startDispute(10, {from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.resolveDispute(10, "0x123", {from: ARBITER})
        )

        //invalid Access
        await expectThrow(
            proposalInstance.closeProposal({from: CONTRACTOR_1})
        )

        // revert time is over, but deadline is not
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25)); //!!!
        await time.increaseTo(end);

        await expectThrow(
            proposalInstance.closeProposal({from: CUSTOMER_1})
        )
    })

    it('should fail transition from PREPAID to COMPLETED', async() => {
        await revertToSnapShot(snapshotId);

        //revert deadline is gt now
        await expectThrow(
            proposalInstance.announceTaskCompleted("0x123", {from: CONTRACTOR_1})
        )

        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25)); //!!!
        await time.increaseTo(end);

        // invalid access
        await expectThrow(
            proposalInstance.announceTaskCompleted("0x123", {from: CONTRACTOR_2})
        )

        // invalid ipfs hash
        await expectThrow(
            proposalInstance.announceTaskCompleted("0x", {from: CONTRACTOR_1})
        )

        // just to step back in next tests
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        await time.advanceBlock();
        start = await time.latest();
        end = start.add(time.duration.years(3)); //!!!
        await time.increaseTo(end);
        
        // the time is over
        await expectThrow(
            proposalInstance.announceTaskCompleted("0x123", {from: CONTRACTOR_1})
        )
    })

    it('transition from PREPAID to COMPLETED', async() => {
        await revertToSnapShot(snapshotId);

        await proposalInstance.announceTaskCompleted("0x123", {from: CONTRACTOR_1})

        // just in case
        let curState = await proposalInstance.currentState.call();
        assert.equal(curState, STATES.COMPLETED)
    })

    it('should fail transitions to invalid states from COMPLETED', async() => {
        await expectThrow(
            proposalInstance.responseToProposal(100000000000000, 10000000000, {from: CONTRACTOR_1})
        )

        await expectThrow(
            proposalInstance.pushToPrepaidState({from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.resolveDispute(10, "0x123", {from: ARBITER})
        )

        await expectThrow(
            proposalInstance.closeProposal({from: CUSTOMER_1})
        )
    })

    it('should fail transition from COMPLETED to DISPUTE', async() => {
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        // invalid access
        await expectThrow(
            proposalInstance.startDispute(10, {from: CONTRACTOR_1})
        )
        
        // new reward to pay should be lt stated contractorDaiReward
        await expectThrow(
            proposalInstance.startDispute(100, {from: CUSTOMER_1})
        )

        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25)); //!!!
        await time.increaseTo(end);

        // revertDeadline < now, can be closed now
        await expectThrow(
            proposalInstance.startDispute(10, {from: CUSTOMER_1})
        )
    })

    it('transition from COMPLETED to DISPUTE', async() => {
        await revertToSnapShot(snapshotId);

        await proposalInstance.startDispute(10, {from: CUSTOMER_1})

        // just in case
        let curState = await proposalInstance.currentState.call();
        assert.equal(curState, STATES.DISPUTE)
    })

    it('should fail transition from DISPUTE to invalid states', async() => {

        // now is less then revertDeadline
        await expectThrow(
            proposalInstance.closeProposal({from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.responseToProposal(1000000000000, 100, {from: CONTRACTOR_1})
        )

        await expectThrow(
            proposalInstance.pushToPrepaidState({from: CUSTOMER_1})
        )

        await expectThrow(
            proposalInstance.announceTaskCompleted("0x12", {from: CONTRACTOR_1})
        )
    })

    /*
    // passed
    it('transition from DISPUTE to CLOSED', async() => {
        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25)); //!!!
        await time.increaseTo(end);

        let contractorReward = await proposalInstance.contractorDaiReward.call();

        await proposalInstance.closeProposal({from: CUSTOMER_1});
        let customerBalanceAfterClose = await token.balanceOf(CUSTOMER_1);
        let contracorBalanceAfterClose = await token.balanceOf(CONTRACTOR_1);
        let proposalBalance = await token.balanceOf(proposalInstanceAddress);
        
        assert.equal(contractorReward.toNumber(), contracorBalanceAfterClose.toNumber())
        assert.equal(customerBalanceAfterClose.toNumber(), 99950)
        assert.equal(proposalBalance.toNumber(), 0);
    })
    */
    
    it('should fail transition from DISPUTE to RESOLVED', async() => {
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        // invalid reward value
        await expectThrow(
            proposalInstance.resolveDispute(0, "0x123", {from: ARBITER})
        )
        await expectThrow(
            proposalInstance.resolveDispute(100, "0x123", {from: ARBITER})
        )

        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25)); //!!!
        await time.increaseTo(end);

        await expectThrow(
            proposalInstance.resolveDispute(20, "0x123", {from: ARBITER})
        )
    })

    it('transition from DISPUTE to RESOLVED', async() => {
        await revertToSnapShot(snapshotId);

        let arbiterReward = await proposalInstance.arbiterDaiReward.call();
        let contractorReward = await proposalInstance.contractorDaiReward.call();
        let customerBalanceBeforeResolve = 99940;

        //arbiter came withing 24 hours
        let arbitersDecision = 20;
        await proposalInstance.resolveDispute(arbitersDecision, "0x123", {from: ARBITER});

        let arbiterBalance = await token.balanceOf(ARBITER);
        let contractorBalance = await token.balanceOf(CONTRACTOR_1);
        let customerBalanceAfterResolved = await token.balanceOf(CUSTOMER_1);
        let change = contractorReward.toNumber() - arbitersDecision;

        assert.equal(arbiterReward.toNumber(), arbiterBalance.toNumber());
        assert.equal(arbitersDecision, contractorBalance.toNumber());
        assert.equal(customerBalanceBeforeResolve + change, customerBalanceAfterResolved.toNumber())

        let proposalBalance = await token.balanceOf(proposalInstanceAddress);
        assert.equal(proposalBalance.toNumber(), 0);
    })
})