import React from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../../store";
import {connect} from "react-redux";
import {LinearProgress} from "@material-ui/core";
import {IpfsFileMeta, uploadFileToIpfs} from "../../../tools/tools";
import Proposal from "../../../model/proposal";

export interface Props {
    open: boolean,
    onClose: () => any
    onSubmit: () => any,
    proposal: Proposal
}

type Form = {
    doneFile?: File
}

const AnnounceCompleteDialog: React.FC<Props & ReduxProps> = (props) => {
    const {open, onClose, onSubmit, proposal, web3} = props;

    const [progress, setProgress] = React.useState(0);
    const initialForm: Form = {
        doneFile: undefined
    };
    const [form, setForm] = React.useState(initialForm);

    const announceComplete = function (meta: IpfsFileMeta) {
        proposal.announceComplete(web3!, meta.hash)
            .then(() => {
                setProgress(100);
                onSubmit();
            })
            .catch((e) => {
                console.error(e);
                setProgress(0);
            });
    };

    const uploadFile = function () {

        const file = form.doneFile!;

        uploadFileToIpfs(
            file,
            (prog) => setProgress(prog),
            10,
            80)
            .then((ipfsFileMeta: IpfsFileMeta) => {
                announceComplete(ipfsFileMeta);
            })
            .catch(() => {
                setProgress(0);
            });
    };

    const loading = progress !== 0;
    return (
        <Dialog open={open} onClose={loading ? undefined : onClose}>
            <DialogTitle>Announce completed work</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Announce that you rendered the proposal and attach the done work file
                </DialogContentText>
                <TextField
                    onChange={(e) => {
                        const file = (e.target as any).files[0];
                        setForm(
                            {
                                ...form,
                                doneFile: file
                            });
                    }}
                    autoFocus
                    required
                    margin="dense"
                    label="The task file"
                    fullWidth
                    type={"file"}
                />
                <LinearProgress variant={"determinate"} value={progress} style={{margin: 20}}/>
            </DialogContent>
            <DialogActions>
                <Button disabled={loading} color="primary" onClick={onClose}>
                    Cancel
                </Button>
                <Button type={"submit"} color="primary" variant={"contained"} disabled={loading}
                        onClick={() => {
                            uploadFile()
                        }}>
                    Announce (Not working yet)
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AnnounceCompleteDialog);
