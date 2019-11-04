const truffleAsssert = require('truffle-assertions');
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

    it('basic test of factory deploy', async() => {
        // created factory
        let proposalFactory = await ProposalFactory.new(ARBITER, {from: FACTORY_OWNER});

        // checked factory ownership
        let factoryOwnerGotByCall = await proposalFactory.owner();
        assert.equal(factoryOwnerGotByCall, FACTORY_OWNER);

        // register proposal contract
        await proposalFactory.registerProposalTemplate()
        /*
        деплой переделываем под: деплоишь код с хардкодом в конструкторе
        используешь сэтап
        на это dev 295 закончен
        */

        // create proposal
        let proposalCreationTx = await proposalFactory.createProposal({from: CUSTOMER_1});
        let proposalContractAddress = proposalCreationTx.logs[proposalCreationTx.logs.length - 1].args.proposalAddress; // too explicit, especially index, use promise
        truffleAsssert.eventEmitted(proposalCreationTx, 'ProposalCreated', (res) => {
            console.log(res)
            return res.proposalAddress == proposalContractAddress;
        });
        
        // check proposal ownership
        let proposalContract = await ProposalContract.at(proposalContractAddress);
        let proposalOwner = await proposalContract.owner();
        assert.equal(proposalOwner, CUSTOMER_1);
    });
})