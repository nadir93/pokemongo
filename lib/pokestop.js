/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'pokestop',
  level: loglevel
});

const pogobuf = require('pogobuf');
const POGOProtos = require('node-pogo-protos');
const pokedex = require('../pokedex');
const _ = require('lodash');

module.exports = {
  getPokestops: function(maps) {
    let cells = maps.map_cells.filter(cell => {
      return cell.forts.length > 0;
    });

    let forts = [];
    cells.forEach(cell => {
      cell.forts.forEach(fort => {
        forts.push(fort);
      });
    });

    return forts;
  },

  spinPokestop: function(client, id, latitude, longitude) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        client.fortSearch(id, latitude, longitude)
          .then(res => {
            log.info('포케스탑 스핀 결과: ', res);
            resolve(res);
          })
          .catch(e => {
            reject(e);
          });
      }, 3000 + Math.random() * 2000); // 3 ~5 초뒤
    });
  }
}
