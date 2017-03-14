/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'catcher',
  level: loglevel
});

const pogobuf = require('pogobuf');
const POGOProtos = require('node-pogo-protos');
const navigator = require('./navigator');
const pokemon = require('./pokemon');
const pokedex = require('../pokedex');
const moveSet = require('../moveSet');

let items;
let accuracy = false;
let pokeBall = 0;
let greatBall = 0;
let ultraBall = 0;

function encounter(client, pokemon) {
  return new Promise(function(resolve, reject) {
    client
      .encounter(pokemon.encounter_id, pokemon.spawn_point_id)
      .then(result => {
        if (result.status == 7) {
          log.debug('잡을 수 있는 포케몬이 초과되었습니다');
          return reject('잡을 수 있는 포케몬이 초과되었습니다');
        }

        if (!result.wild_pokemon) {
          log.error('포케몬이 사라졌습니다');
          return resolve();
        }

        result['포케몬'] = pokedex[
          result.wild_pokemon.pokemon_data.pokemon_id];
        log.debug('포케몬: ', result['포케몬']);
        log.debug('CP: ', result.wild_pokemon.pokemon_data.cp);
        log.info('IV: ', pogobuf.Utils
          .getIVsFromPokemon(result.wild_pokemon.pokemon_data));
        return catchLoop(client, result);
      })
      .then(() => {
        resolve();
      })
      .catch(function(e) {
        log.error(e);
        reject(e);
      });
  });
}

function catchLoop(client, pokemon) {
  return new Promise((resolve, reject) => {
    function next(result) {
      if (result == 1 || result == 3) {
        resolve(result);
      } else {
        catchMon(client, pokemon)
          .then(res => next(res),
            e => {
              reject(e);
            });
      }
    }
    next();
  });
}

function catchMon(client, pokemon) {
  return new Promise((resolve, reject) => {
    let ballType;

    if (pokeBall > 0) {
      ballType = 1;
    } else if (greatBall > 0) {
      ballType = 2;
    } else if (ultraBall > 0) {
      ballType = 3;
    } else {
      return reject('몬스터볼이 존재하지 않습니다');
    }

    log.info('ballType: ', ballType);

    let normalizedReticleSize;
    log.info('포획정확도: ', accuracy);
    if (accuracy) {
      normalizedReticleSize = (1.95 + Math.random() * 0.05);
    } else {
      normalizedReticleSize = (1 + Math.random() * 0.95);
    }
    log.info('normalizedReticleSize: ', normalizedReticleSize);
    let spinModifier = (0.85 + Math.random() * 0.15);
    let normalizedHitPosition = 1.0;

    let waiting = 500 + Math.random() * 1000;
    setTimeout(() => {
      client.catchPokemon(
          pokemon.wild_pokemon.encounter_id, ballType, normalizedReticleSize,
          pokemon.wild_pokemon.spawn_point_id,
          true, spinModifier, normalizedHitPosition)
        .then(result => {
          //log.info('result: ', result);
          if (result.status == 1) {
            log.info('[' +
              pokedex[pokemon.wild_pokemon.pokemon_data.pokemon_id] +
              '] 포케몬을 잡았습니다');
          } else if (result.status == 3) {
            log.info('[' +
              pokedex[pokemon.wild_pokemon.pokemon_data.pokemon_id] +
              '] 포케몬을 놓쳤습니다');
          }

          if (ballType == 1) {
            pokeBall--;
          } else if (ballType == 2) {
            greatBall--;
          } else if (ballType == 3) {
            ultraBall--;
          }

          log.info('pokeBall: ', pokeBall);
          log.info('greatBall: ', greatBall);
          log.info('ultraBall: ', ultraBall);

          resolve(result.status);
        })
        .catch(e => {
          reject(e);
        });
    }, waiting);
  });
}

function setAccuracy(acc) {
  accuracy = acc;
}

module.exports = {
  catchAll: function(client, pokemons, items, acc) {
    let index = 0;
    items = items;
    setAccuracy(acc);
    log.info('포획정확도: ', acc);
    items.forEach(item => {
      if (item.item_id === 1) {
        pokeBall = item.count;
      } else if (item.item_id === 2) {
        greatBall = item.count;
      } else if (item.item_id === 3) {
        ultraBall = item.count;
      }
    });

    return new Promise((resolve, reject) => {
      function next() {
        if (index < pokemons.length) {
          let waiting = 3000 + Math.random() * 1000;
          setTimeout(function() {
            encounter(client, pokemons[index++]).then(next,
              e => {
                reject(e);
              });
          }, waiting);
        } else {
          setAccuracy(false);
          resolve();
        }
      }
      next();
    });
  },

  goAndCatch: function(client, mon, items, accuracy, id) {
    let that = this;
    return new Promise((resolve, reject) => {
      navigator.goto(client, {
          lat: mon.pokestop.latitude,
          lng: mon.pokestop.longitude
        }, false)
        .then(maps => {
          let catchablePokemons = pokemon.getCatchablePokemons(maps);
          return that.catchAll(client, catchablePokemons, items, accuracy);
        })
        .then(() => {
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    });
  }
}
