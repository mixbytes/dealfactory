import React from 'react';
import './allProposals.css';
import {connect} from "react-redux";
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import {Grid, Paper, Typography} from "@material-ui/core";
import Proposal, {Role, State} from "../../model/proposal";
import ProposalView from "../../components/proposalView/proposalView";

class AllProposals extends React.Component<ReduxProps> {

    componentDidMount() {

    }

    render() {
        const proposals = this.props.proposals;

        const myProposals = proposals.filter(proposal => proposal.role(this.props.myAddress) !== Role.None);
        const openProposals = proposals.filter(proposal =>
            proposal.role(this.props.myAddress) === Role.None && +proposal.currentState === State.INIT
        );

        return (
            <div>
                <Grid container>
                    <Grid item xs>
                        {this.renderProposalsList("My tasks", myProposals)}
                    </Grid>
                    <Grid item xs>
                        {this.renderProposalsList("Open tasks", openProposals)}
                    </Grid>
                </Grid>
            </div>
        );
    }

    renderProposalsList(name: String, proposals: Proposal[]) {
        return (
            <div style={{padding: 10}}>
                <Paper>
                    <Typography variant={"h3"} gutterBottom style={{padding: 10}}>
                        {name}
                    </Typography>
                    {proposals.map((proposal, index) =>
                        <div key={index}
                             style={{padding: 10}}>
                            <ProposalView proposal={proposal}/>
                        </div>
                    )}
                </Paper>
            </div>
        );
    }

}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AllProposals);
