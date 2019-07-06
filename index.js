#!/usr/bin/env node

const program = require('commander')
const readline = require('readline')
const { createReadStream } = require('fs')
const skaters = require('./skaters.json')
const goalies = require('./goalies.json')

program
  .command('parse <file>')
  .version('0.1.0')
  .option('-d, --debug', 'Output debug level')
  .option('-o, --output [output]', 'The output file. If not given outputs to standard out.')
  .option('--game-type [gameType]', 'Type of session [Regular|Playoff]', 'Regular')
  .option('--session [session]', 'The description of the session', 'Spring 2019')
  .option('--session-rank [rank]', 'The description of the session', '6')
  .action(async function (file, { debug, output, gameType: type, session, rank }) {
    let skaterData = [] // Player	Session	Type	Date	GP	G	A	PTS	PIM	SOA	SOG
    let goalieData = [] // Player	Session	Type	Date	GP	W	L	SOL	A	SV	Shots	GA	SO SA	SO GA
    let teamData = {
      rank,
      session,
      type
    } // rank	Session	Type	Opponent	Date	Time	Win	Lost	SOL	SOW	GF	GA

    var lineReader = readline.createInterface({
      input: createReadStream(file)
    })
    if (!debug) {
      console.debug = () => { }
    }

    for await (const line of lineReader) {
      if (!teamData.date) {
        console.debug(`Attempting to parse date from: ${line}`)
        const date = parseDateFromLine(line)
        if (date) {
          teamData = { ...teamData, date }
          console.info(`Parsed date: ${date}`)
        }
      } else if (!teamData.opponent) {
        console.debug(`Attempting to parse score from: ${line}`)
        const parsedTeamData = parseTeamDataFromLine(line)
        if (parsedTeamData) {
          teamData = {
            ...teamData,
            ...parsedTeamData
          }
          console.info(`Parsed team data: ${JSON.stringify(parsedTeamData)}`)
        }
      } else {
        const mentionedPeople = parsePlayerMentionsFromLine(line)
        for await (const { name, type, startIndex, endIndex } of mentionedPeople) {
          const relevantSubstring = line.substring(startIndex, endIndex)
          console.debug(`${type} ${name} Found, attempting parse from: "${relevantSubstring}" ${relevantSubstring !== line ? `[Full line: ${line}]` : ''}`)
          const playerMap = type === 'skater' ? skaterData : goalieData;
          const player = type === 'skater' ? skaters[name] : goalies[name];
          const parseFunction = type === 'skater' ? parseSkaterDataFromLine : parseGoalieDataFromLine;
          let parsedPlayerData = parseFunction(relevantSubstring)
          if (parsedPlayerData) {
            if (playerMap[player]) {
              parsedPlayerData = await handleConflict(player, playerMap[player], parsedPlayerData)
            }
            playerMap[player] = {
              ...parsedPlayerData,
              player,
              session: teamData.session,
              type: teamData.type,
              date: teamData.date
            }
            console.info(`Set data for ${player}: ${JSON.stringify(playerMap[player])}`)
          } else console.debug(`No data found`)
        }
      }
    }
    lineReader.close()
  })
program.parse(process.argv)

function parseDateFromLine(line) {
  const dateMatch = line.match(/^\s*([a-z]+\s[0-9]{2})/i)
  if (dateMatch) {
    const date = new Date(`${dateMatch[1]} ${new Date().getFullYear()}`)
    return date
  }
  return null
}

function parseTeamDataFromLine(line) {
  const scoreMatch = line.match(/^\s*([0-9]+)\s*-\s*([0-9]+)\s*(win).*vs\s*(.*)$/i)
  if (scoreMatch) {
    let [, gf, ga, outcome, opponent] = scoreMatch
    return {
      opponent,
      win: outcome.match(/win/i) ? 1 : 0,
      loss: outcome.match(/loss/i) ? 1 : 0,
      gf,
      ga
    }
  }
  return null
}

function parseGoalieDataFromLine(line) {
  console.warn('Not implemented')
  return null
}

function parsePlayerMentionsFromLine(line) {
  const mentions = [
    ...Object.keys(skaters).map(s => ({ name: s, type: 'skater' })),
    ...Object.keys(goalies).map(g => ({ name: g, type: 'goalie' }))
  ]
    .filter(p => line.includes(p.name))
    .map(p => ({ ...p, startIndex: line.indexOf(p.name) }))
    .sort((a, b) => a.startIndex - b.startIndex)

  mentions.forEach((m, i) => {
    if (i === mentions.length - 1) {
      m.endIndex = line.length
    } else {
      m.endIndex = mentions[i + 1].startIndex
    }
  })
  return mentions.filter(m => m.startIndex !== m.endIndex)
}

function parseSkaterDataFromLine(line) {
  const assistMatch = line.match(/([0-9])a/i)
  const secondaryAssistMatch = line.match(/([0-9]) secondary/i)
  const goalMatch = line.match(/([0-9])g/i)
  const pimMatch = line.match(/([0-9])p\.?i\.?m/i) || line.match(/([0-9]) penalty/i)
  const sogMatch = line.match(/([0-9])\s?s\.?o\.?g/i) || line.match(/([0-9]) shoot out goal/i)
  const soaMatch = line.match(/([0-9])\s?s\.?o\.?a/i) || line.match(/([0-9]) shoot out attempt/i)
  if (!goalMatch &&
    !assistMatch &&
    !secondaryAssistMatch &&
    !pimMatch &&
    !sogMatch &&
    !soaMatch
  ) return null

  const skaterData = {
    gp: 1,
    g: goalMatch ? parseInt(goalMatch[1]) : 0,
    a: (assistMatch ? parseInt(assistMatch[1]) : 0) + (secondaryAssistMatch ? parseInt(secondaryAssistMatch[1]) : 0),
    pim: pimMatch ? parseInt(pimMatch[1]) : 0,
    sog: sogMatch ? parseInt(sogMatch[1]) : 0,
    soa: soaMatch ? parseInt(soaMatch[1]) : 0
  }
  return {
    ...skaterData,
    pts: skaterData.g + skaterData.a + skaterData.sog
  }
}

async function handleConflict(player, currentValue, newValue) {
  var inputReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  let action = ''
  do {
    let message = action === '' ? `Found more than one entry for ${player}. Current value: ${JSON.stringify(currentValue)}. New Value ${JSON.stringify(newValue)}\n1 - Take First\n2 - Take Second\n3 - Combine\n` : 'Type 1, 2, or 3\n'
    action = await new Promise(resolve => {
      inputReader.question(message, resolve)
    })
    action = action.substr(0, 1)
  }
  while (!['1', '2', '3'].includes(action))

  if (action === '1') {
    return currentValue
  } else if (action === '2') {
    return newValue
  } else if (action === '3') {
    return Object.keys(currentValue).reduce((agg, k) => ({ ...agg, [k]: (typeof currentValue[k] === 'number') ? currentValue[k] + newValue[k] : currentValue[k] }), {})
  }
}
