#!/usr/bin/env node

const program = require('commander')
const parse = require('./src/parse');

program
  .command('parse <file>')
  .version('0.1.0')
  .option('-d, --debug', 'Output debug level')
  .option('-o, --output [output]', 'The output file. If not given outputs to standard out.')
  .option('--game-type [gameType]', 'Type of session [Regular|Playoff]', 'Regular')
  .option('--session [session]', 'The description of the session', 'Spring 2019')
  .option('--session-rank [sessionRank]', 'The description of the session', '6')
  .action(async function (file, { debug, output, gameType, session, sessionRank }) {

    if (!debug) {
      console.debug = () => { }
    }
    await parse(file, gameType, session, sessionRank);
  });

program.parse(process.argv)
