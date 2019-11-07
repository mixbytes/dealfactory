const fs = require('fs');

const truffleAssert = require('truffle-assertions');
const { time } = require('openzeppelin-test-helpers');
const ProposalFactory = artifacts.require("ProposalFactory");
const ProposalContract = artifacts.require("Proposal");
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

    it('should throw - create proposal with wrong params', async() => {
        let blocknumber = await web3.eth.getBlockNumber();
        let block = await web3.eth.getBlock(blocknumber);
        let proposalDeadline = block.timestamp + 10000;

        let daiReward = 10;
        let IPFSMock = "0x66012a0a"

        // wrong deadline
        await expectThrow(
            proposalFactory.createConfiguredProposal(block.timestamp, daiReward, IPFSMock, CONTRACTOR_1, {from: CUSTOMER_1})
        );
        
        // wrong arbiter reward amount
        await expectThrow(
            proposalFactory.createConfiguredProposal(proposalDeadline, 0, IPFSMock, CONTRACTOR_1, {from: CUSTOMER_1})
        );
    });
    

    it('create proposal by CUSTOMER_1', async() => {
        let blocknumber = await web3.eth.getBlockNumber();
        let block = await web3.eth.getBlock(blocknumber);
        let proposalDeadline = block.timestamp + 10000;

        let daiReward = 10;
        let IPFSMock = "0x66012a0a"

        let proposalCreationTx = await proposalFactory.createConfiguredProposal(proposalDeadline, daiReward,  IPFSMock, CONTRACTOR_1, {from: CUSTOMER_1});
        newlyCreatedProposalAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            return res.proposalAddress == newlyCreatedProposalAddress;
        });
    });

    it('trying to call setup using wrong access', async() => {
        let blocknumber = await web3.eth.getBlockNumber();
        let block = await web3.eth.getBlock(blocknumber);
        let proposalDeadline = block.timestamp + 10000;

        let daiReward = 10;
        let IPFSMock = "0x66012a0a";

        newlyCreatedProposalContract = await ProposalContract.at(newlyCreatedProposalAddress);

        // only by factory
        await expectThrow(
            newlyCreatedProposalContract.setup(ARBITER, CUSTOMER_2, proposalDeadline, daiReward, IPFSMock, CONTRACTOR_1, {from: CUSTOMER_2})
        )
    })

    it('check proposal has INIT state', async() => {
        // check creation state
        let curState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(curState, STATES.INIT);
    });

    /*
    proposed и логика перехода состояний из него
    далее логика prepaid и перехода состояний из него.
    */

    it('throw on transition from INIT to PROPOSED state', async() => {
        // data needed to revert time back
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result'];

        // wrong access
        await expectThrow(
            newlyCreatedProposalContract.responseToProposal(1000000000000, 100, {from: CONTRACTOR_2})
        )

        // deadline conditional is met
        await time.advanceBlock();
        let start = await time.latest();
        let end = start.add(time.duration.years(2));
        await time.increaseTo(end);

        let reward = 100;
        let currentDeadline = await newlyCreatedProposalContract.taskDeadline.call();
        await expectThrow(
            newlyCreatedProposalContract.responseToProposal(currentDeadline - 100, reward, {from: CONTRACTOR_1})
        )
    })

    it('should go forward to proposed state', async() => {
        // reverting back time
        await revertToSnapShot(snapshotId);

        let reward = 100;
        let currentDeadline = await newlyCreatedProposalContract.taskDeadline.call();
        await newlyCreatedProposalContract.responseToProposal(currentDeadline - 100, reward, {from: CONTRACTOR_1})

        
        // check state invariants
        let newDeadline = await newlyCreatedProposalContract.taskDeadline.call();
        let contractorReward = await newlyCreatedProposalContract.contractorDaiReward.call();
        assert.equal(newDeadline.toNumber() + 100, currentDeadline.toNumber());
        assert.equal(contractorReward, reward);

        // check state
        let curState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(curState, STATES.PROPOSED);
    });

    // some off-chain actions happened, customer and contractor agreed on a new price
    // time? - он же будетм меньше или равен нового таймстэмпа
    // состояние, когда есть TTL, который постоянно меньше или равен заданному в фабрике.

    it('agree on a new price, state is PROPOSED', async() => {
        let currrentDeadline = await newlyCreatedProposalContract.taskDeadline.call()
        let newReward = 100;

        // ha-ha
        await expectThrow(
            newlyCreatedProposalContract.responseToProposal(currrentDeadline, 0, {from: CUSTOMER_1})
        )

        
        await newlyCreatedProposalContract.responseToProposal(currrentDeadline, newReward, {from: CONTRACTOR_1})
        
        // check state
        let curState = await newlyCreatedProposalContract.currentState.call();
        assert.equal(curState, STATES.PROPOSED);
        
        //check new reward
        let contractorReward = await newlyCreatedProposalContract.contractorDaiReward.call();
        assert.equal(contractorReward, newReward);
        
    })

});