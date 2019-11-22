import Web3 from "web3";
import abi from "../assets/abi/proposal.json";
import {Contract} from 'web3-eth-contract';

// Please run "npm run typechain" to generate the required code before building
// import {proposalView} from "../types/proposalView";

// typechain seems not working now. You can uncomment when the typechain-target-web3-v2 get released

export enum State {
    ZS, INIT, PROPOSED, PREPAID, COMPLETED, DISPUTE, RESOLVED, CLOSED
}

export enum Role {
    Customer = "Customer",
    Arbiter = "Arbiter",
    Contractor = "Contractor",
    None = "None",
}

export const avaliableFields = [
    "arbiter",
    "currentState",
    "arbiterTokenReward",
    "contractor",
    "contractorTokenReward",
    "customer",
    "factory",
    "proposalCurrencyToken",
    "taskDeadline"
];

export default class Proposal {

    public address: string;
    public currentState!: State;
    public arbiter!: string;
    public contractor!: string;
    public arbiterTokenReward!: number;
    public contractorTokenReward!: number;
    public customer!: string;
    public factory!: string;
    public proposalCurrencyToken!: string;
    public taskDeadline!: number;

    private contract!: Contract;

    private constructor(address: string) {
        this.address = address;
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

        // get the 2-nd element of array (address of proposalView) and make it look like 0x...
        let proposalAddresses = dataChunks
            .map(chunk => chunk[1])
            .map(chunk => "0x" + chunk.substr(24));

        console.log(proposalAddresses);

        return await Promise.all(proposalAddresses.map(async proposalAddress => {

            let contract = new web3.eth.Contract(abi, proposalAddress);

            return await Proposal.fromContract(contract, proposalAddress);
        }));
    }

    private static async fromContract(contract: Contract, address: string) {
        let proposal = new Proposal(address);
        proposal.contract = contract;
        await proposal.update();
        return proposal;
    }

    public role(myAddress: string): Role {
        if (this.customer === myAddress)
            return Role.Customer;
        if (this.contractor === myAddress)
            return Role.Contractor;
        if (this.arbiter === myAddress)
            return Role.Arbiter;
        return Role.None;
    }

    public async update() {
        let m = this.contract.methods;

        await Promise.all(avaliableFields.map(async (methodName) => {
            if (methodName === "currentState") {
                this.currentState = Number(await m[methodName]().call());
            }
            this[methodName] = await m[methodName]().call();
        }));
    }
};
