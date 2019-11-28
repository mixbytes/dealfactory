import Web3 from "web3";
import BN from 'bn.js';
import ipfsClient from "ipfs-http-client";
import config from "../config/config";

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

async function myAddress(web3: Web3) {
    return (await web3.eth.getAccounts())[0];
}

function toWei(amount: string, decimals: number) {
    let num = (Number(amount) * Math.pow(10, decimals)).toString();
    return '0x' + (new BN(num)).toString('hex');
}

function fromWei(amount: string, decimals: number) {
    let pos = amount.length - decimals;
    return Number([amount.slice(0, pos), ".", amount.slice(pos)].join('')).toString();
}

export type IpfsFileMeta = {
    size: number,
    path: string,
    hash: string
}

async function uploadFileToIpfs(file: File, setProgress?: (progress: number) => any, minProgress = 0, maxProgress = 100) {
    const ipfs = ipfsClient(config.ipfsNodeAddr);
    setProgress && setProgress(minProgress);
    let lastUpdate = Date.now();
    const meta: IpfsFileMeta[] = await ipfs.add(file, {
        progress: setProgress ? (p) => {
            const progress = minProgress + Math.trunc((1.0 - (file.size - p) / file.size) * (maxProgress - minProgress));
            // Material LinearProgress hack
            if ((Date.now() - lastUpdate) > 500) {
                setProgress(progress);
                lastUpdate = Date.now();
            }
        } : undefined
    });
    setProgress && setProgress(maxProgress);
    return meta[0];
}

export {sleep, getWeb3, notEmpty, myAddress, toWei, fromWei, uploadFileToIpfs};
