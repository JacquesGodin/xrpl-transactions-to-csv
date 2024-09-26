/*
 * This script is based on code originally developed by Wietse Wind.
 * Original repository: https://github.com/WietseWind/fetch-xrpl-transactions/tree/google-bigquery
 * Modifications and enhancements by Jacques Godin.
 * Licensed under the MIT License.
 */


require('dotenv').config(); // Load environment variables from .env file
const fs = require('fs');
const prompt = require('prompt-sync')(); // Import prompt-sync for user input
const XrplClient = require('xrpl-client').XrplClient;
const moment = require('moment'); // Import moment for date handling

// Configuration constants
const XRPLNodeUrl = process.env.NODE || 'wss://s2.ripple.com';  // Use .env for NODE
const defaultLedger = process.env.LEDGER ? parseInt(process.env.LEDGER) : null; // Default ledger from .env

// CSV File Path
const csvFilePath = './transactions.csv';

// Create the XRPL Client
const Client = new XrplClient(XRPLNodeUrl);

// Fetch the current ledger index
async function getCurrentLedgerIndex() {
  const result = await Client.send({ command: 'ledger_current' });
  return result.ledger_current_index;
}

// Prompt the user for start and end dates
async function getLedgerRangeFromDates(currentLedgerIndex) {
  const startDateStr = prompt('Enter the start date (DD/MM/YYYY): ');
  const endDateStr = prompt('Enter the end date (DD/MM/YYYY): ');

  // Convert the input dates to moments
  const startDate = moment(startDateStr, 'DD/MM/YYYY');
  const endDate = moment(endDateStr, 'DD/MM/YYYY');

  if (!startDate.isValid() || !endDate.isValid()) {
    console.error('Invalid dates provided.');
    process.exit(1);
  }

  // Number of ledgers per day (approximation: 21,600 ledgers per day)
  const ledgersPerDay = Math.floor(86400 / 4); // 86400 seconds per day, 4 seconds per ledger

  // Calculate the ledger range
  const today = moment().startOf('day');
  const daysFromTodayStart = today.diff(startDate, 'days');
  const daysFromTodayEnd = today.diff(endDate, 'days');

  const startLedger = currentLedgerIndex - (daysFromTodayStart * ledgersPerDay);
  const endLedger = currentLedgerIndex - (daysFromTodayEnd * ledgersPerDay);

  console.log(`Start ledger: ${startLedger}, End ledger: ${endLedger}`);
  return { startLedger, endLedger };
}

// Function to estimate the number of transactions and the file size
async function estimateCsvSize(startLedger, endLedger) {
  const numLedgers = endLedger - startLedger + 1;
  const sampleSize = 5; // We'll sample 5 ledgers to estimate transactions

  let totalTransactions = 0;
  let totalRowSize = 0;

  for (let i = 0; i < sampleSize; i++) {
    const ledgerIndex = startLedger + Math.floor((endLedger - startLedger) * (i / sampleSize));
    const ledgerResult = await fetchLedgerTransactions(ledgerIndex);

    if (ledgerResult.ledger && Array.isArray(ledgerResult.ledger.transactions)) {
      const numTransactions = ledgerResult.ledger.transactions.length;
      totalTransactions += numTransactions;

      // Estimate row size based on the first transaction
      if (numTransactions > 0 && totalRowSize === 0) {
        const sampleRow = processTransactionToCsvRow(ledgerResult.ledger.transactions[0], ledgerResult.ledger);
        totalRowSize = Buffer.byteLength(sampleRow, 'utf-8');
      }
    }
  }

  const avgTransactionsPerLedger = totalTransactions / sampleSize;
  const totalEstimatedTransactions = avgTransactionsPerLedger * numLedgers;
  const estimatedCsvSize = totalEstimatedTransactions * totalRowSize;

  console.log(`Estimated number of ledgers: ${numLedgers}`);
  console.log(`Average transactions per ledger: ${avgTransactionsPerLedger}`);
  console.log(`Estimated CSV size: ${(estimatedCsvSize / (1024 * 1024)).toFixed(2)} MB`);

  return estimatedCsvSize;
}

// Function to fetch ledger transactions
const fetchLedgerTransactions = (ledger_index) => {
  return new Promise((resolve, reject) => {
    Client.send({
      command: 'ledger',
      ledger_index: parseInt(ledger_index),
      transactions: true,
      expand: true,  // Expanded data for full transaction details
      validated: true  // Ensure only validated ledgers are queried
    }).then((Result) => {
      resolve(Result);
    }).catch(reject);
  });
};

// Function to process a single transaction and return as a CSV row
const processTransactionToCsvRow = (tx, ledger_info) => {
  const LedgerSequence = ledger_info.ledger_index || 'N/A';
  const CloseTime = ledger_info.close_time_human || 'N/A';
  const TransactionType = tx.TransactionType || 'N/A';
  const Account = tx.Account || 'N/A';
  const Fee = tx.Fee || 'N/A';
  const Sequence = tx.Sequence || 'N/A';
  const Flags = tx.Flags || 'N/A';
  const Signers = JSON.stringify(tx.Signers) || 'N/A';
  const SourceTag = tx.SourceTag || 'N/A';
  const Amount = tx.Amount || 'N/A';
  const Destination = tx.Destination || 'N/A';
  const DestinationTag = tx.DestinationTag || 'N/A';
  const Paths = JSON.stringify(tx.Paths) || 'N/A';
  const SendMax = tx.SendMax || 'N/A';
  const DeliverMin = tx.DeliverMin || 'N/A';
  const TakerGets = tx.TakerGets?.value || tx.TakerGets || 'N/A';
  const TakerGetsCurrency = tx.TakerGets?.currency || 'XRP';
  const TakerPays = tx.TakerPays?.value || tx.TakerPays || 'N/A';
  const TakerPaysCurrency = tx.TakerPays?.currency || 'XRP';
  const Expiration = tx.Expiration || 'N/A';
  const OfferSequence = tx.OfferSequence || 'N/A';
  const LimitAmount = tx.LimitAmount || 'N/A';
  const QualityIn = tx.QualityIn || 'N/A';
  const QualityOut = tx.QualityOut || 'N/A';
  const TransactionHash = tx.hash || 'N/A';
  const TransactionResult = tx.metaData?.TransactionResult || 'N/A';
  const DeliveredAmount = tx.metaData?.delivered_amount || 'N/A';

  // Prepare CSV row
  return `${LedgerSequence},${CloseTime},${TransactionType},${Account},${Fee},${Sequence},${Flags},${Signers},${SourceTag},${Amount},${Destination},${DestinationTag},${Paths},${SendMax},${DeliverMin},${TakerGets},${TakerGetsCurrency},${TakerPays},${TakerPaysCurrency},${Expiration},${OfferSequence},${LimitAmount},${QualityIn},${QualityOut},${TransactionHash},${TransactionResult},${DeliveredAmount}`;
};

(async () => {
  // Ask the user if they want to use the default LEDGER or provide a date range
  const useDefaultLedger = prompt('Do you want to use the default LEDGER value from .env? (yes/no): ').toLowerCase();

  let startLedger, endLedger;

  if (useDefaultLedger === 'yes' && defaultLedger) {
    startLedger = defaultLedger;
    endLedger = await getCurrentLedgerIndex(); // Use the current ledger as the end point
    console.log(`Using default LEDGER from .env: ${defaultLedger}, fetching up to the most recent ledger: ${endLedger}`);
  } else {
    const currentLedgerIndex = await getCurrentLedgerIndex();
    const ledgerRange = await getLedgerRangeFromDates(currentLedgerIndex);
    startLedger = ledgerRange.startLedger;
    endLedger = ledgerRange.endLedger;
  }

  console.log('Estimating CSV file size...');
  const estimatedSize = await estimateCsvSize(startLedger, endLedger);

  // Ask user if they want to proceed based on the estimated size
  const proceed = prompt(`The estimated size of the CSV file is ${(estimatedSize / (1024 * 1024)).toFixed(2)} MB. Do you want to proceed? (yes/no): `);

  if (proceed.toLowerCase() !== 'yes') {
    console.log('Operation canceled by the user.');
    process.exit(0);
  }

  console.log('Proceeding with the data dump...');
  
  Client.ready().then((Connection) => {
    let Stopped = false;
    let LastLedger = 0;

    console.log('Connected to the XRPL');
  
    fs.writeFileSync(csvFilePath, 'LedgerSequence,CloseTime,TransactionType,Account,Fee,Sequence,Flags,Signers,SourceTag,Amount,Destination,DestinationTag,Paths,SendMax,DeliverMin,TakerGets,TakerGetsCurrency,TakerPays,TakerPaysCurrency,Expiration,OfferSequence,LimitAmount,QualityIn,QualityOut,TransactionHash,TransactionResult,DeliveredAmount\n');
    
    // Function to run the transaction fetching loop
    const run = (ledger_index) => {
      fetchLedgerTransactions(ledger_index).then((Result) => {
        const txCount = Result.ledger.transactions.length;
        console.log(`${txCount > 0 ? 'Transactions in' : ' '.repeat(15)} ${Result.ledger_index}: `, txCount > 0 ? txCount : '-');

        if (txCount > 0) {
          const rows = Result.ledger.transactions.map(tx => processTransactionToCsvRow(tx, Result.ledger));
          fs.appendFileSync(csvFilePath, rows.join('\n') + '\n');
        }

        if (Stopped) {
          return;
        }

        // Continue to the next ledger
        if (ledger_index < endLedger) {
          return run(ledger_index + 1);
        } else {
          console.log('Reached end of date range.');
        }
      }).catch((e) => {
        // If the error indicates the ledger hasn't been minted yet, stop the script
        if (e.message.includes('ledger not validated') || e.message.includes('ledgerIndex not found')) {
          console.log(`Reached the most recent validated ledger at index: ${ledger_index}`);
          process.exit(0); // Stop the process
        } else {
          console.warn(`Warning: ${e}`);
          if (!Stopped && ledger_index < endLedger) {
            return run(ledger_index + 1); // Skip to the next ledger if an error occurs
          }
        }
      });
    };

    console.log(`Starting at ledger [ ${startLedger} ] and ending at [ ${endLedger} ]`);

    run(startLedger);

    // Gracefully handle shutdown (Ctrl+C)
    process.on('SIGINT', () => {
      console.log(`\nGracefully shutting down from SIGINT (Ctrl+C)`);
      Stopped = true;
      Connection.close();
      if (LastLedger > 0) {
        console.log(`\nLast ledger: [ ${LastLedger} ]\nRun your next job with ENV: "LEDGER=${LastLedger + 1}"\n`);
      }
    });
  });
})();
