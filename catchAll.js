/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'catchAll',
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
    //lat: config['도곡동'].lat,
    //lng: config['도곡동'].lng
    //37.50486067,127.05508582
    //37.51536255,127.02053301
    //37.49004124,127.01398962
    //37.479643, 127.007774
    lat: 37.479643,
    lng: 127.007774
  }
};

let bot;
try {
  bot = require('./lib/pokemonBot')(options);
  bot.start()
    .then(() => {
      log.info('포케몬 포획작업이 종료됩니다');
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
    bot.printLocation(options.player.lat, options.player.lng);
    log.debug('지도 정보를 요청합니다');
    let cellIDs =
      pogobuf.Utils.getCellIDs(options.player.lat, options.player.lng);

    client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0))
      .then(maps => {
        bot.glimpsePokomon(maps);
        bot.watchPokemon(maps);
        let pokemons = bot.getCatchablePokemons(maps);
        //log.debug('근접 포케몬(들): ', pokemons);

        if (pokemons.length < 1) {
          log.error('잡을 수 있는 포케몬이 없습니다');
          return new Promise((resolve, reject) => {
            reject('잡을 수 있는 포케몬이 없습니다');
          });
        }
        return bot.catchAll(client, pokemons, true); // accuracy = true
      })
      .then(() => {
        resolve();
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
