const readline = require('readline');
const skaters = require('../team-data/skaters.json');
const goalies = require('../team-data/goalies.json');

module.exports = parseFacebookPost;


async function parseFacebookPost(readStream, type, session, rank) {
  let skaterData = []; // Player	Session	Type	Date	GP	G	A	PTS	PIM	SOA	SOG
  let goalieData = []; // Player	Session	Type	Date	GP	W	L	SOL	A	SV	Shots	GA	SO SA	SO GA
  let teamData = {
    rank,
    session,
    type
  }; // rank	Session	Type	Opponent	Date	Time	Win	Lost	SOL	SOW	GF	GA
  var lineReader = readline.createInterface({
    input: readStream
  });

  for await (const line of lineReader) {
    if (!teamData.date) {
      console.debug(`Attempting to parse date from: ${line}`);
      const date = parseDateFromLine(line);
      if (date) {
        teamData = { ...teamData, date };
        console.info(`Parsed date: ${date}`);
      }
    } else if (!teamData.opponent) {
      console.debug(`Attempting to parse score from: ${line}`);
      const parsedTeamData = await parseTeamDataFromLine(line);
      if (parsedTeamData) {
        teamData = {
          ...teamData,
          ...parsedTeamData
        };
        console.info(`Parsed team data: ${JSON.stringify(parsedTeamData)}`);
      }
    } else {
      const mentionedPeople = parsePlayerMentionsFromLine(line);
      for await (const { name, type, startIndex, endIndex } of mentionedPeople) {
        const relevantSubstring = line.substring(startIndex, endIndex);
        console.debug(`${type} ${name} Found, attempting parse from: "${relevantSubstring}" ${relevantSubstring !== line ? `[Full line: ${line}]` : ''}`);
        const playerMap = type === 'skater' ? skaterData : goalieData;
        const player = type === 'skater' ? skaters[name] : goalies[name];
        const parseFunction = type === 'skater' ? parseSkaterDataFromLine : parseGoalieDataFromLine;
        let parsedPlayerData = parseFunction(relevantSubstring, teamData);
        if (parsedPlayerData) {
          if (playerMap[player]) {
            parsedPlayerData = await handleConflict(player, playerMap[player], parsedPlayerData);
          }
          playerMap[player] = {
            ...parsedPlayerData,
            gp: 1,
            player,
            session: teamData.session,
            type: teamData.type,
            date: teamData.date
          };
          console.info(`Set data for ${type} ${player}: ${JSON.stringify(playerMap[player])}`);
        } else console.debug(`No data found`);
      }
    }
  }
  lineReader.close();
  if (!teamData.date) {
    throw new Error("Date not found.");
  }
  if (!teamData.opponent) {
    throw new Error("Team data not found");
  }
  return { skaterData, goalieData, teamData };
}

function parseDateFromLine(line) {
  const dateMatch = line.match(/^\s*([a-z]+\s[0-3]?[0-9])/i);
  if (dateMatch) {
    const date = new Date(`${dateMatch[1]} ${new Date().getFullYear()}`);
    return date;
  }
  const hourMatch = line.match(/^\s*(1?[0-9]) hrs\s*$/i);
  if (hourMatch) {
    return new Date(new Date().getTime() - (parseInt(hourMatch[1]) * 3600000));
  }
  const minuteMatch = line.match(/^\s*([1-9]?[0-9]) mins\s*$/i);
  if (minuteMatch) {
    return new Date(new Date().getTime() - (parseInt(minuteMatch[1]) * 60000));
  }
  const yesterdayMatch = line.match(/^Yesterday at/i);
  if (yesterdayMatch) {
    return new Date(new Date().getTime() - 86400000);
  }
  return null;
}

async function parseTeamDataFromLine(line) {
  const scoreMatch = line.match(/([0-9]+)\s*-\s*([0-9]+)/);
  let winMatch = line.match(/win|\sW\s/i);
  let lossMatch = line.match(/loss|lost|\sL\s/i);
  const sowMatch = line.match(/shoot out win|sow/i);
  const solMatch = line.match(/shoot out loss|sol/i);
  const opponentMatch = line.match(/(v\.?s\.?|verse|versus|to)\s?(.*) (at|@)/i) || line.match(/(v\.?s\.?|to|verse|versus)\s?(.*)\s*/i);
  const timeMatch = line.match(/(at|@)?\s?([0-1]?[0-9]):?([0-9]{2})\s?(A\.?M|P\.?M)?/i);
  const onTheHourTimeMatch = line.match(/(at|@)?\s?([0-1]?[0-9]):?(A\.?M|P\.?M)/i);
  if (scoreMatch) {
    let gf, ga;
    let [, parsedGF, parsedGA] = scoreMatch;
    parsedGF = parseInt(parsedGF);
    parsedGA = parseInt(parsedGA);
    if (winMatch || sowMatch) {
      gf = Math.max(parsedGF, parsedGA);
      ga = Math.min(parsedGF, parsedGA);
    } else if (lossMatch || solMatch) {
      gf = Math.min(parsedGF, parsedGA);
      ga = Math.max(parsedGF, parsedGA);
    } else {
      gf = parsedGF;
      ga = parsedGA;
      winMatch = gf > ga;
      lossMatch = gf < ga;
    }
    var time;
    if (timeMatch) {
      time = timeMatch[2] + ':' + timeMatch[3] + (timeMatch[4] || await askForInput("AM/PM:"));
    }
    else if (onTheHourTimeMatch) {
      time = onTheHourTimeMatch[2] + ':00' + onTheHourTimeMatch[3];
    }
    else {
      time = await askForInput('Time: ');
    }
    return {
      opponent: opponentMatch ? opponentMatch[2] : await askForInput("Opponent: "),
      time,
      win: winMatch && !sowMatch ? 1 : 0,
      loss: lossMatch && !solMatch ? 1 : 0,
      sow: sowMatch ? 1 : 0,
      sol: solMatch ? 1 : 0,
      gf,
      ga
    };
  }
  return null;
}

function parsePlayerMentionsFromLine(line) {
  const mentions = [
    ...Object.keys(skaters).map(s => ({ name: s, type: 'skater' })),
    ...Object.keys(goalies).map(g => ({ name: g, type: 'goalie' }))
  ]
    .filter(p => line.includes(p.name))
    .map(p => ({ ...p, startIndex: line.indexOf(p.name) }))
    .sort((a, b) => a.startIndex - b.startIndex);

  mentions.forEach((m, i) => {
    if (i === mentions.length - 1) {
      m.endIndex = line.length;
    } else {
      m.endIndex = mentions[i + 1].startIndex;
    }
  });
  return mentions.filter(m => m.startIndex !== m.endIndex);
}

function parseGoalieDataFromLine(line, teamData) {
  let parsedGoalieData;
  const shotsMatch = line.match(/([0-9]+)[^0-9]*shot/i);
  const shotsOfTotalMatch = line.match(/([0-9]+) of ([0-9]+)/i);
  if (shotsMatch) {
    const goalMatch = line.match(/([0-9]+)[^0-9]*goal/i); //dude likes to be dramatic with his adjectives "1 horrendous goal"
    parsedGoalieData = { //Player	Session	Type	Date	GP	W	L	SOL	A	SV	Shots	GA	SO SA	SO GA
      shots: parseInt(shotsMatch[1]),
      ga: goalMatch ? parseInt(goalMatch[1]) : teamData.ga
    };
    parsedGoalieData.sv = parsedGoalieData.shots - parsedGoalieData.ga;
  } else if (shotsOfTotalMatch) {
    const [, sv, shots] = shotsOfTotalMatch;
    parsedGoalieData = {
      sv: parseInt(sv),
      shots: parseInt(shots)
    };
    parsedGoalieData.ga = parsedGoalieData.shots - parsedGoalieData.sv;
  } else {
    return null;
  }
  const assistMatch = line.match(/([0-9]+)\s?a/i) || line.match(/([0-9]+) assist/i);
  const shootOutShotsAgainsts = line.match(/([0-9]+)\s?s\.?o\.?s\.?a/i) || line.match(/([0-9]+) shoot out shot/i);
  const shootOutGoalsAgainst = line.match(/([0-9]+)\s?s\.?o\.?g\.?a/i) || line.match(/([0-9]+) shoot out goal/i);

  return { //W	L	SOL	A	SV	Shots	GA	SO SA	SO GA
    ...parsedGoalieData,
    w: teamData.win,
    l: teamData.loss,
    sol: teamData.sol,
    sow: teamData.sow,
    a: assistMatch ? parseInt(assistMatch[1]) : 0,
    'so sa': shootOutShotsAgainsts,
    'so ga': shootOutGoalsAgainst
  };
}

function parseSkaterDataFromLine(line) {
  const assistMatch = line.match(/([0-9]+)a/i) || line.match(/([0-9]+) assist/i);
  const secondaryAssistMatch = line.match(/([0-9]+) secondary/i);
  const goalMatch = line.match(/([0-9]+)g/i) || line.match(/([0-9]+) goal/i);
  const pimMatch = line.match(/([0-9]+)\s?p\.?i\.?m/i) || line.match(/([0-9]+) penalty/i);
  const sogMatch = line.match(/([0-9]+)\s?s\.?o\.?g/i) || line.match(/([0-9]+) shoot out goal/i);
  const soaMatch = line.match(/([0-9]+)\s?s\.?o\.?a/i) || line.match(/([0-9]+) shoot out attempt/i);
  if (!goalMatch &&
    !assistMatch &&
    !secondaryAssistMatch &&
    !pimMatch &&
    !sogMatch &&
    !soaMatch
  ) return null;

  const skaterData = {
    g: goalMatch ? parseInt(goalMatch[1]) : 0,
    a: (assistMatch ? parseInt(assistMatch[1]) : 0) + (secondaryAssistMatch ? parseInt(secondaryAssistMatch[1]) : 0),
    pim: pimMatch ? parseInt(pimMatch[1]) : 0,
    sog: sogMatch ? parseInt(sogMatch[1]) : 0,
    soa: soaMatch ? parseInt(soaMatch[1]) : 0
  };
  return {
    ...skaterData,
    pts: skaterData.g + skaterData.a + skaterData.sog
  };
}

async function askForInput(message) {
  var inputReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return await new Promise(resolve => {
    inputReader.question(message, (result) => {
      inputReader.close();
      resolve(result);
    });
  });
}


async function handleConflict(player, currentValue, newValue) {
  let action = '';
  do {
    let message = action === '' ? `Found more than one entry for ${player}. Current value: ${JSON.stringify(currentValue)}. New Value ${JSON.stringify(newValue)}\n1 - Take First\n2 - Take Second\n3 - Combine\n` : 'Type 1, 2, or 3\n';
    action = await askForInput(message);
    action = action.substr(0, 1);
  }
  while (!['1', '2', '3'].includes(action));

  if (action === '1') {
    return currentValue;
  } else if (action === '2') {
    return newValue;
  } else if (action === '3') {
    return Object.keys(currentValue).reduce((agg, k) => ({ ...agg, [k]: (typeof currentValue[k] === 'number') ? currentValue[k] + newValue[k] : currentValue[k] }), {});
  }
}
