/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import {BrokerServer as ZironBrokerServer,BrokerServerOptions} from 'ziron-broker';
import MachineState from "machine-state";
import {version as SERVER_VERSION} from './../package.json';
import * as IP from 'ip';

export default class BrokerServer extends ZironBrokerServer {

    private launchedTimestamp?: number;

    constructor(options: BrokerServerOptions = {}) {
        super(options);
        this._initStandaloneStateProcedure();
        this._startResetCounterInterval();
    }

    public async listenAndJoin() {
        await this.listen();
        if(this.launchedTimestamp == null) this.launchedTimestamp = Date.now();
        await this.join();
    }

    private _initStandaloneStateProcedure() {
        this.procedures['#state'] = async (socket, limitToDynamicInfo, end, reject) => {
            try {
                if(limitToDynamicInfo) end({
                    ...(await this.getDynamicServerStateInfo()),
                    id: this.id
                });
                else {
                    const [staticInfo,dynamicInfo] = await Promise.all([this.getStaticServerStateInfo(),
                        this.getDynamicServerStateInfo()]);
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

    public async getStaticServerStateInfo() {
        const server = this.server;
        return {
            type: 1,
            port: server.port,
            path: server.path,
            tls: server.tls,
            nodeVersion: process.version,
            ip: IP.address(),
            serverVersion: SERVER_VERSION,
            launchedTimestamp: this.launchedTimestamp,
            ...(await MachineState.getGeneralInfo())
        }
    }

    private async getDynamicServerStateInfo() {
        const server = this.server;
        return {
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