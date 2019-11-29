import React from 'react';
import './allProposals.css';
import {connect} from "react-redux";
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import {Grid, Paper, Typography} from "@material-ui/core";
import Proposal, {Role} from "../../model/proposal";
import ProposalView from "../../components/proposalView/proposalView";

class AllProposals extends React.Component<ReduxProps> {

    componentDidMount() {

    }

    render() {
        const proposals = Array.from(this.props.proposals.values());

        console.log(proposals);

        const myProposals = proposals.filter(proposal =>
            proposal.role === Role.Customer
        ).reverse();
        const forMe = proposals.filter(proposal =>
            proposal.role === Role.Contractor
        ).reverse();

        return (
            <div>
                <Grid container>
                    <Grid xs item>
                        {this.renderProposalsList("My tasks", myProposals)}
                    </Grid>
                    <Grid xs item>
                        {this.renderProposalsList("Tasks for me", forMe)}
                    </Grid>
                </Grid>
            </div>
        );
    }

    renderProposalsList(name: String, proposals: Proposal[]) {
        return (
            <div style={{padding: 10, minWidth: 600}}>
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
