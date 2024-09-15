const { namespaceWrapper } = require('@_koii/namespace-wrapper');

class Submission {
  async task(round) {
    console.log(`Запуск задачи для раунда: ${round}`);
    
    const playersData = await this.getPlayerDataFromServer();

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

  async getPlayerDataFromServer() {
    try {
      const response = await fetch('https://reverie-field-project-7a9a67da93ff.herokuapp.com/get_player_data_for_koii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const playerData = await response.json();
      return playerData || [];
    } catch (error) {
      console.error('Ошибка при получении данных от серверного кода:', error);
      return [];
    }
  }

  async cachePlayerDataIfUpdated(playerData) {
    try {
      const cacheKey = `player_data_${playerData.username}`;
      const cachedData = await namespaceWrapper.storeGet(cacheKey);

      if (cachedData) {
        const cachedPlayerData = JSON.parse(cachedData);
        if (this.isPlayerDataChanged(cachedPlayerData, playerData)) {
          await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
          return true;
        } else {
          return false;
        }
      } else {
        await namespaceWrapper.storeSet(cacheKey, JSON.stringify(playerData));
        return true;
      }
    } catch (error) {
      console.error('Ошибка при кэшировании данных игрока:', error);
      return false;
    }
  }

  isPlayerDataChanged(cachedData, newData) {
    return (
      cachedData.total_points !== newData.total_points ||
      cachedData.level !== newData.level ||
      JSON.stringify(cachedData.sonic_relics) !== JSON.stringify(newData.sonic_relics)
    );
  }

  async submitTask(round) {
    try {
      const cachedPlayersData = await this.fetchCachedPlayerData();
      const changedData = cachedPlayersData.filter(player => player.isUpdated);

      if (changedData.length > 0) {
        console.log('Отправляем измененные данные на сервер:', changedData);
        await this.sendDataToServer(changedData);
      } else {
        console.log('Измененных данных для отправки нет.');
      }
    } catch (error) {
      console.error('Ошибка при отправке данных на сервер:', error);
    }
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
      console.error('Ошибка при получении данных из кэша:', error);
      return [];
    }
  }

  async sendDataToServer(cachedPlayersData) {
    try {
      await fetch('https://reverie-field-project-7a9a67da93ff.herokuapp.com/update_cached_player_data', {
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
