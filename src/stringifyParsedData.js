const stringify = require('csv-stringify');
const { promiseCallback } = require('./utils');

module.exports = stringifyParsedData;

const statTypeColumns = {
  skaterData: ['player', 'session', 'type', 'date', 'gp', 'g', 'a', 'pts', 'pim', 'soa', 'sog'],
  goalieData: ['player', 'session', 'type', 'date', 'gp', 'w', 'l', 'sol', 'a', 'sv', 'shots', 'ga', 'so sa', 'so ga'],
  teamData: ['rank', 'session', 'type', 'opponent', 'date', 'time', 'win', 'loss', 'sol', 'sow', 'gf', 'ga']
}

const defaultOptions = (humanReadable) => ({
  delimiter: humanReadable ? '|' : ',',
  cast: {
    date: d => d.toLocaleDateString()
  }
});


function stringifyParsedData(parsedData, statType, humanReadable) {
  return new Promise((resolve, reject) => {
    stringify(
      statType === 'teamData' ? [parsedData] : Object.values(parsedData),
      {
        ...defaultOptions(humanReadable),
        columns: statTypeColumns[statType],
        header: humanReadable,
      },
      promiseCallback(resolve, reject))
  });
}


