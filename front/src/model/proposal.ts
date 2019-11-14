import Web3 from "web3";
import abi from "../assets/abi/proposal.json";

export enum State {
    ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED
}

export default class Proposal {

    private state: State;

    constructor(state: State) {
        this.state = state;
    }

    static async all(web3: Web3, factoryAddress: string) {

        let logs = await web3.eth.getPastLogs({
            fromBlock: 0,
            address: factoryAddress,
        });

        let dataChunks = logs
            .map(log => {
                // remove the beginning 0x
                let data = log.data.substr(2);

                // try to split data into chunks of 64 symbols
                try {
                    return data.match(/.{1,64}/g)!!;
                } catch (e) {
                    return null;
                }
            })
            // remove null items
            .filter((d): d is string[] => d !== null);

        // get the 2-nd element of array (address of proposal) and make it look like 0x...
        let proposalAddresses = dataChunks
            .map(chunk => chunk[1])
            .map(chunk => "0x" + chunk.substr(24));

        console.log(proposalAddresses);

        return await Promise.all(proposalAddresses.map(async proposalAddress => {
            let contract = new web3.eth.Contract(abi, proposalAddress);
            let m = contract.methods;

            return new Proposal(
                await m.currentState().call() as State
            );
        }));
    }
};
