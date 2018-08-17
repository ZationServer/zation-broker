//SC V 6.0.1

const SocketCluster = require('socketcluster');
const scClient = require('socketcluster-client');
const argv = require('minimist')(process.argv.slice(2));
const packageVersion = require('./package.json').version;

const DEFAULT_PORT = 8888;
const SCC_STATE_SERVER_HOST = process.env.STATE_SERVER_HOST || process.env.ssh || argv.cssh || process.env.SCC_STATE_SERVER_HOST;
const SCC_STATE_SERVER_PORT = Number(process.env.STATE_SERVER_PORT) || Number(process.env.SCC_STATE_SERVER_PORT) || 7777;
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
} else if (typeof process.env.SCC_BROKER_SERVER_LOG_LEVEL !== 'undefined') {
  LOG_LEVEL = Number(process.env.SCC_BROKER_SERVER_LOG_LEVEL);
} else {
  LOG_LEVEL = 1;
}

if (!SCC_STATE_SERVER_HOST) {
  throw new Error('No SCC_STATE_SERVER_HOST was specified - This should be provided ' +
    'either through the SCC_STATE_SERVER_HOST environment variable or ' +
    'by passing a --cssh=hostname argument to the CLI');
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
  messageLogLevel: LOG_LEVEL,
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

const socketCluster = new SocketCluster(options);

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
    if (LOG_LEVEL > 0) {
      console.error(err);
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

  stateSocket.on('connect', emitJoinCluster);
};

connectToClusterStateServer();
