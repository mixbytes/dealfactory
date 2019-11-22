import Proposal from "../model/proposal";
import {Action} from "redux";
import Web3 from "web3";

export enum Actions {
    UPDATE_PROPOSALS,
    SET_WEB3,
    SET_MY_ADDRESS
}

interface BaseAction<Type, Payload> extends Action<Type> {
    payload: Payload
}

function action<Type extends Actions, Payload>(type: Type, payload: Payload): BaseAction<Type, Payload> {
    return {
        type,
        payload: payload
    }
}

export const actions = {
    updateProposals: (proposals: Proposal[]) => action(Actions.UPDATE_PROPOSALS, proposals),
    setWeb3: (web3: Web3) => action(Actions.SET_WEB3, web3),
    setMyAddress: (address: string) => action(Actions.SET_MY_ADDRESS, address),
};

type Infer<T> = T extends { [key: string]: infer U } ? U : never;

export type AppAction = ReturnType<Infer<typeof actions>>
