import React from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {mapDispatchToProps, mapStateToProps, ReduxProps} from "../../store";
import {connect} from "react-redux";

export interface Props {
    open: boolean,
    onClose: () => any
    onSubmit: () => any
}


class NewProposalDialog extends React.Component<Props & ReduxProps> {
    private formRef: HTMLFormElement | null;

    constructor(props: Readonly<Props & ReduxProps>) {
        super(props);
        this.formRef = null;
    }

    createProposal() {
        // const ipfs = ipfsClient(config.ipfsNodeAddr);
        // let formData = new FormData(this.formRef!);
        // console.log(formData);
        // this.formRef.
    }

    render() {
        const {open, onClose} = this.props;

        return (
            <Dialog open={open} onClose={onClose}>
                <DialogTitle>Create new task</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please submit the form below and apply the task file
                    </DialogContentText>
                    <form ref={instance => {
                        this.formRef = instance
                    }}>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="arbiter-reward"
                            label="Reward for arbiter"
                            fullWidth
                        />
                        <TextField
                            margin="dense"
                            id="contractor"
                            label="The Contractor address"
                            fullWidth
                        />
                        <TextField
                            margin="dense"
                            id="contractor"
                            label="The address of currency token account"
                            fullWidth
                        />
                        <TextField
                            margin="dense"
                            id="contractor"
                            label="The task file"
                            fullWidth
                            type={"file"}
                        />
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={() => {
                        this.createProposal()
                    }} color="primary" variant={"contained"}>
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(NewProposalDialog);
