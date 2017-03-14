/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'lootPokestop',
  level: loglevel
});

const pogobuf = require('pogobuf');
const POGOProtos = require('node-pogo-protos');
const util = require('util');
const _ = require('lodash');
const config = require('./config');

let id = 'YOUR_POKEMONGO_ID';

let options = {
  bot: {
    start: start,
    stop: stop
  },
  player: {
    id: id,
    password: config[id].password,
    lat: config[id].lat,
    lng: config[id].lng
  }
};

let bot;
try {
  bot = require('./lib/pokemonBot')(options);
  bot.start()
    .then(() => {
      log.info('작업을 종료합니다');
    })
    .catch(e => {
      log.error(e);
    });
} catch (e) {
  log.error(e);
  process.exit();
}

function start(client) {
  return new Promise((resolve, reject) => {
    log.debug('지도 정보를 요청합니다');
    let cellIDs =
      pogobuf.Utils.getCellIDs(options.player.lat, options.player.lng);

    client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0))
      .then(maps => {
        let forts = bot.getPokestops(maps);
        //log.debug('forts: ', forts);
        return client.fortSearch(
          forts[0].id, forts[0].latitude, forts[0].longitude);
      })
      .then(response => {
        // 0 = NO_RESULT_SET
        // 1 = SUCCESS
        // 2 = OUT_OF_RANGE
        // 3 = IN_COOLDOWN_PERIOD
        // 4 = INVENTORY_FULL
        // 5 = EXCEEDED_DAILY_LIMIT
        log.debug('result: ', response.result);
        if (response.result == 1) {
          resolve();
        } else {
          reject(response.result);
        }
      })
      .catch(e => {
        log.error(e);
        reject(e);
      });
  });
}

function stop() {
  return new Promise((resolve, reject) => {
    resolve();
  });
}
