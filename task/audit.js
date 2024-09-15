const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const fetch = require('node-fetch');

class Audit {
  /**
   * Валидация сабмишена для узла.
   * @param {string} submission_value - CID сабмишена из IPFS.
   * @param {number} round - Номер раунда.
   * @returns {Promise<boolean>} - Результат валидации.
   */
  async validateNode(submission_value, round) {
    console.log(`Валидация сабмишена для раунда ${round}`);
    try {
      // Получаем данные из IPFS по переданному CID
      const ipfsData = await this.getDataFromIPFS(submission_value);
      if (!ipfsData) {
        console.error('Не удалось получить данные из IPFS.');
        return false;
      }

      // Получаем закэшированные данные игроков
      const cachedData = await this.fetchCachedPlayerData();

      // Сравниваем данные из кэша и IPFS
      const isValid = this.compareData(cachedData, ipfsData);

      if (isValid) {
        console.log(`Сабмишен для раунда ${round} прошёл валидацию.`);
      } else {
        console.error(`Сабмишен для раунда ${round} не прошёл валидацию, но может быть частично принят.`);
        // Лояльная валидация - считаем сабмишен валидным, если несоответствия минимальны
        return this.lenientValidation(cachedData, ipfsData);
      }

      return isValid;
    } catch (error) {
      console.error('Ошибка при валидации:', error);
      return false;
    }
  }

  /**
   * Получение данных из IPFS по CID.
   * @param {string} cid - CID данных в IPFS.
   * @returns {Promise<Array|null>} - Данные из IPFS или null в случае ошибки.
   */
  async getDataFromIPFS(cid) {
    try {
      const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
      console.log(`Запрос данных из IPFS по адресу: ${ipfsUrl}`);
      const response = await fetch(ipfsUrl);

      if (!response.ok) {
        console.error('Ошибка ответа от IPFS:', response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('Данные успешно получены из IPFS:', data);
      return data;
    } catch (error) {
      console.error('Ошибка при получении данных из IPFS:', error);
      return null;
    }
  }

  /**
   * Сравнение закэшированных данных и сабмишена из IPFS.
   * @param {Array} cachedData - Закэшированные данные.
   * @param {Array} submittedData - Данные из IPFS.
   * @returns {boolean} - True, если данные совпадают, иначе false.
   */
  compareData(cachedData, submittedData) {
    if (cachedData.length !== submittedData.length) {
      console.error('Несоответствие количества записей между кэшем и данными из IPFS.');
      return false;
    }

    for (let i = 0; i < cachedData.length; i++) {
      if (JSON.stringify(cachedData[i]) !== JSON.stringify(submittedData[i])) {
        console.error(`Несоответствие данных для записи ${i}:`);
        console.error('Закэшированные данные:', cachedData[i]);
        console.error('Данные из IPFS:', submittedData[i]);
        return false;
      }
    }

    console.log('Все данные совпадают.');
    return true;
  }

  /**
   * Лояльная проверка данных с допустимым уровнем несовпадений.
   * @param {Array} cachedData - Закэшированные данные.
   * @param {Array} submittedData - Данные из IPFS.
   * @returns {boolean} - True, если данные достаточно близки, иначе false.
   */
  lenientValidation(cachedData, submittedData) {
    let mismatches = 0;

    for (let i = 0; i < cachedData.length; i++) {
      if (JSON.stringify(cachedData[i]) !== JSON.stringify(submittedData[i])) {
        mismatches++;
        console.warn(`Небольшое несовпадение данных для игрока ${cachedData[i]?.username || 'неизвестный'}`);
      }
    }

    // Если несоответствий менее 10%, считаем сабмишен валидным
    const mismatchPercentage = (mismatches / cachedData.length) * 100;
    console.log(`Процент несовпадений: ${mismatchPercentage}%`);

    if (mismatchPercentage <= 10) {
      console.log('Несоответствия незначительны, сабмишен принят.');
      return true;
    } else {
      console.error('Слишком много несовпадений, сабмишен отклонён.');
      return false;
    }
  }

  /**
   * Получение всех закэшированных данных игроков.
   * @returns {Promise<Array>} - Массив данных игроков из кэша.
   */
  async fetchCachedPlayerData() {
    try {
      const cacheKeys = await namespaceWrapper.storeGet('cacheKeys');
      if (!cacheKeys) {
        console.error('Не удалось получить список кэшированных ключей.');
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

      console.log('Закэшированные данные игроков успешно получены.');
      return playersData;
    } catch (error) {
      console.error('Ошибка получения данных из кэша:', error);
      return [];
    }
  }

  /**
   * Выполнение аудита задачи для определённого раунда.
   * @param {number} roundNumber - Номер раунда.
   */
  async auditTask(roundNumber) {
    console.log(`Начало аудита задачи для раунда ${roundNumber}`);
    await namespaceWrapper.validateAndVoteOnNodes(
      this.validateNode.bind(this),
      roundNumber
    );
    console.log(`Аудит задачи для раунда ${roundNumber} завершён.`);
  }
}

const audit = new Audit();
module.exports = { audit };
