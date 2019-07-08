const { writeFileSync } = require('fs');
const { stringifySkaterData, stringifyGoalieData, stringifyTeamData } = require('./stringify');

module.exports = write;

async function write(directory, skaterData, goalieData, teamData) {
  const stringifiedData = await Promise.all([stringifySkaterData(skaterData), stringifyGoalieData(goalieData), stringifyTeamData(teamData)]);
  ['skaterData', 'goalieData', 'teamData'].forEach((s, i) => writeFileSync(`${directory}/${s}.csv`, stringifiedData[i]));

  const stringifiedDataWithHeaders = await Promise.all([stringifySkaterData(skaterData, true), stringifyGoalieData(goalieData, true), stringifyTeamData(teamData, true)]);
  await writeFileSync(`${directory}/facebook-post.txt`, stringifiedDataWithHeaders.join("\n--\n"))
}

