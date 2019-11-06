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

    it('create proposal - test of failings', async() => {
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

    it('check setup params of newly created proposal contract', async() => {
        
        let factoryAddressInProposal = await newlyCreatedProposalContract.factory.call()
        let arbiterAddressInProposal = await newlyCreatedProposalContract.arbiter.call()
        assert.equal(factoryAddressInProposal, proposalFactory.address);
        assert.equal(arbiterAddressInProposal, ARBITER);
        let proposalCustomer = await newlyCreatedProposalContract.customer.call();
        assert.equal(proposalCustomer, CUSTOMER_1);
    });

    /*
    контракт находится в состоянии INIT. Тестируй переход в Cancel и далее, в состояние PROPOSED
    далее логика proposed и логика перехода состояний из него
    далее логика prepaid и перехода состояний из него.
    */

    it('going to proposed state', async() => {

    })
});