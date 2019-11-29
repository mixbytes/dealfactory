import React, {useState} from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../../store";
import {connect} from "react-redux";
import {LinearProgress, Typography} from "@material-ui/core";
import proposal from "../../../model/proposal";
import {IpfsFileMeta, uploadFileToIpfs} from "../../../tools/tools";

export interface Props {
    open: boolean,
    onClose: () => any
    onSubmit: () => any,
}

type Form = {
    arbiterReward: string,
    contractorAddress: string,
    tokenAddress: string,
    taskFile?: File
}

const IPFS_LOAD_PERCENT = 80;

// class NewProposalDialog extends React.Component<Props & ReduxProps, State> {
const NewProposalDialog: React.FC<Props & ReduxProps> = (props) => {

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");
    const initialForm: Form = {
        arbiterReward: "",
        contractorAddress: "",
        tokenAddress: "",
        taskFile: undefined
    };
    const [form, setForm] = useState(initialForm);

    const reset = (error = "") => {
        setLoading(false);
        setProgress(0);
        setError(error);
    };

    const createProposal = (ipfsFileMeta: IpfsFileMeta) => {
        const data = form;
        proposal
            .deploy(
                props.web3!,
                data.arbiterReward,
                ipfsFileMeta.hash,
                data.contractorAddress,
                data.tokenAddress
            )
            .then(() => {
                setProgress(100);
                props.onSubmit();
            })
            .catch((e) => {
                console.error(e);
                reset("Transaction error");
            });
    };

    const onFormSubmit = () => {
        reset();

        const data: Form = form;

        uploadFileToIpfs(
            data.taskFile!,
            (prog) => setProgress(prog),
            0,
            IPFS_LOAD_PERCENT)
            .then((ipfsFileMeta: IpfsFileMeta) => {
                createProposal(ipfsFileMeta);
            })
            .catch((e) => {
                console.log(e);
                reset("IPFS connect error");
            });
    };

    const {open, onClose} = props;

    // @ts-ignore
    // @ts-ignore
    return (
        <Dialog open={open} onClose={loading ? undefined : onClose}>
            <DialogTitle>Create new task</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please submit the form below and apply the task file
                </DialogContentText>
                <TextField
                    value={form.arbiterReward}
                    onChange={(e) => setForm({...form, arbiterReward: e.target.value})}
                    required
                    autoFocus
                    margin="dense"
                    label="Reward for arbiter"
                    fullWidth
                />
                <TextField
                    value={form.contractorAddress}
                    onChange={(e) => setForm({...form, contractorAddress: e.target.value})}
                    required
                    margin="dense"
                    label="The Contractor address"
                    fullWidth
                />
                <TextField
                    value={form.tokenAddress}
                    onChange={(e) => setForm({...form, tokenAddress: e.target.value})}
                    required
                    margin="dense"
                    label="The address of currency token account (erc20)"
                    fullWidth
                />
                <TextField
                    onChange={(e) => {
                        const file = (e.target as any).files[0];
                        setForm(
                            {
                                ...form,
                                taskFile: file
                            });
                    }}
                    required
                    margin="dense"
                    label="The task file"
                    fullWidth
                    type={"file"}
                />
                <LinearProgress variant={"determinate"} value={progress} style={{margin: 20}}/>
            </DialogContent>
            <DialogActions>
                <Typography variant={"caption"} color={"error"}>
                    {error}
                </Typography>
                <Button disabled={loading} color="primary" onClick={onClose}>
                    Cancel
                </Button>
                <Button type={"submit"} color="primary" variant={"contained"} disabled={loading} onClick={onFormSubmit}>
                    Apply
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(NewProposalDialog);
