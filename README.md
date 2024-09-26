# xrpl-transactions-to-csv
A tool for fetching XRPL transactions from public nodes with CSV export, based on an original script by Wietse Wind

# XRPL Transaction Fetcher

This project is based on an original script from [Wietse Wind](https://github.com/WietseWind/fetch-xrpl-transactions/tree/google-bigquery). The script was extended to include additional features such as:

- CSV size estimation
- User input for date ranges or default `.env` ledger
- Automatic termination upon reaching the most recent validated ledger

## Credits

- Original repository: [Original Repository](https://github.com/WietseWind/fetch-xrpl-transactions/tree/google-bigquery)
- Modifications by [Jacques Godin](https://github.com/JacquesGodin/xrpl-transactions-to-csv)

## How to Use

This tool fetches XRPL transactions and exports them to a CSV file. You can either use a default `LEDGER` from the `.env` file or input a date range for custom ledger queries.

Just install dependencies and then 'node index.js' to run the script.

## How to Run the Script

1. Clone this repository:
   ```bash
   git clone https://github.com/JacquesGodin/xrpl-transactions-to-csv
   cd your-repo-name
   ```

2. Install dependencies:
   ```bash
   npm install prompt-sync dotenv xrpl-client moment
   ```

3. Set up a `.env` file with the following content:
   ```
   LEDGER=xxxxxxx
   ```

4. Run the script:
   ```bash
   node index.js
   ```

## Features
- Fetches XRPL transactions between a range of ledgers or from a specific ledger defined in `.env`.
- Estimates CSV file size before the data dump.
- Terminates automatically when an unvalidated ledger is encountered.


## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more details.
