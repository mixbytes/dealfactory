import Web3 from "web3";

const getWeb3 = async () => {
    // @ts-ignore
    const we = window.ethereum;
    // @ts-ignore
    const w3 = window.web3;

    if (we) {
        we.autoRefreshOnNetworkChange = false;
        await we.enable();
        return new Web3(we);
    }
    if (w3)
        return new Web3(we);

    throw new Error("No etherium provider");
};



export {getWeb3};
