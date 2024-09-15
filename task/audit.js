const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Audit {
  async validateNode(submission_value, round) {
    console.log(`Валидация сабмишена для раунда ${round}`);
    try {
      const cachedData = await this.fetchCachedPlayerData();
      const submittedData = JSON.parse(submission_value);

      const isValid = this.compareData(cachedData, submittedData);
      return isValid;
    } catch (error) {
      console.error('Ошибка при валидации:', error);
      return false;
    }
  }

  compareData(cachedData, submittedData) {
    if (cachedData.length !== submittedData.length) {
      return false;
    }
    for (let i = 0; i < cachedData.length; i++) {
      if (JSON.stringify(cachedData[i]) !== JSON.stringify(submittedData[i])) {
        return false;
      }
    }
    return true;
  }

  async fetchCachedPlayerData() {
    try {
      const cacheKeys = await namespaceWrapper.storeListKeys();
      const playersData = [];
      for (const key of cacheKeys) {
        const playerData = await namespaceWrapper.storeGet(key);
        if (playerData) {
          playersData.push(JSON.parse(playerData));
        }
      }
      return playersData;
    } catch (error) {
      console.error('Ошибка получения данных из кэша:', error);
      return [];
    }
  }

  async auditTask(roundNumber) {
    await namespaceWrapper.validateAndVoteOnNodes(
      this.validateNode.bind(this),
      roundNumber
    );
  }
}

const audit = new Audit();
module.exports = { audit };
