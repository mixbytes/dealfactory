import React from 'react';
import './app.css';
import {getWeb3} from "../../tools/tools";
import config from "../../config/config";
import Proposal from "../../model/proposal";

// const IPFS = require('ipfs');

class App extends React.Component {

    componentDidMount() {
        this.loadIpfs();
    }

    async loadIpfs() {
        let web3 = await getWeb3();

        let allProposals = await Proposal.all(web3, config.proposalFactoryAddress);

        console.log(allProposals);
    }

    render() {
        return (
            <div className="app">
                <form>
                    <input name="myFile" type="file"/>
                </form>
            </div>
        );
    }
}

export default App;
