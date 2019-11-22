import React from 'react';
import './app.css';
import {getWeb3, sleep} from "../../tools/tools";
import config from "../../config/config";
import Proposal from "../../model/proposal";
import {connect} from "react-redux";
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import Web3 from "web3";
import AllProposals from "../allProposals/allProposals";
import {Button} from "@material-ui/core";
import NewProposalDialog from "../../components/newProposalDialog/newProposalDialog";

// const IPFS = require('ipfs');

interface State {
    newTaskDialogOpen: boolean
}

class App extends React.Component<ReduxProps, State> {

    constructor(props) {
        super(props);
        this.state = {
            newTaskDialogOpen: true
        };
    }


    componentDidMount() {
        // this.loadIpfs();
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
                let allProposals = await Proposal.all(web3, config.proposalFactoryAddress);
                let myAddress = (await web3.eth.getAccounts())[0];
                this.props.updateProposals(allProposals);
                this.props.setMyAddress(myAddress);
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
