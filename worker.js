const SCWorker = require('socketcluster/scworker');
const url = require('url');
const express = require('express');
const healthChecker = require('sc-framework-health-check');

class Worker extends SCWorker {
  // noinspection JSUnusedGlobalSymbols
    run() {
    const AUTH_KEY = this.options.clusterAuthKey;

    const httpServer = this.httpServer;
    const scServer = this.scServer;

    const app = express();

    // Add GET /health-check express route
    healthChecker.attach(this, app);

    httpServer.on('request', app);

    if (AUTH_KEY) {
      // noinspection JSUnresolvedVariable
      scServer.addMiddleware(scServer.MIDDLEWARE_HANDSHAKE_WS, (req, next) => {
        const urlParts = url.parse(req.url, true);
        if (urlParts.query && urlParts.query.authKey === AUTH_KEY) {
          next();
        } else {
          const err = new Error('Cannot connect to the cluster broker server without providing a valid authKey as a URL query argument.');
          err.name = 'BadClusterAuthError';
          next(err);
        }
      });
    }

    if (this.options.messageLogLevel > 1) {
      // noinspection JSUnresolvedVariable
        scServer.addMiddleware(scServer.MIDDLEWARE_SUBSCRIBE, (req, next) => {
        console.log(`${req.socket.remoteAddress} subscribed to ${req.channel}`);
        next();
      });
    }
    if (this.options.messageLogLevel > 2) {
      // noinspection JSUnresolvedVariable
      scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_IN, (req, next) => {
        console.log(`${req.socket.remoteAddress} published to ${req.channel}`);
        next();
      });
    }
  }
}

new Worker();
