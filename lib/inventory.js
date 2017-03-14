/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'inventory',
  level: loglevel
});

const pogobuf = require('pogobuf');

// Takes a getInventory() response and separates it into pokemon,
// items, candies, player data, eggs, quests, and pokedex.
let pokemon;
let items;
let candies;
let player;
let eggs;
let quests;
let pokedex;

module.exports = {
  update: function(client) {
    return new Promise((resolve, reject) => {
      log.debug('아이템 정보를 요청합니다');
      client.getInventory(0)
        .then(inventory => {
          pokemon = pogobuf.Utils.splitInventory(inventory).pokemon;
          //log.debug('pokemon: ', pokemon);
          items = pogobuf.Utils.splitInventory(inventory).items;
          //log.debug('items: ', items);
          candies = pogobuf.Utils.splitInventory(inventory).candies;
          //log.debug('candies: ', candies);
          player = pogobuf.Utils.splitInventory(inventory).player;
          //log.debug('player: ', player);
          eggs = pogobuf.Utils.splitInventory(inventory).eggs;
          //log.debug('eggs: ', eggs);
          quests = pogobuf.Utils.splitInventory(inventory).quests;
          //log.debug('quests: ', quests);
          pokedex = pogobuf.Utils.splitInventory(inventory).pokedex;
          //log.debug('pokedex: ', pokedex);
          resolve(client);
        })
        .catch(e => {
          log.error(e);
          reject(e);
        });
    });
  },
  getItems: function() {
    return items;
  },
  getPlayer: function() {
    return player;
  },
  getPokemon: function() {
    return pokemon;
  },
  getCatchedPokemonCount: function() {
    return pokemon.length;
  }

}
