import Proposal from "../model/proposal";
import {Actions, AppAction} from "./actions";
import Web3 from "web3";

export interface AppState {
    proposals: Proposal[],
    web3?: Web3,
    myAddress: string
}

const initialState: AppState = {
    proposals: [],
    web3: undefined,
    myAddress: ""
};

function appReducer(
    state = initialState,
    action: AppAction
): AppState {
    switch (action.type) {
        case Actions.UPDATE_PROPOSALS:
            return {
                ...state,
                proposals: action.payload
            };

        case Actions.SET_WEB3:
            return {
                ...state,
                web3: action.payload
            };

        case Actions.SET_MY_ADDRESS:
            return {
                ...state,
                myAddress: action.payload
            };

        default:
            return state
    }
}

export const rootReducer = appReducer;

