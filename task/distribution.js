const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Distribution {
  /**
   * Generate and submit the distribution list for the current round
   * @param {number} round - The current round number
   * @returns {void}
   */
  submitDistributionList = async (round) => {
    console.log('Submitting distribution list for round', round);
    try {
      const distributionList = await this.generateDistributionList(round);
      if (Object.keys(distributionList).length === 0) {
        console.error('Failed to generate the distribution list: it is empty.');
        return;
      }

      // Submit the distribution list to the blockchain via Koii
      const decider = await namespaceWrapper.uploadDistributionList(distributionList, round);
      if (decider) {
        const response = await namespaceWrapper.distributionListSubmissionOnChain(round);
        console.log('Response after submitting distribution list:', response);
      } else {
        console.error('Failed to upload distribution list for round:', round);
      }
    } catch (err) {
      console.error('Error submitting distribution list:', err);
    }
  };

  /**
   * Generate the distribution list for the current round
   * @param {number} round - The current round number
   * @returns {Promise<object>} Distribution list for the given round
   */
  async generateDistributionList(round) {
    try {
      console.log('Generating distribution list for round', round);
      let distributionList = {};
      let validPlayers = [];
      let totalStake = 0;

      // Fixed reward pool for the current round
      const rewardPool = 250; // Adjust as necessary

      // Fetch submission data for the current round
      const taskAccountDataJSON = await namespaceWrapper.getTaskSubmissionInfo(round);
      if (!taskAccountDataJSON || !taskAccountDataJSON.submissions) {
        console.error('Error fetching submission data or submissions are missing.');
        return distributionList;
      }

      const submissions = taskAccountDataJSON.submissions[round];
      if (!submissions) {
        console.log(`No submissions found for round ${round}`);
        return distributionList;
      }

      const submissionKeys = Object.keys(submissions);
      const taskStakeListJSON = await namespaceWrapper.getTaskState({ is_stake_list_required: true });
      if (!taskStakeListJSON || !taskStakeListJSON.stake_list) {
        console.error('Error fetching stake list or stake list is missing.');
        return distributionList;
      }

      // Process submissions and calculate total stake
      for (const playerPublicKey of submissionKeys) {
        const playerSubmission = submissions[playerPublicKey];
        const isValidSubmission = this.checkIfSubmissionHasChanges(playerSubmission);

        if (isValidSubmission) {
          validPlayers.push(playerPublicKey);
          totalStake += taskStakeListJSON.stake_list[playerPublicKey] || 0; // Sum total stake
        } else {
          // If the submission is invalid, reduce the player's stake
          const playerStake = taskStakeListJSON.stake_list[playerPublicKey];
          if (playerStake) {
            const slashedStake = Math.floor(playerStake * 0.7);
            distributionList[playerPublicKey] = -slashedStake;
            console.log('Penalty applied for player:', playerPublicKey, 'Penalty:', slashedStake);
          } else {
            console.log('Player', playerPublicKey, 'has no stake.');
          }
        }
      }

      if (validPlayers.length === 0 || totalStake === 0) {
        console.warn('No valid players or total stake is zero.');
        return distributionList;
      }

      console.log('Total stake of valid players:', totalStake);

      // Calculate proportional and equal pools
      const proportionalPool = rewardPool * 0.6; // 60% of reward pool
      const equalPool = rewardPool * 0.4; // 40% of reward pool
      const equalReward = Math.floor(equalPool / validPlayers.length);

      // Distribute rewards
      for (const validPlayer of validPlayers) {
        const playerStake = taskStakeListJSON.stake_list[validPlayer] || 0;
        const proportionalReward = Math.floor((playerStake / totalStake) * proportionalPool);

        // Combine equal and proportional rewards
        distributionList[validPlayer] = equalReward + proportionalReward;
        console.log(
          `Player ${validPlayer}: Equal reward = ${equalReward}, Proportional reward = ${proportionalReward}, Total = ${distributionList[validPlayer]}`
        );
      }

      console.log('Final distribution list:', distributionList);
      return distributionList;
    } catch (err) {
      console.error('Error generating distribution list:', err);
      return {};
    }
  }

  /**
   * Check if a submission contains any changes in player data
   * @param {object} submission - Player's submission
   * @returns {boolean} Result of the check for data changes
   */
  checkIfSubmissionHasChanges(submission) {
    return submission && Object.keys(submission).length > 0;
  }

  /**
   * Audit the distribution list for the current round
   * @param {number} roundNumber - The current round number
   * @returns {void}
   */
  async auditDistribution(roundNumber) {
    console.log('Auditing distribution list for round:', roundNumber);
    await namespaceWrapper.validateAndVoteOnDistributionList(this.validateDistribution, roundNumber);
  }

  /**
   * Validate the distribution list submitted by another node
   * @param {string} distributionListSubmitter - Public key of the submitter of the distribution list
   * @param {number} round - The round number
   * @returns {Promise<boolean>} Result of the validation (true if the list is valid)
   */
  validateDistribution = async (distributionListSubmitter, round) => {
    try {
      const rawDistributionList = await namespaceWrapper.getDistributionList(distributionListSubmitter, round);
      if (!rawDistributionList) {
        console.log(`Distribution list not found for round ${round}`);
        return true;
      }

      const fetchedDistributionList = JSON.parse(rawDistributionList);
      const generatedDistributionList = await this.generateDistributionList(round);

      // Compare the distribution lists
      const isValid = this.shallowEqual(fetchedDistributionList, generatedDistributionList);
      if (isValid) {
        console.log('Distribution list successfully validated.');
      } else {
        console.error('Error: Distribution list failed validation.');
      }
      return isValid;
    } catch (error) {
      console.error('Error validating distribution list:', error);
      return false;
    }
  };

  /**
   * Compare two objects for equality
   * @param {object} obj1 - First object
   * @param {object} obj2 - Second object
   * @returns {boolean} Result of the comparison
   */
  shallowEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) {
      return false;
    }
    for (let key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }
    return true;
  }
}

const distribution = new Distribution();
module.exports = { distribution };
