const ProposalFactory = artifacts.require("ProposalFactory");
const ProposalContract = artifacts.require("Proposal");


contract('ProposalFactory test', async accounts => {

    const FACTORY_OWNER = accounts[0];
    const CUSTOMER_1 = accounts[1];
    const CUSTOMER_2 = accounts[2];
    const CONTRACTOR_1 = accounts[3];
    const CONTRACTOR_2 = accounts[4];
    const ARBITER = accounts[5];

    it('basic test of factory deploy', async() => {
        let proposal_factory = await ProposalFactory.new(ARBITER, {from: FACTORY_OWNER});
        console.debug('Factory address: ', proposal_factory.address)

        let factory_owner = await proposal_factory.owner();
        assert.equal(factory_owner, FACTORY_OWNER);

        // use web3 to get logs
        let proposal_creation_tx = await proposal_factory.createProposal({from: CUSTOMER_1});
        let proposal_contract_address = proposal_creation_tx.logs[1].address; 
        let proposal_contract = await ProposalContract.at(proposal_contract_address);
        let proposal_owner = await proposal_contract.owner();
        assert.equal(proposal_owner, CUSTOMER_1);
    });
})