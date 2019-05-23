//SC V 6.0.2

const SocketCluster = require('socketcluster');
const scClient = require('socketcluster-client');
const argv = require('minimist')(process.argv.slice(2));
const packageVersion = require('./package.json').version;

const DEFAULT_PORT = 8888;
const SCC_STATE_SERVER_HOST = process.env.STATE_SERVER_HOST || process.env.ssh || argv.zcsh || process.env.zcsh ||
    process.env.SCC_STATE_SERVER_HOST || process.env.ZATION_STATE_SERVER_HOST;
const SCC_STATE_SERVER_PORT = Number(process.env.STATE_SERVER_PORT) || Number(process.env.SCC_STATE_SERVER_PORT) || Number(process.env.ZATION_STATE_SERVER_PORT) || 7777;
const SCC_INSTANCE_IP = process.env.SCC_INSTANCE_IP || null;
const SCC_INSTANCE_IP_FAMILY = process.env.SCC_INSTANCE_IP_FAMILY || 'IPv4';
const SCC_AUTH_KEY = process.env.cak || process.env.CLUSTER_AUTH_KEY || process.env.SCC_AUTH_KEY || null;
const RETRY_DELAY = Number(argv.r) || Number(process.env.SCC_BROKER_SERVER_RETRY_DELAY) || 2000;
const STATE_SERVER_CONNECT_TIMEOUT = Number(process.env.SCC_STATE_SERVER_CONNECT_TIMEOUT) || 3000;
const STATE_SERVER_ACK_TIMEOUT = Number(process.env.SCC_STATE_SERVER_ACK_TIMEOUT) || 2000;
const BROKER_SERVER_CONNECT_TIMEOUT = Number(process.env.SCC_BROKER_SERVER_CONNECT_TIMEOUT) || 10000;
const BROKER_SERVER_ACK_TIMEOUT = Number(process.env.SCC_BROKER_SERVER_ACK_TIMEOUT) || 10000;
const SECURE = !!argv.s || !!process.env.SCC_BROKER_SERVER_SECURE;
const RECONNECT_RANDOMNESS = 1000;

let firstCon = true;
/**
 * Log levels:
 * 3 - log everything
 * 2 - warnings and errors
 * 1 - errors only
 * 0 - log nothing
 */
let LOG_LEVEL;
if (typeof argv.l !== 'undefined') {
  LOG_LEVEL = Number(argv.l);
} else if (typeof process.env.LOG_LEVEL !== 'undefined') {
  LOG_LEVEL = Number(process.env.LOG_LEVEL);
} else {
  LOG_LEVEL = 2;
}

function logError(err) {
    if (LOG_LEVEL > 0) {
        console.error('\x1b[31m%s\x1b[0m', '   [Error]',err);
    }
}

function logStartFail(err) {
    console.error('\x1b[31m%s\x1b[0m', '   [Error]',err);
    process.exit()
}

function logWarning(war) {
    if (LOG_LEVEL > 0) {
        console.error('\x1b[31m%s\x1b[0m','   [WARNING]',war);
    }
}

function logBusy(txt) {
    if (LOG_LEVEL > 0) {
        console.error('\x1b[33m%s\x1b[0m', '   [BUSY]',txt);
    }
}

function logActive(txt) {
    if (LOG_LEVEL > 0) {
        console.error('\x1b[32m%s\x1b[0m', '   [ACTIVE]',txt);
    }
}

function logInfo(info) {
    if (LOG_LEVEL >= 1) {
        console.log('\x1b[34m%s\x1b[0m','   [INFO]',info);
    }
}

logBusy('Launching Zation-Cluster-Broker');

if (!SCC_STATE_SERVER_HOST) {
    logError('No ZATION_CLUSTER_STATE_SERVER_HOST was specified - This should be provided ' +
    'either through the STATE_SERVER_HOST environment variable or ' +
    'by passing a --zcsh=hostname argument to the CLI');
    process.exit();
}

const options = {
  workers: Number(argv.w) || Number(process.env.SOCKETCLUSTER_WORKERS) || 1,
  brokers: Number(argv.b) || Number(process.env.SOCKETCLUSTER_BROKERS) || 1,
  port: Number(argv.p) || Number(process.env.SCC_BROKER_SERVER_PORT) || DEFAULT_PORT,
  wsEngine: process.env.SOCKETCLUSTER_WS_ENGINE || 'sc-uws',
  appName: argv.n || process.env.SOCKETCLUSTER_APP_NAME || null,
  workerController: argv.wc || process.env.SOCKETCLUSTER_WORKER_CONTROLLER || __dirname + '/worker.js',
  brokerController: argv.bc || process.env.SOCKETCLUSTER_BROKER_CONTROLLER || __dirname + '/broker.js',
  socketChannelLimit: null,
  crashWorkerOnError: argv['auto-reboot'] !== false,
  connectTimeout: BROKER_SERVER_CONNECT_TIMEOUT,
  ackTimeout: BROKER_SERVER_ACK_TIMEOUT,
  logLevel: LOG_LEVEL ? LOG_LEVEL : 0,
  clusterAuthKey: SCC_AUTH_KEY
};

let SOCKETCLUSTER_OPTIONS;

if (process.env.SOCKETCLUSTER_OPTIONS) {
  SOCKETCLUSTER_OPTIONS = JSON.parse(process.env.SOCKETCLUSTER_OPTIONS);
}

for (let i in SOCKETCLUSTER_OPTIONS) {
  if (SOCKETCLUSTER_OPTIONS.hasOwnProperty(i)) {
    options[i] = SOCKETCLUSTER_OPTIONS[i];
  }
}

try {
    require("sc-uws");
}
catch (e) {
    if(options.wsEngine === 'sc-uws') {
        logStartFail(`Failed to load sc-uws! Error -> ${e.toString()}.`);
    }
}

const socketCluster = new SocketCluster(options);

process.title = `Zation Cluster Broker: ${socketCluster.options.instanceId}`;

const connectToClusterStateServer = function () {
  const scStateSocketOptions = {
    hostname: SCC_STATE_SERVER_HOST,
    port: SCC_STATE_SERVER_PORT,
    connectTimeout: STATE_SERVER_CONNECT_TIMEOUT,
    ackTimeout: STATE_SERVER_ACK_TIMEOUT,
    autoReconnectOptions: {
      initialDelay: RETRY_DELAY,
      randomness: RECONNECT_RANDOMNESS,
      multiplier: 1,
      maxDelay: RETRY_DELAY + RECONNECT_RANDOMNESS
    },
    query: {
      authKey: SCC_AUTH_KEY,
      instancePort: socketCluster.options.port,
      instanceType: 'scc-broker',
      version: packageVersion
    }
  };

  const stateSocket = scClient.connect(scStateSocketOptions);

  stateSocket.on('error', (err) => {
    if (LOG_LEVEL > 2) {
      logError(err);
    }
  });

  stateSocket.on('disconnect',()=> {
    logWarning('Broker lost the connection to the zation-cluster-state server. Broke will try to reconnect.');
  });

  stateSocket.on('connectAbort',() =>
  {
    if(LOG_LEVEL > 0){
      if(firstCon) {
          logWarning('Connection to zation-cluster-state server is failed. Broker will try to reconnect.');
      }
      else{
          logWarning('Reconnection to zation-cluster-state server is failed. Broker will try to reconnect.');
      }
    }
  });

  const stateSocketData = {
    instanceId: socketCluster.options.instanceId,
    instanceIp: SCC_INSTANCE_IP,
    instanceIpFamily: SCC_INSTANCE_IP_FAMILY,
    instanceSecure: SECURE
  };

  const emitJoinCluster = () => {
    stateSocket.emit('sccBrokerJoinCluster', stateSocketData, (err) => {
      if (err) {
        setTimeout(emitJoinCluster, RETRY_DELAY);
      }
    });
  };

  stateSocket.on('connect', () =>
  {
    if(firstCon) {
      firstCon = false;
      logInfo(`Connected to zation-cluster-state server on host:'${SCC_STATE_SERVER_HOST}' and port:'${SCC_STATE_SERVER_PORT}'`);
    }
    else {
        logInfo(`Broker is reconnected to zation-cluster-state server on host:'${SCC_STATE_SERVER_HOST}' and port:'${SCC_STATE_SERVER_PORT}'`);
    }
    emitJoinCluster();
  });

};

connectToClusterStateServer();

logActive('Zation-CLuster-Broker started');