const stringify = require('csv-stringify');

module.exports.stringifySkaterData = stringifySkaterData;
module.exports.stringifyGoalieData = stringifyGoalieData;
module.exports.stringifyTeamData = stringifyTeamData;

const defaultOptions = (humanReadable) => ({
  delimiter: humanReadable ? '|' : ',',
  cast: {
    date: d => d.toLocaleDateString()
  }
});

const promiseCallback = (resolve, reject) => (err, result) => err && reject(err) || resolve(result);

function stringifySkaterData(skaterData, humanReadable) {
  return new Promise((resolve, reject) => {
    stringify(
      Object.values(skaterData),
      {
        ...defaultOptions(humanReadable),
        columns: [
          'player', 'session', 'type', 'date', 'gp', 'g', 'a', 'pts', 'pim', 'soa', 'sog'
        ],
        header: humanReadable,
      },
      promiseCallback(resolve, reject))
  });
}

function stringifyGoalieData(goalieData, humanReadable) {
  return new Promise((resolve, reject) => {
    stringify(
      Object.values(goalieData),
      {
        ...defaultOptions(humanReadable),
        columns: [
          'player', 'session', 'type', 'date', 'gp', 'w', 'l', 'sol', 'a', 'sv', 'shots', 'ga', 'so sa', 'so ga'
        ],
        header: humanReadable
      },
      promiseCallback(resolve, reject))
  });
}

function stringifyTeamData(teamData, humanReadable) {
  return new Promise((resolve, reject) => {
    stringify(
      [teamData],
      {
        ...defaultOptions(humanReadable),
        columns: [
          'rank', 'session', 'type', 'opponent', 'date', 'time', 'win', 'loss', 'sol', 'sow', 'gf', 'ga',
        ],
        header: humanReadable
      },
      promiseCallback(resolve, reject))
  });
}


