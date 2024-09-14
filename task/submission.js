const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Submission {
  /**
   * Задача Koii для кэширования данных игроков.
   * Получаем данные игрока с клиентской стороны и кэшируем их.
   * @param {number} round - Номер раунда
   */
  async task(round) {
    console.log(`Запуск задачи для раунда: ${round}`);
    // Получаем данные игрока с клиентской стороны
    const playersData = await this.getPlayerDataFromClient();

    // Кэшируем данные для каждого игрока
    for (const playerData of playersData) {
      console.log(`Кэшируем данные для игрока: ${playerData.username}`);
      await this.cachePlayerData(playerData);
    }
  }

  /**
   * Получение данных игрока с клиентской стороны через API или HTTP-запросы.
   * @returns {Promise<Array>} - Массив данных игроков
   */
  async getPlayerDataFromClient() {
    try {
      // Запрос на получение данных с вашего сервера
      const response = await fetch('https://reverie-field-project-7a9a67da93ff.herokuapp.com/get_player_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const playerData = await response.json();
      return playerData || [];
    } catch (error) {
      console.error('Ошибка при получении данных игрока с клиента:', error);
      return [];
    }
  }

  /**
   * Кэширование данных игрока на узле Koii.
   * @param {Object} playerData - Данные игрока (username, points, level, relics и т.д.)
   */
  async cachePlayerData(playerData) {
    try {
      const cacheKey = `player_data_${playerData.username}`;
      await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
      console.log(`Данные игрока ${playerData.username} успешно закэшированы.`);
    } catch (error) {
      console.error('Ошибка при кэшировании данных игрока:', error);
    }
  }

  /**
   * Отправка закэшированных данных обратно на сервер для обновления базы данных.
   * @param {number} round - Номер раунда
   */
  async submitTask(round) {
    try {
      // Получаем закэшированные данные
      const cachedPlayersData = await this.fetchCachedPlayerData();

      // Отправляем данные на сервер для обновления базы данных
      console.log('Отправляем данные на сервер:', cachedPlayersData);
      await this.sendDataToServer(cachedPlayersData);
    } catch (error) {
      console.error('Ошибка при отправке данных на сервер:', error);
    }
  }

  /**
   * Получение всех закэшированных данных игроков.
   * @returns {Promise<Array>} - Массив закэшированных данных игроков
   */
  async fetchCachedPlayerData() {
    try {
      const cacheKeys = await namespaceWrapper.storeListKeys(); // Получаем все ключи
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

  /**
   * Отправка закэшированных данных на сервер для обновления базы данных.
   * @param {Array} cachedPlayersData - Массив закэшированных данных игроков
   */
  async sendDataToServer(cachedPlayersData) {
    try {
      // Пример отправки данных на ваш сервер через HTTP-запрос
      await fetch('https://reverie-field-project-7a9a67da93ff.herokuapp.com/update_player_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedPlayersData)
      });
      console.log('Данные успешно отправлены на сервер.');
    } catch (error) {
      console.error('Ошибка при отправке данных на сервер:', error);
    }
  }
}

const submission = new Submission();
module.exports = { submission };
