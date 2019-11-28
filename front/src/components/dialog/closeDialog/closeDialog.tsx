import React from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../../store";
import {connect} from "react-redux";
import {CircularProgress} from "@material-ui/core";
import Proposal from "../../../model/proposal";

export interface Props {
    open: boolean,
    onClose: () => any
    onSubmit: () => any,
    proposal: Proposal
}

const CloseDialog: React.FC<Props & ReduxProps> = (props) => {
    const {open, onClose, onSubmit, proposal, web3} = props;

    const [loading, setLoading] = React.useState(false);

    const closeProposal = function () {
        setLoading(true);
        proposal.close(web3!).then(() => {
            setLoading(false);
            onSubmit();
        }).catch((e) => {
            console.error(e);
            setLoading(false);
        });
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose}>
            <DialogTitle>Close proposal</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Are you sure?
                </DialogContentText>
                <div style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center"
                }}>
                    <CircularProgress style={{margin: 20}} variant={loading ? "indeterminate" : "static"} value={100}/>
                </div>
            </DialogContent>
            <DialogActions>
                <Button disabled={loading} color="primary" onClick={onClose}>
                    Cancel
                </Button>
                <Button type={"submit"} color="primary" variant={"contained"} disabled={loading}
                        onClick={() => {
                            closeProposal()
                        }}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CloseDialog);
