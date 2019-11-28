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
import TextField from "@material-ui/core/TextField";

export interface Props {
    open: boolean,
    onClose: () => any
    onSubmit: () => any,
    proposal: Proposal
}

const ResponseDialog: React.FC<Props & ReduxProps> = (props) => {
    const {open, onClose, onSubmit, proposal, web3} = props;

    const [loading, setLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        reward: "",
        deadline: "",
    });

    const respond = function () {
        setLoading(true);
        const {deadline, reward} = formData;
        proposal.respond(web3!, Number(deadline), reward).then(() => {
            setLoading(false);
            onSubmit();
        }).catch((e) => {
            console.error(e);
            setLoading(false);
        });
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose}>
            <DialogTitle>Respond to the proposal</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please set the desired reward and deadline
                </DialogContentText>
                <TextField
                    value={formData.reward}
                    onChange={(e) => setFormData({...formData, reward: e.target.value})}
                    required
                    autoFocus
                    margin="dense"
                    label="Reward you want"
                    fullWidth
                />
                <TextField
                    value={formData.deadline}
                    onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                    required
                    margin="dense"
                    label="Deadline"
                    fullWidth
                />
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
                            respond()
                        }}>
                    Respond
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ResponseDialog);
