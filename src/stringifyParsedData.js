const stringify = require('csv-stringify');
const { promiseCallback, statTypeColumns } = require('./utils');

module.exports = stringifyParsedData;

const defaultOptions = {
  delimiter: ',',
  cast: {
    date: d => d.toLocaleDateString()
  }
};


function stringifyParsedData(parsedData, statType, humanReadable) {
  return new Promise((resolve, reject) => {
    const statArrays = statType === 'teamData' ? [parsedData] : Object.values(parsedData);

    stringify(
      statArrays,
      {
        ...defaultOptions,
        columns: statTypeColumns[statType],
        header: humanReadable,
      },
      promiseCallback(resolve, reject));
  });
}


