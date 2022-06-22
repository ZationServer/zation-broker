/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import {BrokerServer as ZironBrokerServer,BrokerServerOptions} from 'ziron-broker';
import MachineState from "machine-state";
import {version as SERVER_VERSION} from './../package.json';
import * as IP from 'ip';
import {memoResult} from "./utils";

export default class BrokerServer extends ZironBrokerServer {

    private launchedTimestamp?: number;

    constructor(options: BrokerServerOptions = {}) {
        super(options);
        this._initStandaloneStateProcedure();
        this._startResetCounterInterval();
    }

    public async listen() {
        await super.listen();
        if(this.launchedTimestamp == null)
            this.launchedTimestamp = Date.now();
    }

    public async listenAndJoin() {
        await this.listen();
        await this.join();
    }

    private _initStandaloneStateProcedure() {
        this.procedures['#state'] = async (socket, limitToDynamicInfo, end, reject) => {
            try {
                if(limitToDynamicInfo) end({
                    ...(await this.getDynamicServerStateInfoCached()),
                    id: this.id
                });
                else {
                    const [staticInfo,dynamicInfo] = await Promise.all([this.getStaticServerStateInfoCached(),
                        this.getDynamicServerStateInfoCached()]);
                    end({...staticInfo,...dynamicInfo,id: this.id});
                }
            }
            catch (e) {reject(new Error("Failed to load server state."))}
        };
    }

    private _startResetCounterInterval() {
        setInterval( () => {
            this.server.resetCounts();
        },1000);
    }

    private readonly getStaticServerStateInfoCached = memoResult(this.getStaticServerStateInfo.bind(this));
    public async getStaticServerStateInfo() {
        const server = this.server;
        return {
            type: 1,
            port: server.port,
            path: server.path,
            tls: server.tls,
            nodeVersion: process.version,
            serverVersion: SERVER_VERSION,
            launchedTimestamp: this.launchedTimestamp,
            ...(await MachineState.getGeneralInfo())
        }
    }

    private _dynamicServerInfoPromise: Promise<any> | null = null;
    private async getDynamicServerStateInfoCached() {
        if(this._dynamicServerInfoPromise != null) return this._dynamicServerInfoPromise;
        const result = await (this._dynamicServerInfoPromise = this.getDynamicServerStateInfo());
        this._dynamicServerInfoPromise = null;
        return result;
    }

    private async getDynamicServerStateInfo() {
        const server = this.server;
        return {
            ip: IP.address(),
            connectedToState: this.isConnectedToState(),
            clientCount: server.clientCount,
            resourceUsage: (await MachineState.getResourceUsageInfo()),
            httpMessageCount: server.httpMessageCount,
            wsMessageCount: server.wsMessageCount,
            invokeMessageCount: server.invokeMessageCount,
            transmitMessageCount: server.transmitMessageCount
        }
    }
}