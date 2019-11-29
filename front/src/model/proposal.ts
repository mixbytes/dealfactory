import Web3 from "web3";
import abi from "../assets/abi/proposal.json";
import factoryAbi from "../assets/abi/factory.json";
import erc20 from "../assets/abi/erc20.json";
import config from "../config/config";
import {AbiItem} from 'web3-utils';
import {fromWei, myAddress, notEmpty, subscribeToEvent, toWei} from "../tools/tools";

// Please run "npm run typechain" to generate the required code before building
// import {proposalView} from "../types/proposalView";

// typechain seems not working now. You can uncomment when the typechain-target-web3-v2 get released

// const DEADLINE = 24 * 60 * 60;
// const DEADLINE = 30;

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

const factoryContract = (web3: Web3) => {
    return new web3.eth.Contract(factoryAbi, config.proposalFactoryAddress);
};

const tokenContract = (web3: Web3, address: string) => {
    // @ts-ignore
    const tokenAbi: AbiItem[] = erc20;
    return new web3.eth.Contract(tokenAbi, address);
};


export default class Proposal {

    public address: string;
    public currentState!: State;
    public arbiter!: string;
    public contractor!: string;
    public ipfsHash!: string;
    public doneIpfsHash!: string;
    public arbiterTokenReward!: string;
    public contractorTokenReward!: string;
    public customer!: string;
    public factory!: string;
    public proposalCurrencyToken!: string;
    public taskDeadline!: number;

    public role: Role;
    public decimals: number;

    private onUpdate?: (proposal: Proposal) => any;

    private constructor(address: string, onUpdate?: (proposal: Proposal) => any) {
        this.onUpdate = onUpdate;
        this.address = address;
        this.decimals = 0;
        this.role = Role.None;
    }

    static async fromAddress(web3: Web3, address: string, onUpdate?: (proposal: Proposal) => any) {
        let proposal = new Proposal(address, onUpdate);
        await proposal.update(web3);
        return proposal;
    };

    static subscribeToFactory(web3: Web3, onUpdateProposals: (proposals: Proposal[]) => any) {
        const contract = factoryContract(web3);

        subscribeToEvent(contract, 'ProposalCreated', events => {
            Promise
                .all(events.map(async event => {
                    try {
                        return await Proposal
                            .fromAddress(web3, event.returnValues.proposalAddress, proposal =>
                                onUpdateProposals([proposal])
                            )
                    } catch (e) {
                        // do nothing, bad proposal, maybe deleted
                    }
                }))
                .then(proposals => proposals.filter(notEmpty))
                .then(proposals => onUpdateProposals(proposals));
        });
    }

    public static async deploy(web3: Web3,
                               arbiterReward: string,
                               proposalTaskIPFSHash: string,
                               contractor: string,
                               token: string) {

        const from = await myAddress(web3);
        let contract = factoryContract(web3);

        let decimals = await tokenContract(web3, token).methods.decimals().call();

        let method = contract.methods.createConfiguredProposal(
            toWei(arbiterReward, decimals),
            web3.utils.asciiToHex(proposalTaskIPFSHash),
            contractor,
            token
        );

        return await method.send({from});
    }

    public async prepay(web3: Web3) {
        const from = await myAddress(web3);

        // let reward = this.contractorTokenReward * Math.pow(10, this.decimals);
        let numReward = Number(this.contractorTokenReward) + Number(this.arbiterTokenReward);
        let reward = toWei(numReward.toString(), this.decimals);

        await this.myTokenContract(web3).methods.approve(this.address, reward).send({from});
        return await this.contract(web3).methods.pushToPrepaidState().send({from});
    }

    private contract(web3: Web3) {
        return new web3.eth.Contract(abi, this.address);
    }


    /// Public methods

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

    private myTokenContract(web3: Web3) {
        // @ts-ignore
        const tokenAbi: AbiItem[] = erc20;
        return new web3.eth.Contract(tokenAbi, this.proposalCurrencyToken);
    }


    /// Constructing

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

    private updateAndSubscribeEvents(web3: Web3): Promise<any> {
        const contract = this.contract(web3);
        return new Promise(resolve => {
            subscribeToEvent(contract, 'allEvents', (events, onInit) => {
                events.forEach(event => {
                    const name = event.event;
                    switch (name) {
                        case "ProposalWasSetUp":
                            this.ipfsHash = web3.utils.hexToAscii(event.returnValues.task);
                            break;
                        case "ProposalTaskWasDone":
                            this.doneIpfsHash = web3.utils.hexToAscii(event.returnValues.solution);
                            break;
                    }
                });
                if (onInit)
                    resolve();
                if (!onInit && this.onUpdate) {
                    this.onUpdate(this);
                }
            });
        });
    }

    private async update(web3: Web3) {
        let m = this.contract(web3).methods;

        await Promise.all(avaliableFields.map(async (methodName) => {
            this[methodName] = await m[methodName]().call();
        }));

        this.decimals = await this.myTokenContract(web3).methods.decimals().call();

        this.contractorTokenReward = fromWei(this.contractorTokenReward, this.decimals);
        this.arbiterTokenReward = fromWei(this.arbiterTokenReward, this.decimals);

        await this.updateRole(web3);
        await this.updateAndSubscribeEvents(web3);
    }
};
