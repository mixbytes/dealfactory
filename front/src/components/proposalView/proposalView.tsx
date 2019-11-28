import React from 'react';
import {connect} from "react-redux";
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import {
    Button,
    Card,
    ExpansionPanel,
    ExpansionPanelDetails,
    ExpansionPanelSummary,
    Typography
} from "@material-ui/core";
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Proposal, {avaliableFields, Role, State} from "../../model/proposal";
import CloseDialog from "../dialog/closeDialog/closeDialog"
import DialogActions from "@material-ui/core/DialogActions";
import ResponseDialog from "../dialog/responseDialog/responseDialog";
import PayDialog from "../dialog/payDialog/payDialog"
import AnnounceCompleteDialog from "../dialog/announceCompleteDialog/announceCompleteDialog";

export interface Props {
    proposal: Proposal
}

const ProposalView: React.FC<Props & ReduxProps> = (props) => {

    const [closeDialog, setCloseDialog] = React.useState(false);
    const [responseDialog, setResponseDialog] = React.useState(false);
    const [payDialog, setPayDialog] = React.useState(false);
    const [announceCompleteDialog, setAnnounceCompleteDialog] = React.useState(false);

    const {proposal} = props;

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

    const state = proposal.currentState;

    if (state === State.ZS)
        return null;

    const stringState = (() => {
        switch (state) {
            case State.INIT:
                return "Open";
            case State.PROPOSED:
                return "Proposed";
            case State.PREPAID:
                return "Prepaid";
            default:
                return "Unknown";
        }
    })();

    return (
        <Card style={{backgroundColor: "#64bbed"}}>
            <CloseDialog proposal={proposal}
                         onSubmit={() => setCloseDialog(false)}
                         onClose={() => {
                             props.updateProposals(props.proposals.filter(p => p.address !== proposal.address));
                             setCloseDialog(false);
                         }}
                         open={closeDialog}
            />
            <ResponseDialog proposal={proposal}
                            onSubmit={() => setResponseDialog(false)}
                            onClose={() => setResponseDialog(false)}
                            open={responseDialog}
            />
            <PayDialog proposal={proposal}
                       onSubmit={() => setPayDialog(false)}
                       onClose={() => setPayDialog(false)}
                       open={payDialog}
            />
            <AnnounceCompleteDialog
                proposal={proposal}
                onSubmit={() => setAnnounceCompleteDialog(false)}
                onClose={() => setAnnounceCompleteDialog(false)}
                open={announceCompleteDialog}
            />
            <div style={{padding: 16}}>
                <Typography variant={"h5"} gutterBottom>
                    {proposal.address}
                </Typography>
                <Typography variant={"h6"} gutterBottom>
                    State: {stringState}
                </Typography>
                <Typography variant={"h6"} gutterBottom>
                    Role: {proposal.role}
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
                <DialogActions style={{paddingBottom: 0}}>
                    {proposal.currentState === State.COMPLETED &&
                    <a href={`https://ipfs.io/ipfs/`} download
                       style={{textDecoration: "none"}}>
                        <Button color="secondary" variant={"outlined"}>
                            Download solution
                        </Button>
                    </a>
                    }
                    <a href={`https://ipfs.io/ipfs/${proposal.ipfsHash}`} download
                       style={{textDecoration: "none"}}>
                        <Button color="primary">
                            Download task
                        </Button>
                    </a>
                    {proposal.role === Role.Customer ?
                        <Button color={"secondary"} variant={"contained"} onClick={() => setCloseDialog(true)}>
                            Close
                        </Button>
                        :
                        null
                    }
                    {proposal.role === Role.Contractor && proposal.currentState === State.INIT ?
                        <Button color={"secondary"} variant={"contained"} onClick={() => setResponseDialog(true)}>
                            Respond
                        </Button>
                        :
                        null
                    }
                    {proposal.role === Role.Contractor && proposal.currentState === State.PREPAID ?
                        <Button color={"secondary"} variant={"contained"}
                                onClick={() => setAnnounceCompleteDialog(true)}>
                            Submit done
                        </Button>
                        :
                        null
                    }
                    {proposal.role === Role.Customer && proposal.currentState === State.PROPOSED ?
                        <Button color={"secondary"} variant={"contained"} onClick={() => setPayDialog(true)}>
                            Pay
                        </Button>
                        :
                        null
                    }
                </DialogActions>
            </div>
        </Card>
    );
};


export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ProposalView);
