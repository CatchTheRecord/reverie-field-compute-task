const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk'); // Импорт KoiiStorageClient

class Audit {
  constructor() {
    this.client = new KoiiStorageClient(); // Инициализация KoiiStorageClient
  }

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

      // Проверяем, есть ли какие-либо изменения
      const isChanged = this.hasChanges(cachedData, ipfsData);

      if (isChanged) {
        console.log(`Данные изменились в раунде ${round}. Сабмишен прошёл валидацию.`);
      } else {
        console.log(`Данные не изменились в раунде ${round}. Сабмишен прошёл валидацию.`);
      }

      return true; // Независимо от того, изменились данные или нет, сабмишен считается валидным
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
      const fileName = 'submittedData.json'; // Имя файла для извлечения данных из IPFS
      const blob = await this.client.getFile(cid, fileName);
      const text = await blob.text();
      const data = JSON.parse(text); // Преобразуем текстовые данные в JSON
      console.log('Данные успешно получены из IPFS:', data);
      return data;
    } catch (error) {
      console.error('Ошибка при получении данных из IPFS:', error);
      return null;
    }
  }

  /**
   * Проверка, изменились ли данные.
   * @param {Array} cachedData - Закэшированные данные.
   * @param {Array} newData - Данные из IPFS.
   * @returns {boolean} - True, если данные изменились, иначе false.
   */
  hasChanges(cachedData, newData) {
    return JSON.stringify(cachedData) !== JSON.stringify(newData);
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
