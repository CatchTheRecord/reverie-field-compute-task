const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk'); // Импорт KoiiStorageClient
const path = require('path');
const os = require('os');
const fs = require('fs');

class Submission {
  constructor() {
    this.client = new KoiiStorageClient(); // Инициализация KoiiStorageClient
  }

  /**
   * Задача Koii для получения данных игроков с вашего серверного эндпоинта.
   * @param {number} round - Номер раунда
   */
  async task(round) {
    console.log(`Запуск задачи для раунда: ${round}`);

    // Получаем данные игроков с серверного кода через эндпоинт
    const playersData = await this.getPlayerDataFromServer();

    if (!playersData || playersData.length === 0) {
      console.log('Нет данных игроков для обработки.');
      return;
    }

    // Кэшируем данные для каждого игрока на узле Koii
    for (const playerData of playersData) {
      console.log(`Обработка данных игрока: ${playerData.username}`);
      const isUpdated = await this.cachePlayerDataIfUpdated(playerData);

      if (isUpdated) {
        console.log(`Данные игрока ${playerData.username} были изменены и обновлены в кэше.`);
      } else {
        console.log(`Данные игрока ${playerData.username} не изменялись.`);
      }
    }
  }

  /**
   * Получение данных с вашего серверного кода через API.
   * @returns {Promise<Array>} - Массив данных игроков
   */
  async getPlayerDataFromServer() {
    try {
      const response = await fetch('https://reverie-field-project-7a9a67da93ff.herokuapp.com/get_player_data_for_koii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.error('Ошибка ответа от сервера:', response.statusText);
        return [];
      }

      const playerData = await response.json();
      return playerData || [];
    } catch (error) {
      console.error('Ошибка при получении данных от серверного кода:', error);
      return [];
    }
  }

  /**
   * Кэширование данных игрока на узле Koii, если данные изменились.
   * @param {Object} playerData - Данные игрока (username, points, level, relics и т.д.)
   * @returns {Promise<boolean>} - Возвращает true, если данные были обновлены, иначе false.
   */
  async cachePlayerDataIfUpdated(playerData) {
    try {
      const cacheKey = `player_data_${playerData.username}`;
      const cachedData = await namespaceWrapper.storeGet(cacheKey);

      if (cachedData) {
        const cachedPlayerData = JSON.parse(cachedData);

        // Сравниваем данные: если изменились, обновляем кэш
        if (this.isPlayerDataChanged(cachedPlayerData, playerData)) {
          await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
          await this.addKeyToCacheList(cacheKey);
          return true; // Данные изменились и были обновлены
        } else {
          return false; // Данные не изменились
        }
      } else {
        // Если данных нет в кэше, просто сохраняем их
        await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
        await this.addKeyToCacheList(cacheKey);
        return true; // Новые данные были сохранены
      }
    } catch (error) {
      console.error('Ошибка при кэшировании данных игрока:', error);
      return false;
    }
  }

  /**
   * Добавление ключа в список кэшированных данных, если он отсутствует.
   * @param {string} key - Ключ для кэширования.
   */
  async addKeyToCacheList(key) {
    try {
      let cacheKeys = await namespaceWrapper.storeGet('cacheKeys');
      cacheKeys = cacheKeys ? JSON.parse(cacheKeys) : [];

      if (!cacheKeys.includes(key)) {
        cacheKeys.push(key);
        await namespaceWrapper.storeSet('cacheKeys', JSON.stringify(cacheKeys));
      }
    } catch (error) {
      console.error('Ошибка при добавлении ключа в список кэшированных данных:', error);
    }
  }

  /**
   * Проверка, изменились ли данные игрока.
   * @param {Object} cachedData - Закэшированные данные
   * @param {Object} newData - Новые данные
   * @returns {boolean} - True, если данные изменились, иначе false
   */
  isPlayerDataChanged(cachedData, newData) {
    return (
      cachedData.total_points !== newData.total_points ||
      cachedData.level !== newData.level ||
      JSON.stringify(cachedData.relics) !== JSON.stringify(newData.relics)
    );
  }

  /**
   * Отправка данных в IPFS и сабмишен их на сервер для проверки.
   * @param {number} round - Номер раунда
   */
  async submitTask(round) {
    try {
      // Получаем закэшированные данные игроков
      const cachedPlayersData = await this.fetchCachedPlayerData();

      if (cachedPlayersData.length === 0) {
        console.log('Нет данных для отправки на сервер.');
        return;
      }

      // Загружаем данные в IPFS через KoiiStorageClient
      const userStaking = await namespaceWrapper.getSubmitterAccount();
      const ipfsCid = await this.uploadToIPFS(cachedPlayersData, userStaking);
      console.log('Данные загружены в IPFS, CID:', ipfsCid);

      // Отправляем CID на сервер через сабмишен
      await namespaceWrapper.checkSubmissionAndUpdateRound(ipfsCid, round);
      console.log('Сабмишен завершен с CID:', ipfsCid);

    } catch (error) {
      console.error('Ошибка при сабмишене данных на сервер:', error);
    }
  }

  /**
   * Загружает данные в IPFS через KoiiStorageClient.
   * @param {Array} data - Данные для загрузки в IPFS
   * @param {Object} userStaking - Информация о стейкинге пользователя
   * @returns {Promise<string>} - CID загруженных данных
   */
  async uploadToIPFS(data, userStaking) {
    try {
      const tempDir = os.tmpdir(); // Используем временную директорию
      const filePath = path.join(tempDir, 'cachedPlayersData.json'); // Путь к временному файлу

      fs.writeFileSync(filePath, JSON.stringify(data)); // Сохраняем данные временно

      // Используем KoiiStorageClient для загрузки файла
      const fileUploadResponse = await this.client.uploadFile(filePath, userStaking);
      return fileUploadResponse.cid; // Возвращаем CID
    } catch (error) {
      console.error('Ошибка при загрузке данных в IPFS:', error);
      throw error;
    }
  }

  /**
   * Получение всех закэшированных данных игроков.
   * @returns {Promise<Array>} - Массив закэшированных данных игроков
   */
  async fetchCachedPlayerData() {
    try {
      let cacheKeys = await namespaceWrapper.storeGet('cacheKeys');
      cacheKeys = cacheKeys ? JSON.parse(cacheKeys) : [];

      const playersData = [];
      for (const key of cacheKeys) {
        const playerData = await namespaceWrapper.storeGet(key);
        if (playerData) {
          playersData.push(JSON.parse(playerData));
        }
      }

      return playersData;
    } catch (error) {
      console.error('Ошибка при получении данных из кэша:', error);
      return [];
    }
  }
}

const submission = new Submission();
module.exports = { submission };
