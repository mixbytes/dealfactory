const fs = require('fs');

const truffleAssert = require('truffle-assertions');
const { time } = require('openzeppelin-test-helpers');
const ProposalFactory = artifacts.require("ProposalFactory");
const ProposalContract = artifacts.require("Proposal");
const DaiToken = artifacts.require("DaiToken");
const ProposalMock = artifacts.require("ProposalMock");


contract('Proposal test base', async accounts => {

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
    const CUSTOMER_2 = accounts[2];
    const CONTRACTOR_1 = accounts[3];
    const CONTRACTOR_2 = accounts[4];
    const ARBITER = accounts[5];

    let proposalFactory;
    let token;
    let proposalMainBytecode = fs.readFileSync("test/proposal_main_bytecode", 'utf8').trim();
    let newlyCreatedProposalContract;
    let newlyCreatedProposalAddress;
    
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
    }

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
    }
    
    before('deploying factory', async() => {
        proposalFactory = await ProposalFactory.new(ARBITER, {from: FACTORY_OWNER});
        token = await DaiToken.new({from: FACTORY_OWNER});
        
        await token.transfer(CUSTOMER_1, 1000000, {from: FACTORY_OWNER});
    })

    it('register proposal bytecode', async() => {
        await proposalFactory.registerProposalTemplate(proposalMainBytecode)
        let proposalCode = await proposalFactory.currentProposalBytecode.call();
        assert.equal(proposalMainBytecode, proposalCode)
    });

    it('should throw - create proposal with wrong params', async() => {
        let IPFSMock = "0x66012a0a"
       
        // wrong arbiter reward amount
        await expectThrow(
            proposalFactory.createConfiguredProposal(0, IPFSMock, CONTRACTOR_1, token.address, {from: CUSTOMER_1})
        );
    });
    

    it('create proposal by CUSTOMER_1', async() => {
        let daiReward = 10;
        let IPFSMock = "0x66012a0a"

        let proposalCreationTx = await proposalFactory.createConfiguredProposal(daiReward,  IPFSMock, CONTRACTOR_1, token.address, {from: CUSTOMER_1});
        newlyCreatedProposalAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            return res.proposalAddress == newlyCreatedProposalAddress;
        });
    });

    it('trying to call setup using wrong access', async() => {

        let daiReward = 10;
        let IPFSMock = "0x66012a0a";

        newlyCreatedProposalContract = await ProposalContract.at(newlyCreatedProposalAddress);

        // only by factory
        await expectThrow(
            newlyCreatedProposalContract.setup(ARBITER, CUSTOMER_2, daiReward, IPFSMock, CONTRACTOR_1, token.address, {from: CUSTOMER_2})
        )
    })

    it('check proposal has INIT state', async() => {
        // check creation state
        let curState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(curState, STATES.INIT);
    });

    it('throw on transition from INIT to PROPOSED state', async() => {

        // wrong access
        await expectThrow(
            newlyCreatedProposalContract.responseToProposal(1000000000000000, 100, {from: CONTRACTOR_2})
        )

        // deadline conditional is met
        await expectThrow(
            newlyCreatedProposalContract.responseToProposal(0, 100, {from: CONTRACTOR_1})
        )
    })

    it('should go forward to proposed state', async() => {
        // reverting back time
        // await revertToSnapShot(snapshotId);

        let blocknumber = await web3.eth.getBlockNumber();
        let block = await web3.eth.getBlock(blocknumber);
        let proposalDeadline = block.timestamp + 100000;

        let reward = 100;

        await newlyCreatedProposalContract.responseToProposal(proposalDeadline, reward, {from: CONTRACTOR_1})

        // check state
        let curState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(curState, STATES.PROPOSED);
    });

    // some off-chain actions happened, customer and contractor agreed on a new price

    it('agree on a new price, state is PROPOSED', async() => {
        let prevDeadline = await newlyCreatedProposalContract.taskDeadline.call()
        let newReward = 100;

        // ha-ha
        await expectThrow(
            newlyCreatedProposalContract.responseToProposal(prevDeadline, 0, {from: CUSTOMER_1})
        )

        
        await newlyCreatedProposalContract.responseToProposal(prevDeadline.toNumber() + 1, newReward, {from: CONTRACTOR_1})
        
        // check state
        let curState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(curState, STATES.PROPOSED);
        
        //check new reward
        let contractorReward = await newlyCreatedProposalContract.contractorDaiReward.call();
        assert.equal(contractorReward, newReward);

        // check new deadline
        let newDeadline = await newlyCreatedProposalContract.taskDeadline.call();
        assert.equal(newDeadline.toNumber() - 1, prevDeadline.toNumber())
        
    })

    it('throw on transition from proposed to prepaid', async() => {
        // invalid access
        await expectThrow(
            newlyCreatedProposalContract.pushToPrepaidState({from: CONTRACTOR_1})
        )
    })

    it('should go forward to prepaid state', async() => {
        let arbiterReward = await newlyCreatedProposalContract.arbiterDaiReward.call();
        let contractorReward = await newlyCreatedProposalContract.contractorDaiReward.call();
        let approveAmount = arbiterReward.toNumber() + contractorReward.toNumber();
        await token.approve(newlyCreatedProposalAddress, approveAmount, {from: CUSTOMER_1});

        await newlyCreatedProposalContract.pushToPrepaidState({from: CUSTOMER_1});

        let proposalBalance = await token.balanceOf(newlyCreatedProposalAddress);
        assert.equal(approveAmount, proposalBalance);
    });

    /*
    it('cancel from prepaid state - within 24h', async() => {
        await newlyCreatedProposalContract.closeProposal({from: CUSTOMER_1})

        let customerCurBalance = await token.balanceOf(CUSTOMER_1);
        assert.equal(customerCurBalance.toNumber(), 1000000);
    })
    
    
    it('cancel from prepaid state - deadline', async() => {
        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.years(2));
        await time.increaseTo(end);
        await newlyCreatedProposalContract.closeProposal({from: CUSTOMER_1})

        let customerCurBalance = await token.balanceOf(CUSTOMER_1)
        assert.equal(customerCurBalance.toNumber(), 1000000);
    })
  */
    it('should fail cancellation from PREPAID', async() => {
        // data needed to revert time back
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        // deadline conditional is met
        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25));
        await time.increaseTo(end);

        await expectThrow(
            newlyCreatedProposalContract.closeProposal({from: CUSTOMER_1})
        )
    })

    // todo - test completed state with _revertDeadline
    it('should fail transition to completed', async() => {
        // reverting back time
        await revertToSnapShot(snapshotId);

        let mockHash = "0x634ab";

        // cancellation period for customer hasn't expired
        await expectThrow(
            newlyCreatedProposalContract.announceTaskCompleted(mockHash, {from: CONTRACTOR_1})
        )

        // increasing time
        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25));
        await time.increaseTo(end);

        // wrong acccess
        await expectThrow(
            newlyCreatedProposalContract.announceTaskCompleted(mockHash, {from: CONTRACTOR_2})
        )

        // Task Deadline revert test - data needed to revert time back
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        await time.advanceBlock();
        start = await time.latest();
        end = start.add(time.duration.years(2));
        await time.increaseTo(end);

        // out of deadline
        await expectThrow(
            newlyCreatedProposalContract.announceTaskCompleted(mockHash, {from: CONTRACTOR_1})
        )
    })

    it('transition from prepaid to completed', async() => {
        // reverting back time
        await revertToSnapShot(snapshotId);

        let mockHash = "0x634ab";
        await newlyCreatedProposalContract.announceTaskCompleted(mockHash, {from: CONTRACTOR_1});
    })

    it('should fail from completed to closed', async() => {
        // only after 24 hours
        let currState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(currState, STATES.COMPLETED);

        await expectThrow(
            newlyCreatedProposalContract.closeProposal({from: CONTRACTOR_1})
        )

        // increasing time
        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.hours(25));
        await time.increaseTo(end);

        // invalid access
        await expectThrow(
            newlyCreatedProposalContract.closeProposal({from: CONTRACTOR_2})
        )
    })
/*
    it('transition from completed to close', async() => {
        let customerBalanceBeforeClose = await token.balanceOf(CUSTOMER_1);
        let arbiterDaiReward = await newlyCreatedProposalContract.arbiterDaiReward.call();
        let contractorReward = await newlyCreatedProposalContract.contractorDaiReward.call();
        await newlyCreatedProposalContract.closeProposal({from: CONTRACTOR_1});

        // check invariants
        let balanceOfContractor = await token.balanceOf(CONTRACTOR_1);
        assert.equal(contractorReward.toNumber(), balanceOfContractor.toNumber());

        let customerBalanceAfterClose = await token.balanceOf(CUSTOMER_1);
        assert.equal(customerBalanceAfterClose.toNumber(), customerBalanceBeforeClose.toNumber() + arbiterDaiReward.toNumber())
    })
*/

});