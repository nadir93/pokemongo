/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'navigator',
  level: loglevel
});

const pogobuf = require('pogobuf');
const POGOProtos = require('node-pogo-protos');
const geocoder = require('geocoder');
const player = require('./player');
const pokemon = require('./pokemon');

const metersPerHour = 20 * 1000; // 5 killo meters / hour  default 5KM
const speed = metersPerHour / 60 / 60 / 1000;
let nextTimeForMapUpdate;
const minMapRefresh = 12000; // 15초 최소 지도 리프레시 시간 이하로 떨어지면 ban

module.exports = {

  goto: function(client, target, checkRarePokemon) {
    log.debug('레어 포케몬 체크모드: ', checkRarePokemon);
    let currentLocation = player.getLocation();
    log.debug('player.lat: ', currentLocation.lat);
    log.debug('player.lng: ', currentLocation.lng);
    log.debug('target.lat: ', target.lat);
    log.debug('target.lng: ', target.lng);
    let dest = this.getRandomLocation(target);
    log.debug('dest.lat: ', dest.lat);
    log.debug('dest.lng: ', dest.lng);
    let distance =
      this.getDistance(currentLocation.lat, currentLocation.lng,
        dest.lat, dest.lng);
    log.info('거리(meter): ', distance.toFixed(2));
    let totalTime = distance / speed;
    log.info('걸어가야 할 시간(초): ', (totalTime / 1000).toFixed(2));
    let startTime = Date.now();
    //log.debug('startTime: ', startTime);
    let endTime = startTime + totalTime;
    //log.debug('endTime: ', endTime);
    let arraval = false;
    //log.debug('complete: ', complete);
    let that = this;

    return new Promise((resolve, reject) => {
      function next() {
        setTimeout(() => {
          let time = Math.min(Date.now(), endTime) - startTime;
          //log.info('걸어간시간(초): ', (time / 1000).toFixed(2));
          let intermediate = Math.round((time / totalTime) * 1e2) / 1e2;
          //log.info('intermediate: ', intermediate);
          //log.info('목적지도착(%): ', (intermediate * 100).toFixed(2));
          let midPoint =
            that.getMidpoint(currentLocation.lat, currentLocation.lng,
              dest.lat, dest.lng, intermediate);

          if (midPoint.lat == dest.lat &&
            midPoint.lng == dest.lng) {
            arraval = true;
          }

          that.updateMap(client, midPoint.lat, midPoint.lng)
            .then(maps => {
              if (maps) {
                log.info('지도가 업데이트 되었습니다');

                player.setLocation({
                  lat: midPoint.lat,
                  lng: midPoint.lng
                });

                if (checkRarePokemon) {
                  //get rare pokemons
                  //send broadcast rare pokemons
                  let rarePokemons = pokemon.getRarePokemons(maps);

                  if (rarePokemons.catchableRarePokemons ||
                    rarePokemons.wildRarePokemons ||
                    rarePokemons.nearbyRarePokemons) {
                    return reject(rarePokemons);
                  }
                }

                if (arraval) {
                  log.info('목적지에 도착하였습니다');
                  that.printLocation(midPoint.lat, midPoint.lng);
                  return resolve(maps);
                }
              }
              next();
            })
            .catch(e => {
              log.error(e);
              reject(e);
            });
        }, 1000); // 4초에 한번씩 지도 업데이트 요청
      }
      next();
    });
  },

  printLocation: function(lat, lng) {
    geocoder.reverseGeocode(lat, lng, function(err, data) {
      if (err) {
        log.error('error: ', err);
        return;
      }
      log.debug('현재위치는: ', data.results[0].formatted_address);
    });
  },

  toRad: function(Value) {
    /** Converts numeric degrees to radians */
    return Value * Math.PI / 180;
  },

  getDistance: function(lat1, lng1, lat2, lng2) {
    let earthRadius = 6371000;
    let lat = this.toRad(lat2 - lat1);
    let lng = this.toRad(lng2 - lng1);
    let haversine = Math.sin(lat / 2) * Math.sin(lat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(lng / 2) * Math.sin(lng / 2);
    return earthRadius *
      (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
  },

  getMidpoint: function(lat1, long1, lat2, long2, per) {
    // per 0.2: 20%
    return {
      lat: Math.round((lat1 + (lat2 - lat1) * per) * 1e6) / 1e6,
      lng: Math.round((long1 + (long2 - long1) * per) * 1e6) / 1e6
    };
  },

  updateMap: function(client, lat, lng) {
    return new Promise((resolve, reject) => {
      if (!nextTimeForMapUpdate || Date.now() >= nextTimeForMapUpdate) {
        let updateTime = minMapRefresh + Math.random() * 5000; //12 ~17초
        log.info('updateTime(초): ', (updateTime / 1000).toFixed(2));
        nextTimeForMapUpdate = Date.now() + updateTime;
        client.setPosition(lat, lng);
        let cellIDs = pogobuf.Utils.getCellIDs(lat, lng);
        client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0))
          .then(maps => {
            resolve(maps);
          })
          .catch(e => {
            log.error(e);
            reject(e);
          });
      } else {
        //log.debug('지도를 업데이트할 타이밍이 아닙니다');
        resolve();
      }
    });
  },

  // 주어진 위치의 주변 35미터이내 임의의 위치를 반환
  getRandomLocation: function(target) {
    let r = 35 / 111300; // = 35 meters
    let y0 = target.lat;
    let x0 = target.lng;
    let u = Math.random();
    let v = Math.random();
    let w = r * Math.sqrt(u);
    let t = 2 * Math.PI * v;
    let x = w * Math.cos(t);
    let y1 = w * Math.sin(t);
    let x1 = x / Math.cos(y0);
    let lat = Math.round((y0 + y1) * 1e6) / 1e6;
    let lng = Math.round((x0 + x1) * 1e6) / 1e6;

    return {
      lat: lat,
      lng: lng
    };
  }
}
