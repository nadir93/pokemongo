/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'travel',
  level: loglevel
});

const pogobuf = require('pogobuf');
const POGOProtos = require('node-pogo-protos');
const util = require('util');
const _ = require('lodash');
const config = require('./config');

const id = 'YOUR_POKEMONGO_ID';
const checkRarePokemon = true;
const catchPokemon = true;

const options = {
  bot: {
    start: start,
    stop: stop
  },
  player: {
    id: id,
    password: config[id].password,
    lat: config['도곡동'].lat,
    lng: config['도곡동'].lng
  }
};

let bot;

try {
  bot = require('./lib/pokemonBot')(options);
  bot.start()
    .then(() => {
      log.info('여행을 종료합니다');
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
    log.debug('포켓스탑 정보를 요청합니다');
    //getPokestops
    getPokestops(client)
      .then(pokestops => {
        //log.debug('포케스탑: ', forts);
        //travel
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            travel(client, pokestops)
              .then(() => {
                resolve();
              })
              .catch(e => {
                reject(e);
              });
          }, 11000); //11초뒤 호출
        });
      })
      .then(() => {
        log.info('작업이 완료되었습니다');
        resolve();
      })
      .catch(function(e) {
        log.error('travel error: ', e);
        reject(e);
      });
  });
}

function stop() {
  return new Promise((resolve, reject) => {
    resolve();
  });
}

function getPokestops(client) {
  return new Promise((resolve, reject) => {
    let cellIDs =
      pogobuf.Utils.getCellIDs(options.player.lat, options.player.lng);
    client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0))
      .then(maps => {
        let nearbyForts = _.sumBy(maps.map_cells,
          function(o) {
            return o.forts.length;
          });
        log.info('가까운 포케스탑: ', nearbyForts);

        let cells = maps.map_cells.filter(cell => {
          return cell.forts.length > 0;
        });
        //log.debug('pokestop 으로 필터링된 cell 갯수: ', cells.length);
        //log.debug('cells: ', cells);
        if (cells.length < 1) {
          log.info('지도상에 포케스탑이 없습니다');
          reject('지도상에 포케스탑이 없습니다');
        } else {
          let pokestops = [];
          cells.forEach(cell => {
            cell.forts.forEach(item => {
              if (item.type == 1) { // 포케스탑만
                pokestops.push(item);
              }
            });
          });
          resolve(pokestops);
        }
      })
  })
}

function travel(client, pokestops) {
  let index = 0;
  return new Promise(function(resolve, reject) {
    function next(rarePokemons) {
      if (index < pokestops.length) {
        doSomething(client, pokestops[index++], rarePokemons)
          .then(next, e => {
            if (e.catchableRarePokemons ||
              e.wildRarePokemons ||
              e.nearbyRarePokemons) {
              index--;
              next(e);
            } else {
              reject(e);
            }
          });
      } else {
        resolve();
      }
    }
    next();
  });
}

function doSomething(client, target, rarePokemons) {
  //log.info('target:', target);
  return new Promise((resolve, reject) => {
    catchRarePokemon(client, rarePokemons)
      .then(() => {
        log.debug('레어 포케몬 작업완료');
        return bot.goto(client, {
          lat: target.latitude,
          lng: target.longitude
        }, checkRarePokemon);
      })
      .then(maps => {
        bot.glimpsePokomon(maps);
        bot.watchPokemon(maps);

        return new Promise((resolve, reject) => {
          if (catchPokemon) {
            let pokemons = bot.getCatchablePokemons(maps);
            //log.debug('근접 포케몬(들): ', pokemons);
            bot.catchAll(client, pokemons, false /* accuracy */ )
              .then(() => {
                resolve()
              })
              .catch(e => {
                reject(e);
              });
          } else {
            resolve();
          }
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, 3000 + Math.random() * 2000);
        });
      })
      .then(() => {
        return client.fortDetails(target.id, target.latitude, target.longitude);
      })
      .then(detail => {
        log.debug('포케스탑: ', detail);
        //loot
        return bot.spinPokestop(
          client, target.id, target.latitude, target.longitude);
      })
      .then(res => {
        if (res.result == 2) {
          return new Promise((resolve, reject) => {
            return reject('pokemongoApp이 softbanned 상태인거 같습니다');
          });
        } else if (res.result == 4) {
          return new Promise((resolve, reject) => {
            return reject('아이템이 가득찼습니다');
          });
        } else {
          return bot.updateAll(client, options.player.id);
        }
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

function catchRarePokemon(client, rarePokemons) {
  return new Promise((resolve, reject) => {
    log.info('레어 포케몬이: ', rarePokemons ? rarePokemons : '없습니다');
    if (rarePokemons) {
      //catch 근접
      catchCatchableRarePokemons(client, rarePokemons)
        // .then(() => {
        //   //catch 근거리
        // })
        .then(() => {
          log.info('근접 레어포케몬을 포획작업 종료');
          //catch 원거리
          return catchNearByRarePokemons(client, rarePokemons);
        })
        .then(() => {
          log.info('원거리 레어포케몬을 포획작업 종료');
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    } else {
      resolve();
    }
  });
}

function catchCatchableRarePokemons(client, rarePokemons) {
  return new Promise((resolve, reject) => {
    if (rarePokemons.catchableRarePokemons &&
      rarePokemons.catchableRarePokemons.length > 0) {
      bot.catchAll(client, rarePokemons.catchableRarePokemons,
          true /* accuracy */ )
        .then(() => {
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    } else {
      resolve();
    }
  });
}

function catchNearByRarePokemons(client, rarePokemons) {
  let index = 0;
  return new Promise((resolve, reject) => {
    function next() {
      if (rarePokemons.nearbyRarePokemons &&
        rarePokemons.nearbyRarePokemons.length > 0 &&
        index < rarePokemons.nearbyRarePokemons.length) {
        bot.goAndCatch(client,
            rarePokemons.nearbyRarePokemons[index++], true /* accuracy */ ,
            options.player.id)
          .then(next, e => {
            reject(e);
          });
      } else {
        resolve();
      }
    }
    next();
  });
}
