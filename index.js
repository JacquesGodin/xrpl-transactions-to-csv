require('dotenv').config();
const fs = require('fs');
const prompt = require('prompt-sync')();
const XrplClient = require('xrpl-client').XrplClient;
const moment = require('moment');

const XRPLNodeUrl = process.env.NODE || 'wss://s2.ripple.com';
const defaultLedger = process.env.LEDGER ? parseInt(process.env.LEDGER) : null;
const csvFilePath = './transactions.csv';

let Client;
let startLedger, endLedger, lastProcessedLedger;

async function initClient() {
  Client = new XrplClient(XRPLNodeUrl);
  
  // Handle connection events
  Client.on('connected', () => console.log('Connected to XRPL Node.'));
  Client.on('disconnected', handleDisconnect);
  Client.on('reconnecting', () => console.log('Attempting to reconnect...'));
}

function handleDisconnect(code, reason) {
  console.warn(`Disconnected from XRPL (code: ${code}, reason: ${reason}). Attempting to reconnect...`);
  initClient().then(() => {
    if (lastProcessedLedger < endLedger) {
      console.log(`Resuming from ledger [${lastProcessedLedger + 1}]...`);
      run(lastProcessedLedger + 1);
    }
  });
}

async function getCurrentLedgerIndex() {
  const result = await Client.send({ command: 'ledger_current' });
  return result.ledger_current_index;
}

async function getLedgerRangeFromDates(currentLedgerIndex) {
  const startDateStr = prompt('Enter the start date (DD/MM/YYYY): ');
  const endDateStr = prompt('Enter the end date (DD/MM/YYYY): ');

  const startDate = moment(startDateStr, 'DD/MM/YYYY');
  const endDate = moment(endDateStr, 'DD/MM/YYYY');
  if (!startDate.isValid() || !endDate.isValid()) {
    console.error('Invalid dates provided.');
    process.exit(1);
  }

  const ledgersPerDay = Math.floor(86400 / 4);
  const today = moment().startOf('day');
  const daysFromTodayStart = today.diff(startDate, 'days');
  const daysFromTodayEnd = today.diff(endDate, 'days');

  const startLedger = currentLedgerIndex - (daysFromTodayStart * ledgersPerDay);
  const endLedger = currentLedgerIndex - (daysFromTodayEnd * ledgersPerDay);

  console.log(`Start ledger: ${startLedger}, End ledger: ${endLedger}`);
  return { startLedger, endLedger };
}

async function estimateCsvSize(startLedger, endLedger) {
  const numLedgers = endLedger - startLedger + 1;
  const sampleSize = 5;
  let totalTransactions = 0;
  let totalRowSize = 0;

  for (let i = 0; i < sampleSize; i++) {
    const ledgerIndex = startLedger + Math.floor((endLedger - startLedger) * (i / sampleSize));
    const ledgerResult = await fetchLedgerTransactions(ledgerIndex);

    if (ledgerResult.ledger && Array.isArray(ledgerResult.ledger.transactions)) {
      const numTransactions = ledgerResult.ledger.transactions.length;
      totalTransactions += numTransactions;

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

const fetchLedgerTransactions = (ledger_index) => {
  return new Promise((resolve, reject) => {
    Client.send({
      command: 'ledger',
      ledger_index: parseInt(ledger_index),
      transactions: true,
      expand: true,
      validated: true
    }).then(resolve).catch(reject);
  });
};

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

  return `${LedgerSequence},${CloseTime},${TransactionType},${Account},${Fee},${Sequence},${Flags},${Signers},${SourceTag},${Amount},${Destination},${DestinationTag},${Paths},${SendMax},${DeliverMin},${TakerGets},${TakerGetsCurrency},${TakerPays},${TakerPaysCurrency},${Expiration},${OfferSequence},${LimitAmount},${QualityIn},${QualityOut},${TransactionHash},${TransactionResult},${DeliveredAmount}`;
};

async function run(ledger_index) {
  try {
    const Result = await fetchLedgerTransactions(ledger_index);
    const txCount = Result.ledger.transactions.length;
    console.log(`${txCount > 0 ? 'Transactions in' : ' '.repeat(15)} ${Result.ledger_index}: `, txCount > 0 ? txCount : '-');

    if (txCount > 0) {
      const rows = Result.ledger.transactions.map(tx => processTransactionToCsvRow(tx, Result.ledger));
      fs.appendFileSync(csvFilePath, rows.join('\n') + '\n');
    }

    lastProcessedLedger = ledger_index;

    if (ledger_index < endLedger) {
      run(ledger_index + 1);
    } else {
      console.log('Reached end of date range.');
    }
  } catch (error) {
    console.warn(`Error fetching ledger ${ledger_index}: ${error}`);
    if (!error.message.includes('ledger not validated') && ledger_index < endLedger) {
      run(ledger_index + 1);
    }
  }
}

(async () => {
  await initClient();
  const useDefaultLedger = prompt('Do you want to use the default LEDGER value from .env? (yes/no): ').toLowerCase();

  if (useDefaultLedger === 'yes' && defaultLedger) {
    startLedger = defaultLedger;
    endLedger = await getCurrentLedgerIndex();
    console.log(`Using default LEDGER from .env: ${defaultLedger}, fetching up to the most recent ledger: ${endLedger}`);
  } else {
    const currentLedgerIndex = await getCurrentLedgerIndex();
    const ledgerRange = await getLedgerRangeFromDates(currentLedgerIndex);
    startLedger = ledgerRange.startLedger;
    endLedger = ledgerRange.endLedger;
  }

  console.log('Estimating CSV file size...');
  const estimatedSize = await estimateCsvSize(startLedger, endLedger);
  const proceed = prompt(`The estimated size of the CSV file is ${(estimatedSize / (1024 * 1024)).toFixed(2)} MB. Do you want to proceed? (yes/no): `);

  if (proceed.toLowerCase() === 'yes') {
    console.log('Proceeding with the data dump...');
    fs.writeFileSync(csvFilePath, 'LedgerSequence,CloseTime,TransactionType,Account,Fee,Sequence,Flags,Signers,SourceTag,Amount,Destination,DestinationTag,Paths,SendMax,DeliverMin,TakerGets,TakerGetsCurrency,TakerPays,TakerPaysCurrency,Expiration,OfferSequence,LimitAmount,QualityIn,QualityOut,TransactionHash,TransactionResult,DeliveredAmount\n');
    run(startLedger);
  } else {
    console.log('Operation canceled by the user.');
  }
})();
