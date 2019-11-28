import React from 'react';
import './app.css';
import {getWeb3, sleep} from "../../tools/tools";
import Proposal from "../../model/proposal";
import {connect} from "react-redux";
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import Web3 from "web3";
import AllProposals from "../allProposals/allProposals";
import {Button} from "@material-ui/core";
import NewProposalDialog from "../../components/dialog/newProposalDialog/newProposalDialog";

interface State {
    newTaskDialogOpen: boolean
}

class App extends React.Component<ReduxProps, State> {

    constructor(props) {
        super(props);
        this.state = {
            newTaskDialogOpen: false
        };
    }


    componentDidMount() {
        getWeb3().then(web3 => {
            this.props.setWeb3(web3);
            this.startUpdateProposalsCycle(web3);
        }).catch(e => {
            console.error(e);
        });
    }

    render() {
        const {newTaskDialogOpen} = this.state;
        return (
            <div>
                <NewProposalDialog
                    open={newTaskDialogOpen}
                    onClose={() => {
                        this.setState({
                            newTaskDialogOpen: false
                        });
                    }}
                    onSubmit={() => {
                        this.setState({
                            newTaskDialogOpen: false
                        });
                    }}/>
                <Button variant={"contained"} fullWidth size={"large"} color={"secondary"} onClick={() => {
                    this.setState({
                        newTaskDialogOpen: true
                    });
                }}>
                    Create new task
                </Button>
                <AllProposals/>
            </div>
        );
    }

    private async startUpdateProposalsCycle(web3: Web3) {
        // Start infinite loop of updating all proposals information
        // noinspection InfiniteLoopJS
        while (true) {
            try {
                let allProposals = await Proposal.all(web3);
                this.props.updateProposals(allProposals);
            } finally {
                await sleep(3000);
            }
        }
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(App);
