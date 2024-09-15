const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Submission {
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
          return true; // Данные изменились и были обновлены
        } else {
          return false; // Данные не изменились
        }
      } else {
        // Если данных нет в кэше, просто сохраняем их
        await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
        return true; // Новые данные были сохранены
      }
    } catch (error) {
      console.error('Ошибка при кэшировании данных игрока:', error);
      return false;
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

      // Загружаем данные в IPFS
      const ipfsCid = await this.uploadToIPFS(cachedPlayersData);
      console.log('Данные загружены в IPFS, CID:', ipfsCid);

      // Отправляем CID на сервер через сабмишен
      await namespaceWrapper.checkSubmissionAndUpdateRound(ipfsCid, round);
      console.log('Сабмишен завершен с CID:', ipfsCid);

    } catch (error) {
      console.error('Ошибка при сабмишене данных на сервер:', error);
    }
  }

  /**
   * Загружает данные в IPFS.
   * @param {Array} data - Данные для загрузки в IPFS
   * @returns {Promise<string>} - CID загруженных данных
   */
  async uploadToIPFS(data) {
    try {
      const cid = await namespaceWrapper.uploadToIPFS(data);
      return cid;
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
      if (!namespaceWrapper.storeListKeys) {
        console.error('Ошибка: функция storeListKeys не найдена');
        return [];
      }

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
      console.error('Ошибка при получении данных из кэша:', error);
      return [];
    }
  }
}

const submission = new Submission();
module.exports = { submission };
