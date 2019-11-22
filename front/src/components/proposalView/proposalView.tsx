import React from 'react';
import {connect} from "react-redux";
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import {
    Card,
    CardContent,
    ExpansionPanel,
    ExpansionPanelDetails,
    ExpansionPanelSummary,
    Typography
} from "@material-ui/core";
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Proposal, {avaliableFields, State} from "../../model/proposal";

export interface Props {
    proposal: Proposal
}

class ProposalView extends React.Component<Props & ReduxProps> {

    render() {
        const {proposal} = this.props;

        const data = avaliableFields.map(key => {
            return (
                <div key={key}>
                    <Typography variant={"h6"}>
                        {key}:
                    </Typography>
                    <Typography variant={"caption"}>
                        {proposal[key].toString()}
                    </Typography>
                </div>
            )
        });

        const myAddress = this.props.myAddress;
        const state = proposal.currentState;

        if (state === State.ZS)
            return null;

        const stringState = (() => {
            switch (+state) {
                case State.INIT:
                    return "Open";
                case State.PROPOSED:
                    return "Proposed!";
                default:
                    return "Unknown";
            }
        })();

        return (
            <Card style={{backgroundColor: "#64bbed"}}>
                <CardContent>
                    <Typography variant={"h5"} gutterBottom>
                        {proposal.address}
                    </Typography>
                    <Typography variant={"h6"} gutterBottom>
                        State: {stringState}
                    </Typography>
                    <Typography variant={"h6"} gutterBottom>
                        Role: {proposal.role(myAddress)}
                    </Typography>
                    <ExpansionPanel>
                        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon/>}>
                            <Typography>Full information</Typography>
                        </ExpansionPanelSummary>
                        <ExpansionPanelDetails>
                            <div style={{display: "flex", flexDirection: "column"}}>
                                {data}
                            </div>
                        </ExpansionPanelDetails>
                    </ExpansionPanel>
                </CardContent>
            </Card>
        )
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ProposalView);
