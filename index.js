#!/usr/bin/env node

const program = require('commander');
const { createReadStream, mkdirSync, readFileSync, writeFileSync, lstatSync, readdirSync } = require('fs');
const { sep } = require('path');
const { sync: globSync } = require('glob');

const parse = require('./src/parse');
const stringifyParsedData = require('./src/stringifyParsedData');
const googleSheet = require('./src/google-sheet');

const { toDatePartitionString, parseDateFromPartitionString, statTypes } = require('./src/utils');

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
        const parsedData = await parse(readStream = createReadStream(file), gameType, session, sessionRank);

        const saveDirectory = `./team-stats/${toDatePartitionString(parsedData.teamData.date)}`;
        mkdirSync(saveDirectory, { recursive: true });

        const stringifiedData = await Promise.all(statTypes.map(async s => stringifyParsedData(parsedData[s], s, false)));
        statTypes.forEach((s, i) => writeFileSync(`${saveDirectory}/${s}.csv`, stringifiedData[i]));

        const stringifiedDataWithHeaders = await Promise.all(statTypes.map(async s => stringifyParsedData(parsedData[s], s, true)));
        await writeFileSync(`${saveDirectory}/facebook-post.txt`, stringifiedDataWithHeaders.join("--\n\n"))
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
  .action(async function () {
    const saveDirectory = `./team-stats/aggregate/${toDatePartitionString(new Date())}`;
    mkdirSync(saveDirectory, { recursive: true });

    await Promise.all(statTypes.map(async statType => {
      const fileName = statType.replace(/(\.csv)?$/, ".csv")

      const files = globSync(`team-stats/*/${fileName}`);
      console.debug(`${statType}: The following files will be joined: `, files);

      const sortedFiles = files.sort((a, b) => parseDateFromPartitionString(a).getTime() - parseDateFromPartitionString(b).getTime());
      console.debug(`${statType}: After sort applied: `, sortedFiles);

      const joined = sortedFiles
        .map(f => readFileSync(f))
        .join('');

      console.info(`${statType} Result:\n`, joined);
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
