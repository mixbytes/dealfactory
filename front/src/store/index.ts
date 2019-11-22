import {createStore} from 'redux';
import {AppState, rootReducer} from "./reducers";
import {actions} from "./actions";

export const store = createStore(rootReducer);

export const mapStateToProps = (state: AppState) => state;

export const mapDispatchToProps = actions;

export type ReduxProps = ReturnType<typeof mapStateToProps> & typeof mapDispatchToProps;
