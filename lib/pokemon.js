/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'pokemon',
  level: loglevel
});

const pogobuf = require('pogobuf');
const POGOProtos = require('node-pogo-protos');
const pokedex = require('../pokedex');
const pokestop = require('./pokestop');
const _ = require('lodash');
const rarePokemons = [6, 9, 25, 26, 38, 87, 130, 131, 143,
  147, 148, 149, 172, 181, 196, 197, 242, 246, 247, 248, 133 /*이브이*/ , 127 /*쁘사이져*/
];

module.exports = {

  glimpsePokomon: function(maps) {

    let catchablePokemons = _.sumBy(maps.map_cells, function(o) {
      return o.catchable_pokemons.length;
    });
    log.debug('근접 포케몬 수(~50M): ' + catchablePokemons);

    let wildPokemons = _.sumBy(maps.map_cells, function(o) {
      return o.wild_pokemons.length;
    });
    log.debug('근거리 포케몬 수(~70M): ' + wildPokemons);

    let nearbyPokemons = _.sumBy(maps.map_cells, function(o) {
      return o.nearby_pokemons.length;
    });
    log.debug('원거리 포케몬 수: ' + nearbyPokemons);
  },

  getCatchablePokemons: function(maps) {
    let cells = maps.map_cells.filter(cell => {
      return cell.catchable_pokemons.length > 0;
    });

    let pokemons = [];
    cells.forEach(cell => {
      cell.catchable_pokemons.forEach(pokemon => {
        pokemon['포케몬'] = pokedex[pokemon.pokemon_id];
        pokemons.push(pokemon);
      });
    });
    return pokemons;
  },

  watchPokemon: function(maps) {
    let cells = maps.map_cells.filter(cell => {
      return cell.catchable_pokemons.length > 0;
    });

    let catchablePokemons = [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.catchable_pokemons.forEach(pokemon => {
          pokemon['포케몬'] = pokedex[pokemon.pokemon_id];
          catchablePokemons.push(pokemon);
        });
      });
      log.debug('근접 포케몬(들): ', _.map(catchablePokemons, '포케몬').join());
    }

    cells = maps.map_cells.filter(cell => {
      return cell.wild_pokemons.length > 0;
    });

    let wildPokemons = [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.wild_pokemons.forEach(pokemon => {
          wildPokemons.push(pokedex[pokemon.pokemon_data.pokemon_id]);
        });
      });
      log.debug('근거리 포케몬(들): ', wildPokemons.join());
    }

    cells = maps.map_cells.filter(cell => {
      return cell.nearby_pokemons.length > 0;
    });

    let nearbyPokemons = [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.nearby_pokemons.forEach(pokemon => {
          nearbyPokemons.push(pokedex[pokemon.pokemon_id]);
        });
      });
      log.debug('원거리 포케몬(들): ', nearbyPokemons.join());
    }
  },

  getRarePokemons: function(maps) {
    let cells = maps.map_cells.filter(cell => {
      return cell.catchable_pokemons.length > 0;
    });

    let catchableRarePokemons = [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.catchable_pokemons.forEach(pokemon => {
          if (_.includes(rarePokemons, pokemon.pokemon_id)) {
            pokemon['포케몬'] = pokedex[pokemon.pokemon_id];
            catchableRarePokemons.push(pokemon);
          }
        });
      });

      if (catchableRarePokemons.length > 0) {
        log.debug('근접 레어 포케몬(들): ',
          _.map(catchableRarePokemons, '포케몬').join());
      }
    }

    cells = maps.map_cells.filter(cell => {
      return cell.wild_pokemons.length > 0;
    });

    let wildRarePokemons = [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.wild_pokemons.forEach(pokemon => {
          if (_.includes(rarePokemons, pokemon.pokemon_id)) {
            pokemon['포케몬'] = pokedex[pokemon.pokemon_id];
            wildRarePokemons.push(pokemon);
          }
        });
      });

      if (wildRarePokemons.length > 0) {
        log.debug('근거리 레어 포케몬(들): ',
          _.map(wildRarePokemons, '포케몬').join());
      }
    }

    cells = maps.map_cells.filter(cell => {
      return cell.nearby_pokemons.length > 0;
    });

    let nearbyRarePokemons = [];
    if (cells.length > 0) {
      let forts = pokestop.getPokestops(maps);
      cells.forEach(cell => {
        cell.nearby_pokemons.forEach(pokemon => {
          if (_.includes(rarePokemons, pokemon.pokemon_id)) {
            let foundFort = _.find(forts, {
              'id': pokemon.fort_id
            });

            pokemon['포케몬'] = pokedex[pokemon.pokemon_id];
            if (foundFort) {
              pokemon['pokestop'] = foundFort;
              nearbyRarePokemons.push(pokemon);
            } else {
              log.debug('포케스탑이 없는 포케몬: ', pokemon)
            }
          }
        });
      });

      if (nearbyRarePokemons.length > 0) {
        log.debug('원거리 레어 포케몬(들): ',
          _.map(nearbyRarePokemons, '포케몬').join());
      }

    }

    let result = {};

    if (catchableRarePokemons.length > 0) {
      result.catchableRarePokemons = catchableRarePokemons;
    }

    if (wildRarePokemons.length > 0) {
      result.wildRarePokemons = wildRarePokemons;
    }

    if (nearbyRarePokemons.length > 0) {
      result.nearbyRarePokemons = nearbyRarePokemons;
    }
    return result;
  }
}
