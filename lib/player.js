/**
 * Author @nadir93
 * Date 2017.2.20
 */
'use strict';

const Logger = require('bunyan');
const loglevel = 'debug';
const log = new Logger.createLogger({
  name: 'player',
  level: loglevel
});

const pogobuf = require('pogobuf');
const config = require('../config');
const fs = require('fs');

let player;
let lat;
let lng;
const buddyRewardDistance = 5; // 피카추: 1KM

module.exports = {
  login: function(player) {
    return new Promise((resolve, reject) => {
      log.info('id: ', player.id);

      //let login = new pogobuf.GoogleLogin();
      let login = new pogobuf.PTCLogin();
      let client = new pogobuf.Client();

      client.on('request', requestData => {
        //log.debug('requestData: ', requestData);
        //log.debug('requestData.data: ', requestData.requests[0].data);
      });

      client.on('response', responseData => {
        //log.debug('responseData: ', responseData);
        //log.debug('responseData.data: ', responseData.responses[0].data);
      });

      login.login(player.id, player.password)
        .then(token => {
          log.info('토큰이 발급되었습니다');
          //log.debug('token: ', token);
          //client.setAuthInfo('google', token);
          client.setAuthInfo('ptc', token);
          lat = player.lat;
          lng = player.lng;
          client.setPosition(player.lat, player.lng);
          return client.init();
        })
        .then(() => {
          log.info('로그인 되었습니다');
          resolve(client);
        })
        .catch(e => {
          log.error(e);
          reject(e);
        });
    });
  },

  getLocation: function() {
    return {
      lat: lat,
      lng: lng
    };
  },

  setLocation: function(location) {
    lat = location.lat;
    lng = location.lng;
  },

  update: function(client) {
    return new Promise((resolve, reject) => {
      log.debug('사용자 정보를 요청합니다');
      client.getPlayer()
        .then(response => {
          //log.debug('player: ', response);
          player = response;
          resolve(client);
        })
        .catch(e => {
          log.error(e);
          reject(e);
        });
    });
  },

  getPlayer: function() {
    return player;
  },

  checkPlayerLevel: function(client, id, player) {
    return new Promise((resolve, reject) => {
      let local = config[id].level;
      let server = player.level;
      log.debug('playerLevel(local): ', local);
      log.debug('playerLevel(server): ', server);
      if (local < server) {
        log.debug('levelUpRewards를 요청합니다');
        client.levelUpRewards(server)
          .then(response => {
            log.debug('response.result: ', response.result);
            if (response.result == 1 || response.result == 2) {
              // 1: ok, 2: already done
              config[id].level = server;
              fs.writeFile('./config.json', JSON.stringify(config), err => {
                if (err) {
                  return reject(err);
                }
                resolve(client);
              });
            } else {
              reject(response.result);
            }
          })
          .catch(e => {
            log.error(e);
            reject(e);
          });
      } else {
        log.debug('이미 최신 레벨입니다');
        resolve(client);
      }
    });
  },

  checkBuddy: function(client, getBuddyWalked) {
    let that = this;
    return new Promise((resolve, reject) => {
      log.info('buddyRewardDistance(KM): ', buddyRewardDistance);
      if (getBuddyWalked >= buddyRewardDistance) {
        log.info('버디사탕을 요청합니다');
        client.getBuddyWalked()
          .then(result => {
            //{ success: true, family_candy_id: 25, candy_earned_count: 1 }
            log.info('getBuddyWalked: ', result);
            return that.update(client);
          })
          .then(() => {
            log.info('사용자 정보가 업데이트되었습니다');
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
}
