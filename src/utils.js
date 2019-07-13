module.exports.promiseCallback = (resolve, reject) => (err, result) => err && reject(err) || resolve(result);

module.exports.toDatePartitionString = date => `${date.getFullYear()}-${(date.getMonth() + 1)}-${date.getDate()}_${date.getTime()}`;

module.exports.parseDateFromPartitionString = file => new Date(file.match(/20[0-9][0-9]-[0-1]?[0-9]-[0-3]?[0-9]_([0-9]+)/)[1]);
