/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import {LogLevel} from "ziron-broker";
import {secrets} from "docker-secret";
import BrokerServer from "./BrokerServer";

const variables = Object.assign({}, process.env, secrets);

process.title = `Zation Broker`;

new BrokerServer({
  join:
      variables.JOIN != null
          ? variables.JOIN
          : `${variables.SECRET || ""}@${variables.STATE || ""}`,
  port: parseInt(variables.PORT) || 8888,
  path: variables.SERVER_PATH || "/",
  logLevel: isNaN(parseInt(variables.LOG_LEVEL))
      ? LogLevel.Everything
      : parseInt(variables.LOG_LEVEL),
})
    .listenAndJoin()
    .catch(() => process.exit(1));
