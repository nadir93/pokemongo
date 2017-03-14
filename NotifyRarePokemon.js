const request = require('request');
const loglevel = 'error';
const Logger = require('bunyan');
const log = new Logger.createLogger({
  name: 'NotifyRarePokemon',
  level: loglevel,
});
const schedule = require('node-schedule');
const POGOProtos = require('node-pogo-protos');
const pogobuf = require('pogobuf');
const pokedex = require('./pokedex');
const geocoder = require('geocoder');
const _ = require('lodash');
const moment = require('moment');
const moveSet = require('./moveSet');

var WebClient = require('@slack/client').WebClient;
var token = process.env.HUBOT_SLACK_TOKEN;
log.debug('token: ', token);
var web = new WebClient(token);

var sendChannel = process.env.SEND_CHANNEL;
log.debug('sendChannel: ', sendChannel);

var pushed = [];

/**
 * 주기적으로 레어포케몬 체크
 */
schedule.scheduleJob('*/1 * * * *', () => {
  request({
      headers: {
        'Referer': 'https://seoulpokemap.com/',
        'If-None-Match': 'W/"1371-ZmSsEfS85jPWxOUe2KJ2Gg"',
        'Accept': '*/*',
        'Cache-Control': 'max-age=0',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/602.4.8 (KHTML, like Gecko) Version/10.0.3 Safari/602.4.8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      uri: 'https://seoulpokemap.com/query2.php?since=0&mons=3,6,9,59,130,131,143,149,154,157,160,181,201,232,237,242,247,248'
    },
    function(err, response, body) {
      if (err) {
        log.error('웹 스크래핑 중 에러발생', err);
        return; //reject(err);
      }
      log.debug('response.statusCode: ', response.statusCode);
      var pokemonsData = JSON.parse(body);
      log.debug('pokemonsData: ', pokemonsData);

      log.debug('pokemons.length: ', pokemonsData.pokemons.length);

      for (var i = 0; i < pokemonsData.pokemons.length; i++) {
        let result = getIVsFromPokemon(pokemonsData.pokemons[i], 2);
        let pokemonName = pokedex[Number(pokemonsData.pokemons[i].pokemon_id)];
        log.debug('포케몬: ', pokemonName);
        log.debug('iv: ', result.percent);

        if (result.percent >= 90) {

          let newPokemon = _.find(pushed, function(o) {
            log.debug('o: ', o);
            return o.pokemon_id == pokemonsData.pokemons[i].pokemon_id &&
              o.lat == pokemonsData.pokemons[i].lat &&
              o.lng == pokemonsData.pokemons[i].lng &&
              o.despawn == pokemonsData.pokemons[i].despawn;
          });
          log.debug('newPokemon: ', newPokemon);

          if (!newPokemon) {
            let pokemon = pokemonsData.pokemons[i];
            // Reverse Geocoding
            geocoder.reverseGeocode(pokemon.lat, pokemon.lng, function(err, data) {
              if (err) {
                log.error('error: ', err);
                return; //reject(err);
              }
              log.debug('data: ', data);
              log.debug('메시지를 전송합니다');
              sendMessage(sendChannel, null, {
                'attachments': [{
                  'fallback': pokemonName + ' 포케몬이 나타났습니다 \n위치:' +
                    data.results[0].formatted_address + '\niv값: ' + result.percent +
                    '%',
                  'color': '#36a64f',
                  'pretext': '`' + pokemonName + '` 포케몬이 나타났습니다',
                  //  'title': 'Slack API Documentation',
                  //  'text': 'Optional text that appears within the attachment',
                  'fields': [{
                    'title': '위치',
                    'value': data.results[0].formatted_address,
                    'short': false
                  }, {
                    'title': '공격',
                    'value': pokemon.attack,
                    'short': true
                  }, {
                    'title': '방어',
                    'value': pokemon.defence,
                    'short': true
                  }, {
                    'title': '체력',
                    'value': pokemon.stamina,
                    'short': true
                  }, {
                    'title': 'iv',
                    'value': result.percent + '%',
                    'short': true
                  }, {
                    'title': '일반스킬',
                    'value': moveSet[pokemon.move1],
                    'short': true
                  }, {
                    'title': '충전스킬',
                    'value': moveSet[pokemon.move2],
                    'short': true
                  }, {
                    'title': '종료시간',
                    'value': moment.unix(Number(pokemon.despawn)).format('LT'),
                    'short': false
                  }],
                  'image_url': 'https://assets-4.seoulpokemap.com/images/poke/' +
                    pokemon.pokemon_id + '.png?ver38',
                  'mrkdwn_in': ['text', 'pretext']
                }],
                unfurl_links: true,
                as_user: false,
                icon_url: 'https://lh3.googleusercontent.com/wPfLmWBJwsPdBhsFXc8X4QZOOvePWjoOBLFXXCwyegjRwYOuabmG5cynthlW0HDgy9s=w115',
                username: '포케몬봇',
              }, (err, res) => {
                if (err) {
                  log.error('web.chat.postMessage', err);
                  return;
                }
                log.debug(res);
                log.debug('pokemon: ', pokemon);
                pushed.push(pokemon);
              });
            });
          } else {
            log.debug(newPokemon + '이미 전송되었습니다');
          }
        }
      }
    });
});

/**
 * sendMessage
 * @param  {[type]} channel [description]
 * @param  {[type]} msg     [description]
 * @param  {[type]} data    [description]
 * @return {[type]}         [description]
 */
function sendMessage(channel, msg, data, callback) {
  web.chat.postMessage(channel, msg, data, callback);
}

/**
 * Utility method to get the Individual Values from Pokémon
 * @param {object} pokemon - A pokemon_data structure
 * @param {integer} [decimals=-1] - Amount of decimals, negative values do not round, max 20
 * @returns {object}
 * @static
 */
function getIVsFromPokemon(pokemon, decimals) {
  if (typeof decimals === 'undefined') decimals = -1;

  decimals = Math.min(decimals, 20);

  var att = Number(pokemon.attack),
    def = Number(pokemon.defence),
    stam = Number(pokemon.stamina);

  var unroundedPercentage = (att + def + stam) / 45 * 100;
  var percent = decimals < 0 ? unroundedPercentage : +unroundedPercentage.toFixed(decimals);

  return {
    att: att,
    def: def,
    stam: stam,
    percent: percent
  };
}
