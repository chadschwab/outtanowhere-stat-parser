const { statTypeColumns } = require('./utils');

module.exports = htmlifyParsedData;

function format(data) {
  if (data && data.toLocaleDateString) {
    return data.toLocaleDateString();
  }
  return data;
}

function htmlifyParsedData(parsedData, statType) {
  return new Promise((resolve) => {
    const statArrays = statType === 'teamData' ? [parsedData] : Object.values(parsedData);
    const headers = statTypeColumns[statType];
    resolve(`
      <table>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        ${statArrays.map(rowStats => `<tr>${headers.map(h => `<td>${format(rowStats[h])}</td>`).join('')}</tr>`).join('\n')}
      </table>`
    );
  });
}
