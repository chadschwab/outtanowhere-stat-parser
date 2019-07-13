#!/usr/bin/env node

const program = require('commander');
const { createReadStream, mkdirSync, readFileSync, writeFileSync, lstatSync, readdirSync } = require('fs');
const { sep } = require('path');
const { sync: globSync } = require('glob');

const parse = require('./src/parse');
const write = require('./src/write');
const googleSheet = require('./src/google-sheet');

const { toDatePartitionString, parseDateFromPartitionString } = require('./src/utils');

if (!process.env.DEBUG) {
  console.debug = () => { }
}

program
  .command('parse <file>')
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
  .command('combine')
  .option('-s, --stat-type [statType]', 'The stat type to target [skaterData|goalieData|teamData]')
  .action(async function ({ statType }) {
    const statTypes = statType ? [statType] : ['skaterData', 'goalieData', 'teamData'];
    const saveDirectory = `./team-stats/aggregate/${toDatePartitionString(new Date())}`;
    mkdirSync(saveDirectory, { recursive: true });

    await Promise.all(statTypes.map(async fileType => {
      const fileName = fileType.replace(/(\.csv)?$/, ".csv")

      const files = globSync(`team-stats/*/${fileName}`);
      console.debug(`${fileType}: The following files will be joined: `, files);

      const sortedFiles = files.sort((a, b) => parseDateFromPartitionString(a).getTime() - parseDateFromPartitionString(b).getTime());
      console.debug(`${fileType}: After sort applied: `, sortedFiles);

      const joined = sortedFiles
        .map(f => readFileSync(f))
        .join('');

      console.info(`${fileType} Result:\n`, joined);
      writeFileSync(`${saveDirectory}/${fileName}`, joined);
    }));
  });

//https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#appendcellsrequest
//https://developers.google.com/sheets/api/guides/authorizing
program
  .command('upload <directory>')
  .option('--spreadsheet-details [spreadsheetDetailsPath]', 'The location of the file for spreadsheet details', 'google-config/staging-spreadsheet-details.json')
  .action(async (directory, { spreadsheetDetailsPath }) => {
    const spreadSheetDetails = JSON.parse(readFileSync(spreadsheetDetailsPath));
    const dataFiles = readFileSync(directory)
      .map(f => f.replace('.json', ''))
      .filter(f => spreadSheetDetails.sheets[f]);

    console.debug('uploading the following data files: ')

    for await (const file of readFileSync(directory).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')))
      Promise.all(readdirSync(directory)
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          const values = readFileSync(f);
          const fileType = f.replace('.json', '');
          await googleSheet.append(spreadSheetDetails.spreadS)
        })
      );
  });

program.parse(process.argv)
