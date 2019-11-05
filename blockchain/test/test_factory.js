const fs = require('fs');

const truffleAssert = require('truffle-assertions');
const ProposalFactory = artifacts.require("ProposalFactory");
const ProposalContract = artifacts.require("Proposal");
const ProposalTest = artifacts.require("ProposalTested");



contract('ProposalFactory test', async accounts => {

    const FACTORY_OWNER = accounts[0];
    const CUSTOMER_1 = accounts[1];
    const CUSTOMER_2 = accounts[2];
    const CONTRACTOR_1 = accounts[3];
    const CONTRACTOR_2 = accounts[4];
    const ARBITER = accounts[5];

    let proposalFactory;
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
        let proposal_bytecode = fs.readFileSync("test/proposal_bytecode", 'utf8').trim()

        await proposalFactory.registerProposalTemplate(proposal_bytecode)
        let proposalCode = await proposalFactory.currentProposalBytecode.call();
        assert.equal(proposal_bytecode, proposalCode)
    });

    it('create proposal by CUSTOMER_1', async() => {
        let proposalCreationTx = await proposalFactory.createConfiguredProposal({from: CUSTOMER_1});
        newlyCreatedProposalAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            return res.proposalAddress == newlyCreatedProposalAddress;
        });
    });

    it('setup newly createdProposalContract', async() => {
        // setup and check
        newlyCreatedProposalContract = await ProposalContract.at(newlyCreatedProposalAddress);
        let factoryAddressInProposal = await newlyCreatedProposalContract.factory.call()
        let arbiterAddressInProposal = await newlyCreatedProposalContract.arbiter.call()
        assert.equal(factoryAddressInProposal, proposalFactory.address);
        assert.equal(arbiterAddressInProposal, ARBITER);
        let proposalOwner = await newlyCreatedProposalContract.owner();
        assert.equal(proposalOwner, CUSTOMER_1);
    });
})