const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const fetch = require('node-fetch');

class Audit {
  async validateNode(submission_value, round) {
    console.log(`Валидация сабмишена для раунда ${round}`);
    try {
      // Получаем данные из IPFS по переданному CID
      const ipfsData = await this.getDataFromIPFS(submission_value);
      if (!ipfsData) {
        console.error('Не удалось получить данные из IPFS.');
        return false;
      }

      const cachedData = await this.fetchCachedPlayerData();

      // Сравниваем закэшированные данные и полученные из IPFS
      const isValid = this.compareData(cachedData, ipfsData);
      return isValid;
    } catch (error) {
      console.error('Ошибка при валидации:', error);
      return false;
    }
  }

  /**
   * Получение данных из IPFS по CID
   * @param {string} cid - CID данных в IPFS
   */
  async getDataFromIPFS(cid) {
    try {
      const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
      const response = await fetch(ipfsUrl);

      if (!response.ok) {
        console.error('Ошибка ответа от IPFS:', response.statusText);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Ошибка при получении данных из IPFS:', error);
      return null;
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
