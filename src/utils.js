module.exports.promiseCallback = (resolve, reject) => (err, result) => err && reject(err) || resolve(result);

module.exports.toDatePartitionString = date => `${date.getFullYear()}-${(date.getMonth() + 1)}-${date.getDate()}_${date.getTime()}`;

module.exports.parseDateFromPartitionString = file => new Date(file.match(/20[0-9][0-9]-[0-1]?[0-9]-[0-3]?[0-9]_([0-9]+)/)[1]);

module.exports.statTypes = ['skaterData', 'goalieData', 'teamData'];

module.exports.statTypeColumns = {
  skaterData: ['player', 'session', 'type', 'date', 'gp', 'g', 'a', 'pts', 'pim', 'soa', 'sog'],
  goalieData: ['player', 'session', 'type', 'date', 'gp', 'w', 'l', 'sol', 'a', 'sv', 'shots', 'ga', 'so sa', 'so ga'],
  teamData: ['rank', 'session', 'type', 'opponent', 'date', 'time', 'win', 'loss', 'sol', 'sow', 'gf', 'ga']
};
