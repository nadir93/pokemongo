/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'pokemonBot',
  level: loglevel
});

const pogobuf = require('pogobuf');
const _ = require('lodash');
//const POGOProtos = require('node-pogo-protos');
const inventory = require('./inventory');
const player = require('./player');
const catcher = require('./catcher');
const pokemon = require('./pokemon');
const pokestop = require('./pokestop');
const navigator = require('./navigator');
const pokedex = require('../pokedex');

function pokemonBot(options) {
  let bot;
  if (!options.bot) {
    throw new Error('options.bot is required');
  }
  bot = options.bot;

  return {
    start: function() {
      return new Promise((resolve, reject) => {
        this.login(options.player)
          .then(client => {
            return this.updateInventory(client);          })
          .then((client) => {
            log.info('아이템이 정보가 업데이트되었습니다');
            return this.updatePlayer(client);
          })
          .then(client => {
            log.info('사용자 정보가 업데이트되었습니다');
            return this.checkPlayerLevel(
              client, options.player.id, inventory.getPlayer());
          })
          .then(client => {
            log.info('사용자 레벨을 체크하였습니다');
            return bot.start(client);
          })
          .then(() => {
            log.info('작업이 완료되었습니다');
            resolve();
          })
          .catch(e => {
            log.error(e);
            reject(e);
          });
      });
    },

    stop: function() {
      bot.stop();
    },

    login: function(playerInfo) {
      return player.login(playerInfo);
    },

    glimpsePokomon: function(maps) {
      pokemon.glimpsePokomon(maps);
    },

    watchPokemon: function(maps) {
      return pokemon.watchPokemon(maps);
    },

    getCatchablePokemons: function(maps) {
      return pokemon.getCatchablePokemons(maps);
    },

    getPokestops: function(maps) {
      return pokestop.getPokestops(maps);
    },

    spinPokestop: function(client, id, latitude, longitude) {
      return pokestop.spinPokestop(client, id, latitude, longitude);
    },

    catchAll: function(client, pokemons, accuracy) {
      return catcher.catchAll(
        client, pokemons, inventory.getItems(), accuracy);
    },

    goAndCatch: function(client, pokemons, accuracy, id) {
      // return catcher.goAndCatch(
      //   client, pokemons, inventory.getItems(), accuracy, id);
      let that = this;

      return new Promise((resolve, reject) => {
        catcher.goAndCatch(
            client, pokemons, inventory.getItems(), accuracy, id)
          .then(() => {
            return that.updateAll(client, id);
          })
          .then(() => {
            resolve();
          })
          .catch(e => {
            reject(e);
          });
      });
    },

    checkPlayerLevel: function(client, id) {
      //log.debug('player: ', inventory.getPlayer());
      return player.checkPlayerLevel(client, id, inventory.getPlayer());
    },

    goto: function(client, target, checkRarePokemon) {
      return navigator.goto(client, target, checkRarePokemon);
    },

    printLocation: function(lat, lng) {
      return navigator.printLocation(lat, lng);
    },

    updateInventory: function(client) {
      return inventory.update(client);
    },

    updatePlayer: function(client) {
      return player.update(client);
    },

    updateAll: function(client, id) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          inventory.update(client)
            .then(() => {
              log.info('아이템이 정보가 업데이트되었습니다');
              let playerWalked = inventory.getPlayer().km_walked;
              log.info('playerWalked(KM): ', playerWalked.toFixed(2));
              let getBuddyWalked = playerWalked -
                player.getPlayer().player_data.buddy_pokemon.last_km_awarded;
              log.info('buddyWalked(KM): ', getBuddyWalked.toFixed(2));
              return player.checkBuddy(client, getBuddyWalked);
            })
            .then(() => {
              return player.checkPlayerLevel(
                client, id, inventory.getPlayer());
            })
            .then(() => {
              log.info('사용자 레벨을 체크하였습니다');
              return client.checkAwardedBadges();
            })
            .then(res => {
              log.info('뱃지를 체크했습니다. response: ', res);
              log.info('잡은 총 포케몬수: ', inventory.getCatchedPokemonCount());
              let itemCount = _.sumBy(inventory.getItems(),
                function(o) {
                  return o.count;
                });
              log.info('총 아이템수: ' + itemCount);
              if (itemCount >= 350) {
                log.error('아이템이 가득찼습니다');
                reject('아이템이 가득찼습니다');
              } else {
                resolve();
              }
            })
            .catch(e => {
              reject(e);
            });
        }, 4000 + Math.random() * 2000); //5초후 업데이트 시작
      });
    },

    getInventoryPlayer: function() {
      return inventory.getPlayer();
    },

    getPlayer: function() {
      return player.getPlayer();
    }
  }
}

module.exports = pokemonBot;
