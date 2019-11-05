const fs = require('fs');

const truffleAssert = require('truffle-assertions');
const ProposalFactory = artifacts.require("ProposalFactory");
const ProposalContract = artifacts.require("Proposal");
const ProposalMock = artifacts.require("ProposalMock");


contract('ProposalFactory test', async accounts => {

    const FACTORY_OWNER = accounts[0];
    const CUSTOMER_1 = accounts[1];
    const CUSTOMER_2 = accounts[2];
    const CONTRACTOR_1 = accounts[3];
    const CONTRACTOR_2 = accounts[4];
    const ARBITER = accounts[5];

    let proposalFactory;
    let proposalMainBytecode = fs.readFileSync("test/proposal_main_bytecode", 'utf8').trim();
    let mockProposalBytecode = fs.readFileSync("test/proposal_test_bytecode", 'utf8').trim();
    let newlyCreatedProposalContract;
    let newlyCreatedProposalAddress;

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

    it('create proposal by CUSTOMER_1', async() => {
        let proposalCreationTx = await proposalFactory.createConfiguredProposal({from: CUSTOMER_1});
        newlyCreatedProposalAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            return res.proposalAddress == newlyCreatedProposalAddress;
        });
    });

    it('check setup of newly created proposal contract', async() => {
        newlyCreatedProposalContract = await ProposalContract.at(newlyCreatedProposalAddress);
        let factoryAddressInProposal = await newlyCreatedProposalContract.factory.call()
        let arbiterAddressInProposal = await newlyCreatedProposalContract.arbiter.call()
        assert.equal(factoryAddressInProposal, proposalFactory.address);
        assert.equal(arbiterAddressInProposal, ARBITER);
        let proposalOwner = await newlyCreatedProposalContract.owner();
        assert.equal(proposalOwner, CUSTOMER_1);
    });

    it('changing bytecode to tested_bytecode', async() => {
        await proposalFactory.registerProposalTemplate(mockProposalBytecode)
        let proposalCode = await proposalFactory.currentProposalBytecode.call();
        assert.equal(mockProposalBytecode, proposalCode)
    });

    it('create proposal by CUSTOMER_2', async() => {
        let proposalCreationTx = await proposalFactory.createConfiguredProposal({from: CUSTOMER_2});
        newlyCreatedProposalAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            return res.proposalAddress == newlyCreatedProposalAddress;
        });
    });

    it('check setup of newly created proposal contract', async() => {
        // setup and check
        newlyCreatedProposalContract = await ProposalContract.at(newlyCreatedProposalAddress);
        let factoryAddressInProposal = await newlyCreatedProposalContract.factory.call()
        let arbiterAddressInProposal = await newlyCreatedProposalContract.arbiter.call()
        assert.equal(factoryAddressInProposal, proposalFactory.address);
        assert.equal(arbiterAddressInProposal, ARBITER);
        let proposalOwner = await newlyCreatedProposalContract.owner();
        assert.equal(proposalOwner, ARBITER); // hehe tricky
    });
})


//code version : https://github.com/mixbytes/renderhash/tree/0e86749c671dd0ac248c22395ed007fcc98d4bd5
