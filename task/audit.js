const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Audit {
  /**
   * Валидация данных игрока, отправленных для кэширования в Koii Task.
   * @param {string} submission_value - Отправленные данные для валидации
   * @param {number} round - Номер текущего раунда
   * @returns {Promise<boolean>} Возвращает true, если данные валидны, иначе false
   */
  async validateNode(submission_value, round) {
    console.log(`Валидация сабмишена для раунда ${round}`);
    try {
      // Получаем данные, кэшированные на Koii узлах
      const cachedData = await this.fetchCachedPlayerData();
      const submittedData = JSON.parse(submission_value);

      // Сравниваем кэшированные данные с отправленными
      const isValid = this.compareData(cachedData, submittedData);
      return isValid;
    } catch (error) {
      console.error('Ошибка при валидации:', error);
      return false;
    }
  }

  /**
   * Сравнение кэшированных данных с отправленными.
   * @param {Array} cachedData - Кэшированные данные игроков
   * @param {Array} submittedData - Отправленные данные для валидации
   * @returns {boolean} Результат сравнения
   */
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

  /**
   * Получение кэшированных данных игроков с Koii узлов.
   * @returns {Promise<Array>} Кэшированные данные игроков
   */
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

  /**
   * Аудит сабмишенов других нод.
   * @param {number} roundNumber - Номер текущего раунда
   */
  async auditTask(roundNumber) {
    await namespaceWrapper.validateAndVoteOnNodes(
      this.validateNode.bind(this),
      roundNumber
    );
  }
}

const audit = new Audit();
module.exports = { audit };
