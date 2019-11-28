import Web3 from "web3";
import abi from "../assets/abi/proposal.json";
import factoryAbi from "../assets/abi/factory.json";
import erc20 from "../assets/abi/erc20.json";
import {Log} from 'web3-core'
import config from "../config/config";
import {AbiItem} from 'web3-utils';
import {fromWei, myAddress, notEmpty, toWei} from "../tools/tools";

// Please run "npm run typechain" to generate the required code before building
// import {proposalView} from "../types/proposalView";

// typechain seems not working now. You can uncomment when the typechain-target-web3-v2 get released

export enum State {
    ZS = "0",
    INIT = "1", PROPOSED = "2", PREPAID = "3", COMPLETED = "4", DISPUTE = "5", RESOLVED = "6", CLOSED = "7"
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
    public ipfsHash!: string;
    public arbiterTokenReward!: string;
    public contractorTokenReward!: string;
    public customer!: string;
    public factory!: string;
    public proposalCurrencyToken!: string;
    public taskDeadline!: number;

    public role: Role;
    public decimals: number;

    private constructor(address: string) {
        this.address = address;
        this.decimals = 0;
        this.role = Role.None;
    }

    static async all(web3: Web3): Promise<Proposal[]> {

        let logs = await web3.eth.getPastLogs({
            fromBlock: 0,
            address: config.proposalFactoryAddress,
        });

        let dataChunks = this.splitLogData(logs);

        // get the 2-nd element of array (address of proposalView) and make it look like 0x...
        let proposalAddresses = dataChunks
            .map(chunk => chunk[1])
            .map(chunk => "0x" + chunk.substr(24));

        // console.log(proposalAddresses);

        return (await Promise
            .all(proposalAddresses
                .map(async proposalAddress => {
                    try {
                        return await Proposal.fromAddress(web3, proposalAddress)
                    } catch (e) {
                        return null
                    }
                })))
            .filter(notEmpty);
    }

    public static async deploy(web3: Web3,
                               arbiterReward: string,
                               proposalTaskIPFSHash: string,
                               contractor: string,
                               token: string) {

        const from = await myAddress(web3);
        let contract = this.factoryContract(web3);

        let decimals = await this.tokenContract(web3, token).methods.decimals().call();

        let method = contract.methods.createConfiguredProposal(
            toWei(arbiterReward, decimals),
            web3.utils.asciiToHex(proposalTaskIPFSHash),
            contractor,
            token
        );

        return await method.send({from});
    }

    private static factoryContract(web3: Web3) {
        return new web3.eth.Contract(factoryAbi, config.proposalFactoryAddress);
    }

    private static tokenContract(web3: Web3, address: string) {
        // @ts-ignore
        const tokenAbi: AbiItem[] = erc20;
        return new web3.eth.Contract(tokenAbi, address);
    }

    private static async fromAddress(web3: Web3, address: string) {
        let proposal = new Proposal(address);
        await proposal.update(web3);
        return proposal;
    }

    private static splitLogData(logs: Log[]) {
        return logs
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
    }

    public async close(web3: Web3) {
        const from = await myAddress(web3);
        return await this.contract(web3).methods.closeProposal().send({from});
    }

    public async announceComplete(web3: Web3, doneTaskIPFSHash: string) {
        const from = await myAddress(web3);
        return await this.contract(web3).methods
            .announceTaskCompleted(web3.utils.asciiToHex(doneTaskIPFSHash)).send({from});
    }

    public async respond(web3: Web3, deadline: number, reward: string) {
        const from = await myAddress(web3);

        const weiReward = toWei(reward, this.decimals);

        return await this.contract(web3).methods.responseToProposal(deadline, weiReward).send({from});
    }

    public async prepay(web3: Web3) {
        const from = await myAddress(web3);

        // let reward = this.contractorTokenReward * Math.pow(10, this.decimals);
        let numReward = Number(this.contractorTokenReward) + Number(this.arbiterTokenReward);
        let reward = toWei(numReward.toString(), this.decimals);

        await this.tokenContract(web3).methods.approve(this.address, reward).send({from});
        return await this.contract(web3).methods.pushToPrepaidState().send({from});
    }

    private contract(web3: Web3) {
        return new web3.eth.Contract(abi, this.address);
    }

    private tokenContract(web3: Web3) {
        // @ts-ignore
        const tokenAbi: AbiItem[] = erc20;
        return new web3.eth.Contract(tokenAbi, this.proposalCurrencyToken);
    }

    private async updateRole(web3: Web3) {
        let from = await myAddress(web3);

        const choose = () => {
            switch (from) {
                case this.customer:
                    return Role.Customer;
                case this.contractor:
                    return Role.Contractor;
                case this.arbiter:
                    return Role.Arbiter;
                default:
                    return Role.None;
            }
        };

        this.role = choose();
    }

    private async updateIpfsHash(web3: Web3) {
        let logs = await web3.eth.getPastLogs({
            fromBlock: 0,
            address: this.address,
        });
        let log = Proposal.splitLogData(logs)[0];
        this.ipfsHash = web3.utils.hexToAscii("0x" + (log[4] + log[5]).substr(0, 92));
    }

    private async update(web3: Web3) {
        let m = this.contract(web3).methods;

        await Promise.all(avaliableFields.map(async (methodName) => {
            this[methodName] = await m[methodName]().call();
        }));

        this.decimals = await this.tokenContract(web3).methods.decimals().call();


        this.contractorTokenReward = fromWei(this.contractorTokenReward, this.decimals);
        this.arbiterTokenReward = fromWei(this.arbiterTokenReward, this.decimals);


        await this.updateIpfsHash(web3);
        await this.updateRole(web3);
    }
};
