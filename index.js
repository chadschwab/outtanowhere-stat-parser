#!/usr/bin/env node

const program = require('commander');
const { createReadStream, mkdirSync, readFileSync, writeFileSync, lstatSync, readdirSync } = require('fs');
const { sep } = require('path');
const parse = require('./src/parse');
const write = require('./src/write');
const { toDatePartitionString, parseDateFromPartitionString } = require('./src/utils');
const { sync: globSync } = require('glob');
if (!process.env.DEBUG) {
  console.debug = () => { }
}

program
  .command('parse <file>')
  .option('-o, --output [output]', 'The output file. If not given outputs to standard out.')
  .option('--game-type [gameType]', 'Type of session [Regular|Playoff]', 'Regular')
  .option('--session [session]', 'The description of the session', 'Summer 2019')
  .option('--session-rank [sessionRank]', 'The description of the session', '6')
  .action(async function (file, { gameType, session, sessionRank }) {
    let files = lstatSync(file).isDirectory() ? readdirSync(file).filter(f => f.endsWith('.txt')).map(f => `${file}${sep}${f}`) : [file];
    console.debug('The following files will be parsed', files);
    for await (const file of files) {
      let readStream;
      try {
        const { skaterData, goalieData, teamData } = await parse(readStream = createReadStream(file), gameType, session, sessionRank);

        const saveDirectory = `./team-stats/${toDatePartitionString(teamData.date)}`;
        mkdirSync(saveDirectory, { recursive: true });

        await write(saveDirectory, skaterData, goalieData, teamData);
      }
      catch (e) {
        console.error("Parsing failed.", e);
      }
      finally {
        readStream.close();
      }
    }
  });

program
  .command('combine <file-type>')
  .action(fileType => {
    const fileName = fileType.replace(/(\.csv)?$/, ".csv")
    const saveDirectory = `./team-stats/aggregate/${toDatePartitionString(new Date())}`;
    mkdirSync(saveDirectory, { recursive: true });

    const files = globSync(`team-stats/*/${fileName}`);
    console.debug("The following files will be joined: ", files);

    const sortedFiles = files.sort((a, b) => parseDateFromPartitionString(a).getTime() - parseDateFromPartitionString(b).getTime());
    console.debug("After sort applied: ", sortedFiles);

    const joined = sortedFiles
      .map(f => readFileSync(f))
      .join('');

    console.info(`Result:\n${joined}`);
    writeFileSync(`${saveDirectory}/${fileName}`, joined);
  });

program.parse(process.argv)
