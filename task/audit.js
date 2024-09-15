const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk'); // Import KoiiStorageClient

class Audit {
  constructor() {
    this.client = new KoiiStorageClient(); // Initialize KoiiStorageClient
  }

  /**
   * Validate submission for the node.
   * @param {string} submission_value - The CID of the submission from IPFS.
   * @param {number} round - The round number.
   * @returns {Promise<boolean>} - Result of the validation.
   */
  async validateNode(submission_value, round) {
    console.log(`Validating submission for round ${round}`);
    try {
      // Fetch data from IPFS using the provided CID
      const ipfsData = await this.getDataFromIPFS(submission_value);
      if (!ipfsData) {
        console.error('Failed to retrieve data from IPFS.');
        return false;
      }

      // Fetch cached player data
      const cachedData = await this.fetchCachedPlayerData();

      // Check if there are any changes
      const isChanged = this.hasChanges(cachedData, ipfsData);

      if (isChanged) {
        console.log(`Data changed in round ${round}. Submission passed validation.`);
      } else {
        console.log(`No data changes in round ${round}. Submission passed validation.`);
      }

      return true; // Regardless of whether data changed or not, the submission is valid
    } catch (error) {
      console.error('Error during validation:', error);
      return false;
    }
  }

  /**
   * Retrieve data from IPFS using the CID.
   * @param {string} cid - The CID of the data in IPFS.
   * @returns {Promise<Array|null>} - Data from IPFS or null in case of an error.
   */
  async getDataFromIPFS(cid) {
    try {
      const fileName = 'submittedData.json'; // File name to extract data from IPFS
      const blob = await this.client.getFile(cid, fileName);
      const text = await blob.text();
      const data = JSON.parse(text); // Parse text data into JSON
      console.log('Data successfully retrieved from IPFS:', data);
      return data;
    } catch (error) {
      console.error('Error fetching data from IPFS:', error);
      return null;
    }
  }

  /**
   * Check if data has changed.
   * @param {Array} cachedData - Cached data.
   * @param {Array} newData - Data from IPFS.
   * @returns {boolean} - True if data has changed, otherwise false.
   */
  hasChanges(cachedData, newData) {
    return JSON.stringify(cachedData) !== JSON.stringify(newData);
  }

  /**
   * Retrieve all cached player data.
   * @returns {Promise<Array>} - Array of player data from the cache.
   */
  async fetchCachedPlayerData() {
    try {
      const cacheKeys = await namespaceWrapper.storeGet('cacheKeys');
      if (!cacheKeys) {
        console.error('Failed to retrieve cache keys.');
        return [];
      }

      const parsedKeys = JSON.parse(cacheKeys);
      const playersData = [];

      for (const key of parsedKeys) {
        const playerData = await namespaceWrapper.storeGet(key);
        if (playerData) {
          playersData.push(JSON.parse(playerData));
        }
      }

      console.log('Cached player data successfully retrieved.');
      return playersData;
    } catch (error) {
      console.error('Error retrieving data from the cache:', error);
      return [];
    }
  }

  /**
   * Execute the task audit for a specific round.
   * @param {number} roundNumber - The round number.
   */
  async auditTask(roundNumber) {
    console.log(`Starting task audit for round ${roundNumber}`);
    await namespaceWrapper.validateAndVoteOnNodes(
      this.validateNode.bind(this),
      roundNumber
    );
    console.log(`Task audit for round ${roundNumber} completed.`);
  }
}

const audit = new Audit();
module.exports = { audit };
