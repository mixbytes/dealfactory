import Proposal from "../model/proposal";
import {Actions, AppAction} from "./actions";
import Web3 from "web3";

export interface AppState {
    proposals: Map<string, Proposal>,
    web3?: Web3
}

const initialState: AppState = {
    proposals: new Map<string, Proposal>(),
    web3: undefined
};

function appReducer(
    state = initialState,
    action: AppAction
): AppState {
    switch (action.type) {
        case Actions.UPDATE_PROPOSALS:
            const newProposals = new Map<string, Proposal>();
            Array.from(state.proposals.keys()).forEach(key => {
                newProposals.set(key, state.proposals.get(key)!)
            });
            action.payload.forEach(proposal => {
                newProposals.set(proposal.address, proposal);
            });

            return {
                ...state,
                proposals: newProposals
            };

        case Actions.SET_WEB3:
            return {
                ...state,
                web3: action.payload
            };

        default:
            return state
    }
}

export const rootReducer = appReducer;

