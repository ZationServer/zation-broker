/*
Author: Luca Scaringella
GitHub: LucaCode
Copyright(c) Luca Scaringella
 */

import {BrokerServer,LogLevel} from "ziron-broker";
import {secrets} from "docker-secret";

const variables = Object.assign({}, process.env, secrets);

process.title = `Zation Broker`;

new BrokerServer({
  join:
    variables.JOIN != null
      ? variables.JOIN
      : `${variables.SECRET || ""}@${variables.STATE || ""}`,
  port: parseInt(variables.PORT) || 8888,
  path: variables.SERVER_PATH || "/",
  logLevel: parseInt(variables.LOG_LEVEL) || LogLevel.Everything,
}).joinAndListen();
